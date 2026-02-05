const express = require('express');
const router = express.Router();
const supabase = require('./database');

// JWT 검증 함수 (auth.js에서 가져오기)
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: '인증 토큰이 없습니다.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: '유효하지 않은 토큰입니다.' });
    }
    req.user = user;
    next();
  });
}

// ========== 단어 저장 ==========
router.post('/save', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      word,
      meaning,
      etymology,
      synonyms,
      antonyms,
      appeared_in_suneung,
      suneung_years,
      suneung_example_en,
      suneung_example_ko,
      general_example_en,
      general_example_ko
    } = req.body;

    // 필수 항목 검증
    if (!word || !meaning) {
      return res.status(400).json({ 
        success: false, 
        message: '단어와 뜻은 필수입니다.' 
      });
    }

    // 중복 확인
    const { data: existing } = await supabase
      .from('vocabulary')
      .select('id')
      .eq('user_id', userId)
      .eq('word', word)
      .single();

    if (existing) {
      return res.status(409).json({
        success: false,
        message: '이미 저장된 단어입니다.'
      });
    }

    // 저장
    const { data, error } = await supabase
      .from('vocabulary')
      .insert([{
        user_id: userId,
        word,
        meaning,
        etymology,
        synonyms,
        antonyms,
        appeared_in_suneung,
        suneung_years,
        suneung_example_en,
        suneung_example_ko,
        general_example_en,
        general_example_ko
      }])
      .select();

    if (error) throw error;

    res.json({
      success: true,
      message: '단어장에 저장되었습니다.',
      data: data[0]
    });

  } catch (error) {
    console.error('단어 저장 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '단어 저장 실패' 
    });
  }
});

// ========== 단어 목록 조회 ==========
router.get('/list', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { search } = req.query;

    let query = supabase
      .from('vocabulary')
      .select('*')
      .eq('user_id', userId)
      .order('saved_at', { ascending: false });

    // 검색어가 있으면 필터링
    if (search) {
      query = query.ilike('word', `%${search}%`);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json({
      success: true,
      count: data.length,
      words: data
    });

  } catch (error) {
    console.error('단어 목록 조회 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '단어 목록 조회 실패' 
    });
  }
});

// ========== 단어 삭제 ==========
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    // 본인 단어인지 확인
    const { data: word } = await supabase
      .from('vocabulary')
      .select('user_id')
      .eq('id', id)
      .single();

    if (!word || word.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: '삭제 권한이 없습니다.'
      });
    }

    // 삭제
    const { error } = await supabase
      .from('vocabulary')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({
      success: true,
      message: '단어가 삭제되었습니다.'
    });

  } catch (error) {
    console.error('단어 삭제 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '단어 삭제 실패' 
    });
  }
});

module.exports = router;