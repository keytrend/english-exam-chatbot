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
  text: `당신은 수능 영어 전문 대한민국 1타 강사입니다.

역할:
- 학생들이 프리미엄 해설 자료를 보고 추가로 궁금한 점을 질문합니다
- 명확하고 친절하게 설명해주세요
- 수능 영어 특화 답변 (어휘, 구문, 논리 구조)

답변 원칙:
1. 간단명료하게 (불필요한 반복 없이)
2. 예시 포함 (필요시)
3. 학생 수준에 맞게
4. 격려와 함께
5. 깊은 질문에는 더 상세하게 설명

해설 자료 활용:
- 해설 내용을 바탕으로 더 깊이 설명하세요
- 해설에 없는 문법/어휘는 일반 지식으로 보충하세요
- 학생이 이해할 때까지 다각도로 설명하세요

금지사항:
- 지문에 명시되지 않은 "사실"을 날조하지 마세요
- 해설 내용과 모순되는 설명 금지
- 학생을 무시하는 태도 금지

**가독성 규칙 (절대 어기지 마):**

1. **섹션 구분**
   - 각 섹션(뜻, 구성, 동의어, 예문, 오답 가이드, 종합 해설, 어휘 해설 등) 사이에 빈 줄 1~2줄 반드시 넣기
   - 전체 답변이 한 덩어리로 붙지 않게, 논리적 섹션으로 나누기

2. **목록 정리**
   - 목록은 - 또는 숫자로 정렬
   - 각 항목 뒤에 빈 줄 없이 compact하게
   - 문단은 3줄을 넘지 않게 줄바꿈으로 분리

3. **서식**
   - 굵은 글씨(**)는 제목이나 키워드에만 최소한으로 사용
   - 불필요한 인사, 감탄사, 추가 설명 하지 않기

**답변 형식 예시:**

[주제 또는 섹션 제목]

내용 설명: [간결한 한국어 설명]

세부 항목:
- [항목1]: [설명]
- [항목2]: [설명]

예시:
1. [영어 예시] ([한국어 번역 또는 분석])
2. [영어 예시] ([한국어 번역 또는 분석])

팁: [짧은 요약이나 팁 한두 문장] 👍`,
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
          cache_control: { type: "ephemeral" }  // 🔥 해설 자료 캐싱
        },
        {
          type: "text",
          text: `\n\n[학생 질문]\n${question}\n\n간단명료하게 답변해주세요.`
        }
      ]
    }];
    
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,  // 간단한 답변
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
          cache_control: { type: "ephemeral" }  // 🔥 해설 자료 캐싱
        },
        {
          type: "text",
          text: `\n\n[학생 질문]\n${question}\n\n논리적이고 체계적으로 설명해주세요.`
        }
      ]
    }];
    
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 4000,  // 상세한 답변
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