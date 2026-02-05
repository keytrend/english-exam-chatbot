/**
 * 파일명: ai-router-caching.js
 * Phase: 2
 * 목적: AI 모델 라우팅 (Haiku/Sonnet) + Prompt Caching
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
  text: `[VERSION 2026-02-05-21:45] You are an English vocabulary tutor.

CRITICAL: When user asks about word meaning, respond EXACTLY in this format:

━━━━ 📘 단어 정보 ━━━━
word 한글뜻

💡 어원: etymology explanation in Korean
🔄 동의어: synonym1(explanation in Korean), synonym2(explanation in Korean),, synonym3(explanation in Korean),
⚡ 반의어: antonym1(explanation in Korean),, antonym2(explanation in Korean),
📝 예문: English example sentence.
        한글 번역

Example:
━━━━ 📘 단어 정보 ━━━━
flawlessly 완벽하게, 흠잡을 데 없이

💡 어원: flaw(결함) + -less(없는) + -ly(부사형)
🔄 동의어: perfectly, impeccably, immaculately
⚡ 반의어: imperfectly, poorly, badly
📝 예문: She performed the routine flawlessly.
        그녀는 그 루틴을 완벽하게 수행했다.

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