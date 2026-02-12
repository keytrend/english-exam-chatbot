/**
 * 파일명: ai-router-caching.js
 * 목적: AI 모델 라우팅 (Haiku 4.5 / Sonnet 4.5) + Prompt Caching
 * 
 * ===== 모델 분기 =====
 * 단어 뜻 질문 (simple) → Haiku 4.5 | max_tokens: 80 | ~₩0.17/회
 * 복잡한 질문 (complex) → Sonnet 4.5 | max_tokens: 1000 | ~₩3~7/회
 * 
 * 수정일: 2026-02-11
 */

require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// ========== 시스템 프롬프트: 단어 뜻 질문 (Haiku 4.5) ==========
const SIMPLE_SYSTEM_PROMPT = {
  type: "text",
  text: `You are a vocabulary tutor for Korean students.
When given an English word, respond with ONLY this exact format:

word 한국어뜻(품사)

Examples:
predictive 예측적인(형용사)
unprecedented 전례 없는(형용사)
facilitate 촉진하다, 용이하게 하다(동사)
resilience 회복력, 탄력(명사)

Rules:
- Output ONLY one line
- Include part of speech in parentheses: 명사, 동사, 형용사, 부사
- If multiple common meanings, separate with comma
- NO explanations, NO etymology, NO examples, NO extra text
- Remove any trailing punctuation from the input word before answering`,
  cache_control: { type: "ephemeral" }
};

// ========== 시스템 프롬프트: 복잡한 질문 (Sonnet 4.5) ==========
const COMPLEX_SYSTEM_PROMPT = {
  type: "text",
  text: `[VERSION 2026-02-11] English tutor for Korean 수능/TOEFL/SAT students.

RULES:
1. NO HTML tags. Use Markdown pipes for tables only.
2. ANSWER ONLY WHAT IS ASKED. No comparisons unless explicitly requested.
3. Be CONCISE: give 1 example per case, not 3. Keep total response short.
4. COMPLETE every paragraph. Never end mid-sentence.
5. Answer in Korean.
6. For grammar: definition → structure → 1 example → 1 key tip. That's it.
7. For passage analysis: quote the key part → explain → answer.
8. For problem solving: identify the answer → explain why → 1 example if needed.`,
  cache_control: { type: "ephemeral" }
};


/**
 * 단어 뜻 질문 → Haiku 4.5
 */
async function askSimpleWord(question) {
  try {
    var cleanQ = question.replace(/[?？\s]/g, '').replace(/(의|뜻|의미|meaning|definition|번역|해석)/gi, '').trim();
    
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 80,
      system: [SIMPLE_SYSTEM_PROMPT],
      messages: [{
        role: "user",
        content: cleanQ
      }]
    });
    
    console.log('[Haiku-Simple] Token Usage:', {
      input: response.usage.input_tokens,
      cache_read: response.usage.cache_read_input_tokens || 0,
      output: response.usage.output_tokens
    });
    
    return {
      answer: response.content[0].text.trim(),
      model: 'haiku',
      questionType: 'simple',
      usage: response.usage
    };
    
  } catch (error) {
    console.error('[Haiku-Simple] Error:', error.message);
    throw error;
  }
}


/**
 * 복잡한 질문 → Sonnet 4.5
 */
async function askComplex(question, context) {
  try {
    const messages = [{
      role: "user",
      content: []
    }];
    
    if (context && context.trim()) {
      messages[0].content.push({
        type: "text",
        text: `[학생이 보고 있는 문제 페이지 전체 내용 - 지문, 선택지, 해설 포함]\n${context}`,
        cache_control: { type: "ephemeral" }
      });
    }
    
    messages[0].content.push({
      type: "text",
      text: `[학생 질문]\n${question}\n\nAnswer ONLY what is asked. 1 example per case max. Complete all sentences. No comparisons unless requested.`
    });
    
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1000,
      system: [COMPLEX_SYSTEM_PROMPT],
      messages: messages
    });
    
    console.log('[Sonnet-Complex] Token Usage:', {
      input: response.usage.input_tokens,
      cache_read: response.usage.cache_read_input_tokens || 0,
      output: response.usage.output_tokens
    });
    
    return {
      answer: response.content[0].text,
      model: 'sonnet',
      questionType: 'complex',
      usage: response.usage
    };
    
  } catch (error) {
    console.error('[Sonnet-Complex] Error:', error.message);
    throw error;
  }
}


/**
 * 메인 라우팅 함수
 */
async function answerQuestion(question, context, questionType) {
  const startTime = Date.now();
  const type = questionType || 'complex';
  
  console.log(`[Router] Type: ${type} | Q: ${question.substring(0, 50)}...`);
  
  let result;
  
  if (type === 'simple') {
    result = await askSimpleWord(question);
  } else {
    result = await askComplex(question, context);
  }
  
  const duration = Date.now() - startTime;
  console.log(`[Router] Model: ${result.model} | Time: ${duration}ms`);
  
  return {
    ...result,
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
  
  const rate = rates[model] || rates.haiku;
  
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
  calculateCost,
  askSimpleWord,
  askComplex
};
