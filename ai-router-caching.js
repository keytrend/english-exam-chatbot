/**
 * 파일명: ai-router-caching.js
 * Phase: 2
 * 목적: AI 모델 라우팅 (Haiku 4.5 / Sonnet 4.5) + Prompt Caching
 * 모델: claude-haiku-4-5-20251001, claude-sonnet-4-5-20250929
 * 
 * ===== 비용 구조 =====
 * 단어 뜻 질문 (Haiku 4.5): ~₩0.17/회
 *   - Input: 5 토큰, Output: 25 토큰
 * 복잡한 질문 기본 (Sonnet 4.5): ~₩5.5/회
 *   - Input: 100 토큰, Output: 350 토큰
 * [더 자세히] (Sonnet 4.5): ~₩9.5/회 추가
 *   - Input: 200 토큰, Output: 600 토큰
 * 
 * 작성일: 2026-02-02
 * 수정일: 2026-02-11 (모델 분기 최적화)
 */

require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// ========== 시스템 프롬프트: 단어 뜻 질문 (Haiku 4.5) ==========
// 최소한의 프롬프트로 비용 절약
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
- If the word has multiple common meanings, separate with comma
- NO explanations, NO etymology, NO examples, NO extra text`,
  cache_control: { type: "ephemeral" }
};

// ========== 시스템 프롬프트: 복잡한 질문 (Sonnet 4.5) ==========
const COMPLEX_SYSTEM_PROMPT = {
  type: "text",
  text: `[VERSION 2026-02-11] You are an English tutor for Korean students preparing for 수능/TOEFL/SAT.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ ABSOLUTE RULE - VIOLATION WILL CAUSE SYSTEM FAILURE ⚠️

NEVER write HTML tags. Korean students CANNOT see HTML code.
FORBIDDEN: <table>, <tr>, <td>, <th>, <div>, <span>, <style>

For comparison tables, use this Markdown format ONLY:

| 구분 | 항목1 | 항목2 |
|------|------|------|
| 내용1 | 설명1 | 설명2 |

NEVER use HTML. ALWAYS use Markdown pipes for tables.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You handle complex questions: grammar explanations, passage analysis, 
problem solving, sentence structure, reading comprehension, etc.

Guidelines:
- Answer in Korean (한국어)
- Be thorough but concise (150-500 tokens for basic answer)
- Use bullet points and numbered lists for clarity
- Include relevant examples
- For passage analysis, quote specific parts
- For grammar, provide the rule + exceptions + examples
- Use Markdown formatting only (NO HTML)`,
  cache_control: { type: "ephemeral" }
};

// ========== 기존 단어 정보 프롬프트 (어원 포함 상세 버전) ==========
// "더 자세히" 기능에서 사용
const DETAILED_WORD_PROMPT = {
  type: "text",
  text: `[VERSION 2026-02-11] You are an English vocabulary tutor.

CRITICAL: When user asks about word meaning, respond EXACTLY in this format:

━━━━ 📘 단어 정보 ━━━━
word 한글뜻

💡 어원: etymology explanation in Korean

🔗 어원 관련 단어: 3-5 high school level words sharing the same root (format: word1(뜻), word2(뜻), word3(뜻))

🧠 암기법: Create a memorable story connecting etymology to meaning in Korean

🔄 동의어: synonym1, synonym2, synonym3

⚡ 반의어: antonym1, antonym2

📝 예문: English example sentence.
        한글 번역

