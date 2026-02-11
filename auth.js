/**
 * 파일명: auth.js
 * Phase: 2
 * 목적: JWT 토큰 생성 및 검증
 * 작성일: 2026-02-02
 */

require('dotenv').config();
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRY = '30d';  // 30일

if (!JWT_SECRET || JWT_SECRET === 'change-this-to-random-secret-key-min-32-chars') {
  console.error('⚠️ WARNING: JWT_SECRET not properly set in .env file!');
  console.error('   Please generate a secure random secret.');
}

/**
 * JWT 토큰 생성
 */
function generateToken(userId, userEmail) {
  const payload = {
    userId,
    userEmail,
    timestamp: Date.now()
  };
  
  try {
    const token = jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRY,
      issuer: 'english-chatbot'
    });
    
    console.log(`[Auth] Token generated for user: ${userId}`);
    return token;
    
  } catch (error) {
    console.error('[Auth] Token generation error:', error);
    throw error;
  }
}

/**
 * JWT 토큰 검증
 */
function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'english-chatbot'
    });
    
    console.log(`[Auth] Token verified for user: ${decoded.userId}`);
    return {
      valid: true,
      userId: decoded.userId,
      userEmail: decoded.userEmail
    };
    
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      console.log('[Auth] Token expired');
      return {
        valid: false,
        error: 'token_expired',
        message: '토큰이 만료되었습니다. 다시 로그인해주세요.'
      };
    } else if (error.name === 'JsonWebTokenError') {
      console.log('[Auth] Invalid token');
      return {
        valid: false,
        error: 'invalid_token',
        message: '유효하지 않은 토큰입니다.'
      };
    } else {
      console.error('[Auth] Token verification error:', error);
      return {
        valid: false,
        error: 'verification_error',
        message: '토큰 검증 중 오류가 발생했습니다.'
      };
    }
  }
}

/**
 * Express 미들웨어: 토큰 검증
 */
function authenticateToken(req, res, next) {
  // Authorization 헤더에서 토큰 추출
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];  // Bearer TOKEN
  
  if (!token) {
    return res.status(401).json({
      error: 'no_token',
      message: '인증 토큰이 필요합니다.'
    });
  }
  
  const verification = verifyToken(token);
  
  if (!verification.valid) {
    return res.status(403).json({
      error: verification.error,
      message: verification.message
    });
  }
  
  // 검증된 사용자 정보를 req에 저장
  req.user = {
    userId: verification.userId,
    userEmail: verification.userEmail
  };
  
  next();
}

/**
 * 토큰 갱신 (옵션)
 */
function refreshToken(oldToken) {
  try {
    // 만료된 토큰도 decode만 함 (검증 안 함)
    const decoded = jwt.decode(oldToken);
    
    if (!decoded) {
      throw new Error('Invalid token');
    }
    
    // 새 토큰 생성
    return generateToken(decoded.userId, decoded.userEmail);
    
  } catch (error) {
    console.error('[Auth] Token refresh error:', error);
    throw error;
  }
}

module.exports = {
  generateToken,
  verifyToken,
  authenticateToken,
  refreshToken
};
 
