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
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));
// ===================================

const { generateToken, authenticateToken } = require('./auth');
const { verifySubscription } = require('./thinkific');
const { 
  initDatabase, 
  checkUsageLimit, 
  incrementUsage,
  getUserUsage,
  getUsageStats 
} = require('./database');
const { answerQuestion, calculateCost } = require('./ai-router-caching');

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
app.post('/api/chat', authenticateToken, async (req, res) => {
    try {
        const { question, questionType, page_id } = req.body;  // ← page_id 추가
        
        // ========== 캐시에서 해설 가져오기 ==========
        let context = '';
        if (page_id) {
            const cached = contextCache.get(page_id);
            if (cached) {
                context = cached.context;
                console.log(`캐시 사용: ${page_id} (${context.length} 글자)`);
            } else {
                console.log(`캐시 없음: ${page_id}`);
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
app.get('/api/usage', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // 현재 월 사용량
    const currentUsage = await getUserUsage(userId);
    
    // 최근 3개월 통계
    const stats = await getUsageStats(userId, 3);
    
    const LIMITS = {
      simple: parseInt(process.env.SIMPLE_LIMIT) || 300,
      complex: parseInt(process.env.COMPLEX_LIMIT) || 300,
      total: parseInt(process.env.TOTAL_LIMIT) || 600
    };
    
    const totalUsed = currentUsage.simple_count + currentUsage.complex_count;
    
    res.json({
      성공: true,
      이번달: {
        년월: currentUsage.month,
        간단한질문: {
          사용: currentUsage.simple_count,
          한도: LIMITS.simple,
          남음: Math.max(0, LIMITS.simple - currentUsage.simple_count)
        },
        복잡한질문: {
          사용: currentUsage.complex_count,
          한도: LIMITS.complex,
          남음: Math.max(0, LIMITS.complex - currentUsage.complex_count)
        },
        전체: {
          사용: totalUsed,
          한도: LIMITS.total,
          남음: Math.max(0, LIMITS.total - totalUsed)
        }
      },
      최근3개월: stats
    });
    
  } catch (error) {
    console.error('[Server] Usage error:', error);
    res.status(500).json({
      오류: 'server_error',
      메시지: '사용량 조회 중 오류가 발생했습니다.'
    });
  }
});

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