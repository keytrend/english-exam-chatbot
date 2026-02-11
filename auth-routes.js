/**
 * 파일명: auth-routes.js
 * 목적: 회원가입/로그인 라우터 (이메일+비밀번호)
 * 작성일: 2026-02-11
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { generateToken, verifyToken } = require('./auth');
const { supabase } = require('./database');

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 회원가입
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.post('/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: '이메일과 비밀번호를 입력해주세요.'
      });
    }

    // 이메일 중복 확인
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: '이미 가입된 이메일입니다.'
      });
    }

    // 비밀번호 암호화
    const hashedPassword = await bcrypt.hash(password, 10);

    // 사용자 생성
    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        email: email,
        password: hashedPassword,
        name: name || email.split('@')[0],
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    // JWT 토큰 생성 (30일)
    const token = generateToken(newUser.id, newUser.email);

    console.log('[Auth] 회원가입 성공:', email);

    res.json({
      success: true,
      token: token,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name
      }
    });

  } catch (error) {
    console.error('[Auth] 회원가입 오류:', error);
    res.status(500).json({
      success: false,
      error: '회원가입 중 오류가 발생했습니다.'
    });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 로그인
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: '이메일과 비밀번호를 입력해주세요.'
      });
    }

    // 사용자 찾기
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user) {
      return res.status(401).json({
        success: false,
        error: '이메일 또는 비밀번호가 올바르지 않습니다.'
      });
    }

    // 비밀번호 확인
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: '이메일 또는 비밀번호가 올바르지 않습니다.'
      });
    }

    // JWT 토큰 생성 (30일)
    const token = generateToken(user.id, user.email);

    // 마지막 로그인 시간 업데이트
    await supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id);

    console.log('[Auth] 로그인 성공:', email);

    res.json({
      success: true,
      token: token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });

  } catch (error) {
    console.error('[Auth] 로그인 오류:', error);
    res.status(500).json({
      success: false,
      error: '로그인 중 오류가 발생했습니다.'
    });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 토큰 검증 (자동 로그인)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.post('/verify', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(401).json({
        success: false,
        error: '토큰이 없습니다.'
      });
    }

    // 토큰 검증
    const verification = verifyToken(token);

    if (!verification.valid) {
      return res.status(401).json({
        success: false,
        error: verification.message
      });
    }

    // 사용자 정보 조회
    const { data: user } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('id', verification.userId)
      .single();

    if (!user) {
      return res.status(401).json({
        success: false,
        error: '사용자를 찾을 수 없습니다.'
      });
    }

    res.json({
      success: true,
      user: user
    });

  } catch (error) {
    console.error('[Auth] 토큰 검증 오류:', error);
    res.status(401).json({
      success: false,
      error: '유효하지 않은 토큰입니다.'
    });
  }
});

module.exports = router;