Use this exact format with these exact emoji headers. NO HTML tags.`,
  cache_control: { type: "ephemeral" }
};


/**
 * 단어 뜻 질문 → Haiku 4.5 (초절약)
 * 비용: ~₩0.17/회
 */
async function askSimpleWord(question) {
  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 80,
      system: [SIMPLE_SYSTEM_PROMPT],
      messages: [{
        role: "user",
        content: question
      }]
    });
    
    console.log('[Haiku-Simple] Token Usage:', {
      input: response.usage.input_tokens,
      cache_creation: response.usage.cache_creation_input_tokens || 0,
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
 * 복잡한 질문 기본 답변 → Sonnet 4.5
 * 비용: ~₩5.5/회
 */
async function askComplex(question, context) {
  try {
    const messages = [{
      role: "user",
      content: []
    }];
    
    // 해설 자료가 있으면 캐싱하여 추가
    if (context && context.trim()) {
      messages[0].content.push({
        type: "text",
        text: `[해설 자료]\n${context}`,
        cache_control: { type: "ephemeral" }
      });
    }
    
    messages[0].content.push({
      type: "text",
      text: `[학생 질문]\n${question}\n\nAnswer in Korean. Use Markdown format only. NO HTML.`
    });
    
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 500,
      system: [COMPLEX_SYSTEM_PROMPT],
      messages: messages
    });
    
    console.log('[Sonnet-Complex] Token Usage:', {
      input: response.usage.input_tokens,
      cache_creation: response.usage.cache_creation_input_tokens || 0,
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
 * [더 자세히] 답변 → Sonnet 4.5
 * 기존 답변을 확장하여 상세 설명
 * 비용: ~₩9.5/회 추가
 */
async function askDetailedFollow(question, previousAnswer, context) {
  try {
    const messages = [
      {
        role: "user",
        content: []
      }
    ];
    
    if (context && context.trim()) {
      messages[0].content.push({
        type: "text",
        text: `[해설 자료]\n${context}`,
        cache_control: { type: "ephemeral" }
      });
    }
    
    messages[0].content.push({
      type: "text",
      text: `[이전 질문]\n${question}\n\n[이전 답변]\n${previousAnswer}\n\n[요청]\n위 답변을 확장하여 더 상세히 설명해주세요. 추가 예문, 비교 분석, 실전 적용법 등을 포함해주세요.\nUse Markdown format only. NO HTML.`
    });
    
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 800,
      system: [COMPLEX_SYSTEM_PROMPT],
      messages: messages
    });
    
    console.log('[Sonnet-Detailed] Token Usage:', {
      input: response.usage.input_tokens,
      cache_creation: response.usage.cache_creation_input_tokens || 0,
      cache_read: response.usage.cache_read_input_tokens || 0,
      output: response.usage.output_tokens
    });
    
    return {
      answer: response.content[0].text,
      model: 'sonnet',
      questionType: 'detailed',
      usage: response.usage
    };
    
  } catch (error) {
    console.error('[Sonnet-Detailed] Error:', error.message);
    throw error;
  }
}


/**
 * 단어 상세 정보 (어원 포함) → Haiku 4.5
 * 단어장 탭에서 "상세 보기" 시 사용
 */
async function askWordDetail(word) {
  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1000,
      system: [DETAILED_WORD_PROMPT],
      messages: [{
        role: "user",
        content: `${word}의 뜻과 상세 정보를 알려주세요. USE THE EXACT FORMAT ABOVE.`
      }]
    });
    
    console.log('[Haiku-Detail] Token Usage:', {
      input: response.usage.input_tokens,
      output: response.usage.output_tokens
    });
    
    return {
      answer: response.content[0].text,
      model: 'haiku',
      questionType: 'word-detail',
      usage: response.usage
    };
    
  } catch (error) {
    console.error('[Haiku-Detail] Error:', error.message);
    throw error;
  }
}


/**
 * 메인 라우팅 함수
 * 프론트엔드에서 전달받은 questionType에 따라 분기
 */
async function answerQuestion(question, context, questionType) {
  const startTime = Date.now();
  
  // 프론트엔드에서 전달받은 questionType 우선 사용
  const type = questionType || 'complex';
  
  console.log(`[Router] Question type: ${type} | Question: ${question.substring(0, 50)}...`);
  
  let result;
  
  if (type === 'simple') {
    // 단어 뜻 질문 → Haiku 4.5 (초절약, context 불필요)
    result = await askSimpleWord(question);
  } else if (type === 'detailed') {
    // [더 자세히] → Sonnet 4.5 (확장 답변)
    // question에 이전 답변 정보가 포함되어야 함
    result = await askComplex(question, context);
  } else {
    // 복잡한 질문 → Sonnet 4.5 (기본 답변)
    result = await askComplex(question, context);
  }
  
  const duration = Date.now() - startTime;
  console.log(`[Router] Model: ${result.model} | Response time: ${duration}ms`);
  
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
  askComplex,
  askDetailedFollow,
  askWordDetail
};
