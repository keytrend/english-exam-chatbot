/**
 * 파일명: ai-router-caching.js
 * Phase: 2
 * 목적: AI 모델 라우팅 (Haiku 4.5 / Sonnet 4.5) + Prompt Caching
 * 모델: claude-haiku-4-5-20251001, claude-sonnet-4-5-20250929
 * 작성일: 2026-02-02
 */

require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const SYSTEM_PROMPT = {
  type: "text",
  text: `[VERSION 2026-02-10-10:00] You are an English vocabulary tutor.

ABSOLUTE RULES - NEVER BREAK THESE:
1. NEVER use HTML tags in your response (no <table>, <tr>, <td>, <th>, <div>, <span>)
2. ONLY use plain text and Markdown syntax
3. For tables, ONLY use Markdown pipe format:
   | Column1 | Column2 |
   |---------|---------|
   | Data1   | Data2   |
4. If you write ANY HTML tag, the response will FAIL

CRITICAL: Korean students cannot see HTML code. Use Markdown only.

CRITICAL: When user asks about word meaning, respond EXACTLY in this format with blank lines between each section:

━━━━ 📘 단어 정보 ━━━━
word 한글뜻

💡 어원: etymology explanation in Korean

🔗 어원 관련 단어: 3-5 high school level words sharing the same root (format: word1(뜻), word2(뜻), word3(뜻))

🧠 암기법: Create a memorable story connecting etymology to meaning in Korean, and mention one of the related words to help memory

🔄 동의어: synonym1, synonym2, synonym3

⚡ 반의어: antonym1, antonym2

📝 예문: English example sentence.
        한글 번역

Example:
━━━━ 📘 단어 정보 ━━━━
fundamental 기본적인, 근본적인

💡 어원: fundus(라틴어, '바닥', '기초') + -mental(형용사 접미사)

🔗 어원 관련 단어: foundation(기초, 토대), fund(자금, 기금), profound(깊은, 심오한), founder(설립자)

🧠 암기법: 건물을 지을 때 가장 먼저 파는 foundation(기초)처럼, fundus는 '바닥'을 뜻합니다. 그 기초 아래 있는 것이 바로 fundamental(근본적인)!

🔄 동의어: basic(기본적인), essential(필수적인), primary(주요한)

⚡ 반의어: superficial(표면적인), secondary(부차적인)

📝 예문: Understanding fundamental principles is essential for success.
        근본적인 원리를 이해하는 것은 성공에 필수적이다.

IMPORTANT: 
- Always add blank line after each section
- Related words MUST be high school/수능 level words
- Include 3-5 related words maximum
- Format: word(한글뜻), word(한글뜻)

For other questions: answer normally.`,
  cache_control: { type: "ephemeral" }
};


/**
 * 질문 분류 함수 (Haiku vs Sonnet)
 */
function classifyQuestion(question) {
  // Tier 1: 간단한 질문 → Haiku
  const simplePatterns = [
    /^[가-힣a-zA-Z]+\s*(뜻|의미|meaning|definition)\?*$/i,
    /^정답\s*(은|이)\s*몇\s*번/i,
    /^[a-zA-Z]+\s*\?*$/,
    /해석|번역|translate/i,
    /구문|문법|grammar/i,
    /예문|example sentence/i,
    /동의어|반의어|synonym|antonym/i
  ];
  
  for (let pattern of simplePatterns) {
    if (pattern.test(question.trim())) {
      return 'simple';
    }
  }
  
  // Tier 2: 복잡한 추론 → Sonnet
  const complexPatterns = [
    /왜|why|이유|reason/i,
    /차이|비교|compare|difference/i,
    /오답|틀린|wrong answer/i,
    /함정|trap|pitfall/i,
    /논리|logic|구조|structure/i,
    /[①②③④⑤]\s*번.*[①②③④⑤]\s*번/,
    /정답.*아니[고냐]/i,
    /.*분석|analysis/i
  ];
  
  for (let pattern of complexPatterns) {
    if (pattern.test(question)) {
      return 'complex';
    }
  }
  
  // 기본값: 안전하게 Sonnet
  return 'complex';
}

