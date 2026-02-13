/**
 * 파일명: server.js
 * Phase: 2
 * 목적: 메인 Express 서버 (모든 것을 통합)
 * 작성일: 2026-02-02
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');

// ========== 캐시 저장소 추가 ==========
const contextCache = new Map();

// 1시간 후 캐시 자동 삭제
setInterval(() => {
    const now = Date.now();
    const ONE_HOUR = 60 * 60 * 1000;
    
    for (let [key, value] of contextCache.entries()) {
        if (now - value.timestamp > ONE_HOUR) {
            contextCache.delete(key);
            console.log(`캐시 삭제: ${key}`); 
        }
    }
}, 10 * 60 * 1000); // 10분마다 체크
// =====================================

const app = express();

// ========== CORS 설정 추가 ==========
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
// ===================================

const { generateToken, authenticateToken } = require('./auth');
const { verifySubscription } = require('./thinkific');
const { 
  initDatabase, 
  checkUsageLimit, 
  incrementUsage,
  getUserUsage,
  getUsageStats,
  pool 
} = require('./database');
const vocabularyRouter = require('./vocabulary');
const quizRouter = require('./quiz');
const savedProblemsRouter = require('./saved-problems');
const wrongAnswersRouter = require('./wrong-answers');
const { answerQuestion, calculateCost, askSimpleWord } = require('./ai-router-caching');
const authRouter = require('./auth-routes');
const passwordResetRouter = require('./password-reset');  // ← 추가

// const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어
app.use(cors());
app.use(express.json());

// 요청 로깅
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

/**
 * 헬스체크
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

/**
 * API 루트
 */
app.get('/', (req, res) => {
  res.json({
    message: 'English Exam Chatbot API',
    version: '1.0.0',
    endpoints: {
      'POST /api/auth/token': 'Generate JWT token',
      'POST /api/chat': 'Send a question (requires auth)',
      'GET /api/usage': 'Get usage statistics (requires auth)',
      'GET /health': 'Health check'
    }
  });
});

/**
 * 토큰 생성 엔드포인트
 * Thinkific의 Liquid 템플릿에서 호출
 */
app.post('/api/auth/token', async (req, res) => {
  try {
    const { userId, userEmail } = req.body;
    
    if (!userId || !userEmail) {
      return res.status(400).json({
        error: 'missing_fields',
        message: 'userId and userEmail are required'
      });
    }
    
    // 🔧 테스트 모드: Thinkific 구독 확인 건너뛰기
    console.log('[테스트 모드] 로그인 시도:', userId, userEmail);
    
    /* ===== 실제 운영 시 아래 주석 해제 =====
    const subscription = await verifySubscription(userId, userEmail);
    
    if (!subscription.valid) {
      return res.status(403).json({
        error: 'no_subscription',
        message: subscription.message || '활성 구독이 없습니다.'
      });
    }
    ============================================ */
    
    // JWT 토큰 생성
    const token = generateToken(userId, userEmail);
    
    res.json({
      success: true,
      token,
      expiresIn: '1h',
      user: {
        userId,
        userEmail
      }
    });
    
  } catch (error) {
    console.error('[Server] Token generation error:', error);
    res.status(500).json({
      error: 'server_error',
      message: '토큰 생성 중 오류가 발생했습니다.'
    });
  }
});
/**
 * 질문 답변 엔드포인트 (메인!)
 */
// ========== 캐시 저장 엔드포인트 ==========
app.post('/api/cache-context', authenticateToken, (req, res) => {
    try {
        const { page_id, context } = req.body;
        
        if (!page_id || !context) {
            return res.status(400).json({ error: 'page_id와 context가 필요합니다' });
        }
        
        // 캐시 저장
        contextCache.set(page_id, {
            context: context,
            timestamp: Date.now(),
            user: req.user.email
        });
        
        console.log(`캐시 저장: ${page_id} (${context.length} 글자)`);
        
        res.json({ 
            success: true,
            cached_length: context.length 
        });
    } catch (error) {
        console.error('캐시 저장 오류:', error);
        res.status(500).json({ error: '캐시 저장 실패' });
    }
});
// =========================================
// ========== 게스트 챗봇 (랜딩 페이지용, 인증 불필요) ==========
const guestUsage = new Map();
const GUEST_DAILY_LIMIT = 3;

setInterval(() => {
  guestUsage.clear();
  console.log('[Guest] Daily usage reset');
}, 24 * 60 * 60 * 1000);

function getGuestIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() 
    || req.connection?.remoteAddress 
    || 'unknown';
}

