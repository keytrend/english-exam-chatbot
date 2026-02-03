/**
 * 파일명: database.js
 * Phase: 2
 * 목적: PostgreSQL 사용량 추적 및 제한
 * 작성일: 2026-02-02
 */

require('dotenv').config();
const { Pool } = require('pg');

// PostgreSQL Connection Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,  // 최대 연결 수
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// 연결 테스트
pool.on('connect', () => {
  console.log('[DB] Connected to PostgreSQL');
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected error:', err);
});

/**
 * 데이터베이스 초기화 (테이블 생성)
 */
async function initDatabase() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // user_usage 테이블 생성
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_usage (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        month VARCHAR(7) NOT NULL,
        simple_count INT DEFAULT 0,
        complex_count INT DEFAULT 0,
        last_used TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, month)
      )
    `);
    
    // 인덱스 생성
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_month 
      ON user_usage(user_id, month)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_last_used 
      ON user_usage(last_used)
    `);
    
    await client.query('COMMIT');
    console.log('[DB] Database initialized successfully');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[DB] Init error:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 현재 월 문자열 생성 (YYYY-MM)
 */
function getCurrentMonth() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * 사용자 월간 사용량 조회
 */
async function getUserUsage(userId) {
  const month = getCurrentMonth();
  
  try {
    const result = await pool.query(
      `SELECT * FROM user_usage 
       WHERE user_id = $1 AND month = $2`,
      [userId, month]
    );
    
    if (result.rows.length === 0) {
      // 처음 사용하는 경우 새 레코드 생성
      const insertResult = await pool.query(
        `INSERT INTO user_usage (user_id, month, simple_count, complex_count)
         VALUES ($1, $2, 0, 0)
         RETURNING *`,
        [userId, month]
      );
      return insertResult.rows[0];
    }
    
    return result.rows[0];
    
  } catch (error) {
    console.error('[DB] Get usage error:', error);
    throw error;
  }
}

/**
 * 사용량 확인 (제한 체크)
 */
async function checkUsageLimit(userId, questionType) {
  const usage = await getUserUsage(userId);
  
  const LIMITS = {
    simple: parseInt(process.env.SIMPLE_LIMIT) || 300,
    complex: parseInt(process.env.COMPLEX_LIMIT) || 300,
    total: parseInt(process.env.TOTAL_LIMIT) || 600
  };
  
  const totalUsed = usage.simple_count + usage.complex_count;
  
  // 전체 한도 체크
  if (totalUsed >= LIMITS.total) {
    return {
      allowed: false,
      reason: 'total_limit_exceeded',
      message: `월간 총 사용 한도(${LIMITS.total}회)를 초과했습니다.`,
      usage: {
        simple: usage.simple_count,
        complex: usage.complex_count,
        total: totalUsed
      }
    };
  }
  
  // 개별 한도 체크 (유연한 관리)
  if (questionType === 'simple') {
    if (usage.simple_count >= LIMITS.simple) {
      // 복잡한 질문 할당량에서 차감 가능한지 체크
      const remainingComplex = LIMITS.complex - usage.complex_count;
      if (remainingComplex > 0) {
        return {
          allowed: true,
          message: '간단한 질문 한도 초과. 복잡한 질문 할당량에서 차감됩니다.',
          deductFrom: 'complex'
        };
      } else {
        return {
          allowed: false,
          reason: 'simple_limit_exceeded',
          message: `간단한 질문 한도(${LIMITS.simple}회)를 초과했습니다.`,
          usage: {
            simple: usage.simple_count,
            complex: usage.complex_count,
            total: totalUsed
          }
        };
      }
    }
  } else {  // complex
    if (usage.complex_count >= LIMITS.complex) {
      // 간단한 질문 할당량에서 차감 가능한지 체크
      const remainingSimple = LIMITS.simple - usage.simple_count;
      if (remainingSimple > 0) {
        return {
          allowed: true,
          message: '복잡한 질문 한도 초과. 간단한 질문 할당량에서 차감됩니다.',
          deductFrom: 'simple'
        };
      } else {
        return {
          allowed: false,
          reason: 'complex_limit_exceeded',
          message: `복잡한 질문 한도(${LIMITS.complex}회)를 초과했습니다.`,
          usage: {
            simple: usage.simple_count,
            complex: usage.complex_count,
            total: totalUsed
          }
        };
      }
    }
  }
  
  return {
    allowed: true,
    message: '사용 가능',
    usage: {
      simple: usage.simple_count,
      complex: usage.complex_count,
      total: totalUsed,
      remaining: LIMITS.total - totalUsed
    }
  };
}

/**
 * 사용량 증가
 */
async function incrementUsage(userId, questionType, deductFrom = null) {
  const month = getCurrentMonth();
  
  try {
    // deductFrom이 있으면 해당 카운터 증가, 없으면 questionType 카운터 증가
    const columnToIncrement = deductFrom === 'simple' ? 'simple_count' :
                             deductFrom === 'complex' ? 'complex_count' :
                             questionType === 'simple' ? 'simple_count' : 'complex_count';
    
    const result = await pool.query(
      `UPDATE user_usage 
       SET ${columnToIncrement} = ${columnToIncrement} + 1,
           last_used = NOW()
       WHERE user_id = $1 AND month = $2
       RETURNING *`,
      [userId, month]
    );
    
    if (result.rows.length === 0) {
      throw new Error('User usage record not found');
    }
    
    console.log(`[DB] Incremented ${columnToIncrement} for user ${userId}`);
    return result.rows[0];
    
  } catch (error) {
    console.error('[DB] Increment usage error:', error);
    throw error;
  }
}

/**
 * 사용 통계 조회
 */
async function getUsageStats(userId, months = 3) {
  try {
    const result = await pool.query(
      `SELECT month, simple_count, complex_count, 
              (simple_count + complex_count) as total_count
       FROM user_usage
       WHERE user_id = $1
       ORDER BY month DESC
       LIMIT $2`,
      [userId, months]
    );
    
    return result.rows;
    
  } catch (error) {
    console.error('[DB] Get stats error:', error);
    throw error;
  }
}

/**
 * 전체 통계 (관리자용)
 */
async function getGlobalStats(month = null) {
  const targetMonth = month || getCurrentMonth();
  
  try {
    const result = await pool.query(
      `SELECT 
        COUNT(DISTINCT user_id) as total_users,
        SUM(simple_count) as total_simple,
        SUM(complex_count) as total_complex,
        SUM(simple_count + complex_count) as total_questions,
        AVG(simple_count + complex_count) as avg_per_user
       FROM user_usage
       WHERE month = $1`,
      [targetMonth]
    );
    
    return result.rows[0];
    
  } catch (error) {
    console.error('[DB] Get global stats error:', error);
    throw error;
  }
}

/**
 * 연결 종료
 */
async function closeDatabase() {
  await pool.end();
  console.log('[DB] Connection pool closed');
}

module.exports = {
  initDatabase,
  getUserUsage,
  checkUsageLimit,
  incrementUsage,
  getUsageStats,
  getGlobalStats,
  closeDatabase
};