/**
 * Claude Haiku로 질문 (간단한 질문)
 */
async function askClaudeHaiku(question, context) {
  try {
    const messages = [{
      role: "user",
      content: [
        {
          type: "text",
          text: `[해설 자료]\n${context}`,
          cache_control: { type: "ephemeral" }
        },
        {
          type: "text",
          text: `\n\n[학생 질문]\n${question}\n\nUSE THE EXACT FORMAT ABOVE.`
        }
      ]
    }];
    
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1000,
      system: [SYSTEM_PROMPT],
      messages: messages
    });
    
    // 토큰 사용량 로그
    console.log('[Haiku] Token Usage:', {
      input: response.usage.input_tokens,
      cache_creation: response.usage.cache_creation_input_tokens || 0,
      cache_read: response.usage.cache_read_input_tokens || 0,
      output: response.usage.output_tokens
    });
    
    return {
      answer: response.content[0].text,
      model: 'haiku',
      usage: response.usage
    };
    
  } catch (error) {
    console.error('[Haiku] Error:', error.message);
    throw error;
  }
}

/**
 * Claude Sonnet으로 질문 (복잡한 추론)
 */
async function askClaudeSonnet(question, context) {
  try {
    const messages = [{
      role: "user",
      content: [
        {
          type: "text",
          text: `[해설 자료]\n${context}`,
          cache_control: { type: "ephemeral" }
        },
        {
          type: "text",
          text: `\n\n[학생 질문]\n${question}\n\nUSE THE EXACT FORMAT ABOVE.`
        }
      ]
    }];
    
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 4000,
      system: [SYSTEM_PROMPT],
      messages: messages
    });
    
    // 토큰 사용량 로그
    console.log('[Sonnet] Token Usage:', {
      input: response.usage.input_tokens,
      cache_creation: response.usage.cache_creation_input_tokens || 0,
      cache_read: response.usage.cache_read_input_tokens || 0,
      output: response.usage.output_tokens
    });
    
    return {
      answer: response.content[0].text,
      model: 'sonnet',
      usage: response.usage
    };
    
  } catch (error) {
    console.error('[Sonnet] Error:', error.message);
    throw error;
  }
}

/**
 * 메인 라우팅 함수
 */
async function answerQuestion(question, context) {
  const startTime = Date.now();
  
  // 질문 분류
  const questionType = classifyQuestion(question);
  console.log(`[Router] Question type: ${questionType}`);
  
  let result;
  
  if (questionType === 'simple') {
    result = await askClaudeHaiku(question, context);
  } else {
    result = await askClaudeSonnet(question, context);
  }
  
  const duration = Date.now() - startTime;
  console.log(`[Router] Response time: ${duration}ms`);
  
  return {
    ...result,
    questionType,
    responseTime: duration
  };
}

/**
 * 비용 계산 함수
 */
function calculateCost(usage, model) {
  const rates = {
    haiku: {
      input: 1.00 / 1000000,
      output: 5.00 / 1000000,
      cacheWrite: (1.00 * 1.25) / 1000000,
      cacheRead: (1.00 * 0.1) / 1000000
    },
    sonnet: {
      input: 3.00 / 1000000,
      output: 15.00 / 1000000,
      cacheWrite: (3.00 * 1.25) / 1000000,
      cacheRead: (3.00 * 0.1) / 1000000
    }
  };
  
  const rate = rates[model];
  
  const cost = {
    input: (usage.input_tokens || 0) * rate.input,
    cacheWrite: (usage.cache_creation_input_tokens || 0) * rate.cacheWrite,
    cacheRead: (usage.cache_read_input_tokens || 0) * rate.cacheRead,
    output: (usage.output_tokens || 0) * rate.output
  };
  
  cost.total = cost.input + cost.cacheWrite + cost.cacheRead + cost.output;
  
  return cost;
}

module.exports = {
  answerQuestion,
  classifyQuestion,
  calculateCost,
  askClaudeHaiku,
  askClaudeSonnet
};