app.post('/api/guest-chat', async (req, res) => {
  try {
    const ip = getGuestIP(req);
    const { message, type } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: '질문을 입력해주세요.' });
    }
    if (type !== 'word_meaning') {
      return res.status(400).json({ error: '무료 체험에서는 단어 뜻 질문만 가능합니다.' });
    }
    if (message.length > 200) {
      return res.status(400).json({ error: '질문이 너무 깁니다.' });
    }

    const today = new Date().toDateString();
    const key = `${ip}_${today}`;
    const used = guestUsage.get(key) || 0;

    if (used >= GUEST_DAILY_LIMIT) {
      return res.status(429).json({ 
        error: '오늘의 무료 체험 횟수를 모두 사용했습니다.',
        limit: GUEST_DAILY_LIMIT,
        used: used
      });
    }

    console.log(`[Guest] IP: ${ip} | Used: ${used + 1}/${GUEST_DAILY_LIMIT} | Q: ${message}`);
    const result = await askSimpleWord(message);
    guestUsage.set(key, used + 1);

    res.json({
      reply: result.answer,
      remaining: GUEST_DAILY_LIMIT - (used + 1)
    });

  } catch (error) {
    console.error('[Guest] Error:', error.message);
    res.status(500).json({ error: '일시적인 오류가 발생했습니다.' });
  }
});
app.post('/api/chat', authenticateToken, async (req, res) => {
    try {
        const { question, questionType, page_id, page_context } = req.body;
        
        // ========== 해설 가져오기: 클라이언트 전송 우선 → 캐시 폴백 ==========
        let context = '';
        // 1. 클라이언트가 보낸 최신 page_context 우선 사용
        if (page_context && page_context.trim().length > 50) {
            context = page_context;
            console.log(`클라이언트 컨텍스트 사용: ${context.length} 글자`);
            // 캐시도 최신으로 업데이트
            if (page_id) {
                contextCache.set(page_id, { context: context, timestamp: Date.now() });
            }
        }
        // 2. 클라이언트 컨텍스트 없으면 캐시 사용
        else if (page_id) {
            const cached = contextCache.get(page_id);
            if (cached) {
                context = cached.context;
                console.log(`캐시 사용: ${page_id} (${context.length} 글자)`);
            }
        }
        // ==========================================
        
        const userEmail = req.user.email;    
        const userId = req.user.userId;
    
    // 입력 검증
    if (!question || !question.trim()) {
      return res.status(400).json({
        error: 'missing_question',
        message: '질문을 입력해주세요.'
      });
    }
    
// 테스트용: context 필수 체크 비활성화
    // if (!context || !context.trim()) {
    //   return res.status(400).json({
    //     error: 'missing_context',
    //     message: '문제 해설이 필요합니다.'
    //   });
    // }
    
    // 사용량 제한 확인
    const usageCheck = await checkUsageLimit(userId, questionType);
    
    if (!usageCheck.allowed) {
      return res.status(429).json({
        error: usageCheck.reason,
        message: usageCheck.message,
        usage: usageCheck.usage
      });
    }
    
// AI에게 질문
const startTime = Date.now();
// ========== 무료 회원 단어 뜻 질문 100회 제한 ==========
    if (questionType === 'simple') {
      const { rows: simpleRows } = await pool.query(
        'SELECT free_simple_remaining FROM users WHERE email = $1',
        [req.user.email]
      );
      const freeSimpleRemaining = simpleRows[0]?.free_simple_remaining ?? 0;
      if (freeSimpleRemaining <= 0) {
        return res.json({
          answer: null,
          message: 'FREE_SIMPLE_EXHAUSTED',
          upgradeUrl: 'https://keytrend.thinkific.com/collections'
        });
      }
      await pool.query(
        'UPDATE users SET free_simple_remaining = free_simple_remaining - 1 WHERE email = $1',
        [req.user.email]
      );
    }
// ========== 무료 회원 복잡한 질문 2회 제한 ==========
    if (questionType === 'complex') {
      const { rows: userRows } = await pool.query(
        'SELECT free_complex_remaining FROM users WHERE email = $1',
        [req.user.email]
      );
      const freeRemaining = userRows[0]?.free_complex_remaining ?? 0;
      if (freeRemaining <= 0) {
        return res.json({
          answer: null,
          message: 'FREE_COMPLEX_EXHAUSTED',
          upgradeUrl: 'https://keytrend.thinkific.com/collections'
        });
      }
      await pool.query(
        'UPDATE users SET free_complex_remaining = free_complex_remaining - 1 WHERE email = $1',
        [req.user.email]
      );
    }
const result = await answerQuestion(question, context, questionType);  // ← questionType 추가
const responseTime = Date.now() - startTime;
    
    // 사용량 증가
    const deductFrom = usageCheck.deductFrom || null;
    await incrementUsage(userId, questionType, deductFrom);
    
    // 비용 계산
    const cost = calculateCost(result.usage, result.model);
    
    // 응답
    res.json({
      success: true,
      answer: result.answer,
      metadata: {
        questionType: result.questionType,
        model: result.model,
        responseTime,
        usage: result.usage,
        cost: {
          total: cost.total,
          currency: 'USD'
        }
      }
    });
    
    console.log(`[Chat] User ${userId}: ${questionType} question, ${responseTime}ms, $${cost.total.toFixed(6)}`);
    
  } catch (error) {
    console.error('[Server] Chat error:', error);
    res.status(500).json({
      error: 'server_error',
      message: '답변 생성 중 오류가 발생했습니다.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * 사용량 조회 엔드포인트 (한글 버전)
 */
// ========== 단어장 API ==========
app.use('/api/vocabulary', vocabularyRouter);
// ========== 퀴즈 API ==========
app.use('/api/quiz', quizRouter);
// ===============================
// ========== 저장한 문제 API ==========
app.use('/api/saved-problems', savedProblemsRouter);
// ====================================
// ========== 오답노트 API ==========
app.use('/api/wrong-answers', wrongAnswersRouter);
// ==================================
// ========== 인증 API ==========
app.use('/api/auth', authRouter);
// ==============================
// ========== 비밀번호 재설정 API ==========
app.use('/api/auth', passwordResetRouter);  // ← 추가
// ========================================
app.get('/api/usage', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // free remaining 조회
    const { rows: userRows } = await pool.query(
      'SELECT free_simple_remaining, free_complex_remaining FROM users WHERE email = $1',
      [req.user.email]
    );
    
    const freeSimple = userRows[0]?.free_simple_remaining ?? 0;
    const freeComplex = userRows[0]?.free_complex_remaining ?? 0;
    
    res.json({
      성공: true,
      이번달: {
        간단한질문: {
          남음: freeSimple
        },
        복잡한질문: {
          남음: freeComplex
        }
      }
    });
    
  } catch (error) {
    console.error('[Server] Usage error:', error);
    res.status(500).json({
      오류: 'server_error',
      메시지: '사용량 조회 중 오류가 발생했습니다.'
    });
  }
});

// ========== 퀴즈 오답 생성 API ==========
app.post('/api/vocabulary/quiz-distractors', authenticateToken, async (req, res) => {
    try {
        const { word, meaning, questionType, partOfSpeech, correctAnswer } = req.body;
        
        if (!word || !meaning || !questionType) {
            return res.status(400).json({ error: 'word, meaning, questionType 필요' });
        }
        
        const Anthropic = require('@anthropic-ai/sdk');
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        
        const pos = partOfSpeech || 'noun';
        const posKo = { noun: '명사', verb: '동사', adjective: '형용사', adverb: '부사' }[pos] || '명사';
        
        const answerText = correctAnswer || meaning;
        const meaningCount = answerText.split(',').length;
        const formatInstruction = meaningCount >= 2 
            ? '각 오답도 반드시 쉼표로 구분된 ' + meaningCount + '개의 뜻을 포함해야 합니다. 예: "증가, 상승" 형태'
            : '각 오답은 1개의 뜻만 간결하게 작성하세요.';
        
        let prompt;
        if (questionType === 'en_to_ko') {
            prompt = '영어 단어 "' + word + '"의 뜻은 "' + answerText + '"입니다. 이 단어의 품사는 "' + posKo + '"입니다.\n\n오답 보기 4개를 한국어로 만들어주세요.\n\n[절대 규칙]\n1. 품사 일치: 오답 4개 모두 반드시 "' + posKo + '" 품사여야 합니다.\n2. 뜻 명확히 다름: 오답은 정답("' + answerText + '")과 뜻이 절대 겹치지 않아야 합니다. 정답은 반드시 1개만 있어야 합니다.\n3. ' + formatInstruction + '\n4. 정답 형식과 동일: 정답이 "' + answerText + '" 형태이므로, 오답도 같은 형태여야 합니다.\n5. 품사 표기 절대 금지: "(명사)", "(동사)", "(형용사)" 등 품사를 절대로 포함하지 마세요. 한국어 뜻만 깔끔하게 출력하세요. 괄호 안에 품사를 넣으면 안 됩니다.\n\n반드시 JSON 배열만 출력하세요. 다른 설명 없이.\n정답 형태 참고: "' + answerText + '"';
        } else {
            prompt = '영어 단어 "' + word + '"의 뜻은 "' + meaning + '"입니다. 이 단어의 품사는 "' + posKo + '"입니다.\n\n영어 단어 오답 4개를 만들어주세요.\n\n[절대 규칙]\n1. 품사 일치: 오답 4개 모두 반드시 "' + posKo + '" 품사여야 합니다.\n2. 어원 완전히 다름: 정답 단어("' + word + '")와 철자가 유사하거나 같은 어근을 공유하는 단어는 절대 사용하지 마세요.\n   예시: 정답이 "orthodox"면 "orthodontist", "orthopedics", "orthodoxy" 같은 "ortho-" 어근 단어는 안 됩니다.\n3. 뜻 명확히 다름: 오답의 뜻이 정답 뜻("' + meaning + '")과 유사하거나 겹치면 안 됩니다. 정답은 반드시 1개만 있어야 합니다.\n4. 단어만 출력: 영어 단어만 출력하고, 괄호나 한국어 뜻, 설명 없이 깔끔하게 출력하세요.\n\n반드시 JSON 배열만 출력하세요. 다른 설명 없이.\n예시: ["temporary", "essential", "complex", "frequent"]';
        }
        
        const response = await client.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 200,
            messages: [{ role: 'user', content: prompt }]
        });
        
        const text = response.content[0].text.trim();

        // JSON 배열 추출 (여러 방법 시도)
        let distractors;
        try {
            // 1차: 전체 텍스트가 JSON인 경우
            distractors = JSON.parse(text);
        } catch(e1) {
            try {
                // 2차: 비탐욕적 매칭으로 첫 번째 JSON 배열만 추출
                const jsonMatch = text.match(/\[.*?\]/s);
                if (!jsonMatch) throw new Error('no match');
                distractors = JSON.parse(jsonMatch[0]);
            } catch(e2) {
                try {
                    // 3차: 줄바꿈 포함 JSON 배열 추출
                    const lines = text.split('\n');
                    let jsonStr = '';
                    let inside = false;
                    for (const line of lines) {
                        if (line.includes('[')) inside = true;
                        if (inside) jsonStr += line;
                        if (line.includes(']') && inside) break;
                    }
                    distractors = JSON.parse(jsonStr);
                } catch(e3) {
                    // 4차: 따옴표 안의 한국어/영어 텍스트 직접 추출
                    const items = text.match(/["']([^"']+)["']/g);
                    if (items && items.length >= 4) {
                        distractors = items.map(i => i.replace(/["']/g, ''));
                    } else {
                        throw new Error('JSON 파싱 실패: ' + text);
                    }
                }
            }
        }
        
        if (!Array.isArray(distractors) || distractors.length < 4) {
            throw new Error('오답 4개 미만: ' + JSON.stringify(distractors));
        }
        
        console.log('[Quiz] 오답 생성: ' + word + ' (품사: ' + posKo + ') → ' + distractors.join(', '));
        res.json({ success: true, distractors: distractors });
        
    } catch (error) {
        console.error('[Quiz] 오답 생성 오류:', error);
        res.status(500).json({ error: '오답 생성 실패', message: error.message });
    }
});
// ========================================

/**
 * 404 핸들러
 */
app.use((req, res) => {
  res.status(404).json({
    error: 'not_found',
    message: 'Endpoint not found'
  });
});

/**
 * 에러 핸들러
 */
app.use((err, req, res, next) => {
  console.error('[Server] Unhandled error:', err);
  res.status(500).json({
    error: 'internal_error',
    message: '서버 오류가 발생했습니다.'
  });
});

/**
 * 서버 시작
 */
async function startServer() {
  try {
    // 데이터베이스 초기화
    console.log('[Server] Initializing database...');
    await initDatabase();
    
    // 서버 시작
    app.listen(PORT, () => {
      console.log('='.repeat(50));
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📍 http://localhost:${PORT}`);
      console.log(`🏥 Health: http://localhost:${PORT}/health`);
      console.log('='.repeat(50));
    });
    
  } catch (error) {
    console.error('[Server] Startup error:', error);
    process.exit(1);
  }
}

// 우아한 종료
process.on('SIGTERM', async () => {
  console.log('[Server] SIGTERM received, shutting down...');
  const { closeDatabase } = require('./database');
  await closeDatabase();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Server] SIGINT received, shutting down...');
  const { closeDatabase } = require('./database');
  await closeDatabase();
  process.exit(0);
});

// 서버 시작
if (require.main === module) {
  startServer();
}

module.exports = app;
