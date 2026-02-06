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

// 시스템 프롬프트 (캐싱됨)
const SYSTEM_PROMPT = {
  type: "text",
  text: `[VERSION 2026-02-06-10:00] You are an English vocabulary tutor specialized in etymology.

CRITICAL RULES FOR WORD QUESTIONS:
1. MUST include etymology (어원) section - this is REQUIRED
2. MUST include 3-5 related words (어원 관련 단어) - this is REQUIRED
3. MUST follow the exact format below

When user asks about word meaning, respond EXACTLY in this format with blank lines:

━━━━ 📘 단어 정보 ━━━━
word 한글뜻

💡 어원: etymology explanation in Korean (REQUIRED - 라틴어/그리스어 어원 반드시 포함)

🔗 어원 관련 단어: REQUIRED - 3-5 high school level words sharing same root
Format: word1(뜻), word2(뜻), word3(뜻)
Example: dictionary(사전), dictate(받아쓰게 하다), contradict(반박하다)

🧠 암기법: Story connecting etymology to meaning in Korean

🔄 동의어: synonym1, synonym2, synonym3

⚡ 반의어: antonym1, antonym2

📝 예문: English example sentence.
        한글 번역

Example:
━━━━ 📘 단어 정보 ━━━━
predict 예측하다

💡 어원: 라틴어 'praedicere'에서 유래 - prae(미리) + dicere(말하다) → "미리 말하다" = 예측하다

🔗 어원 관련 단어: dictionary(사전), dictate(받아쓰게 하다), contradict(반박하다), verdict(평결), benediction(축복)

🧠 암기법: dict는 '말하다'를 뜻합니다. dictionary는 단어를 말해주는 것, predict는 미리 말하는 것!

🔄 동의어: forecast(예보하다), foresee(예견하다), anticipate(예상하다)

⚡ 반의어: review(되돌아보다), recall(회상하다)

📝 예문: Scientists predict that global temperatures will rise.
        과학자들은 지구 온도가 상승할 것이라고 예측한다.

REMEMBER: Etymology and related words are MANDATORY for all vocabulary questions!

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
