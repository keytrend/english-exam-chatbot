/**
 * 파일명: vocabulary.js
 * 목적: 단어장 API
 */

const express = require('express');
const router = express.Router();
const { verifyToken } = require('./auth');
const pool = require('./database');

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
        
        console.log('[Vocabulary] 저장 시도:', { userId, word, meaning });
        
        if (!word || !meaning) {
            return res.status(400).json({
                success: false,
                message: '단어와 뜻을 입력하세요'
            });
        }
        
        // 중복 확인
        const checkQuery = 'SELECT id FROM vocabulary WHERE user_id = $1 AND word = $2';
        const checkResult = await pool.query(checkQuery, [userId, word]);
        
        if (checkResult.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: '이미 저장된 단어입니다'
            });
        }
        
        // 저장
        const insertQuery = `
            INSERT INTO vocabulary (
                user_id, word, meaning, etymology,
                synonyms, antonyms,
                appeared_in_suneung, suneung_years,
                suneung_example_en, suneung_example_ko,
                general_example_en, general_example_ko
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING id
        `;
        
        const values = [
            userId,
            word,
            meaning,
            etymology,
            synonyms ? JSON.stringify(synonyms) : null,
            antonyms ? JSON.stringify(antonyms) : null,
            appeared_in_suneung || false,
            suneung_years,
            suneung_example_en,
            suneung_example_ko,
            general_example_en,
            general_example_ko
        ];
        
        const result = await pool.query(insertQuery, values);
        
        console.log('[Vocabulary] 저장 성공:', result.rows[0].id);
        
        res.json({
            success: true,
            message: '단어장에 저장되었습니다',
            id: result.rows[0].id
        });
        
    } catch (error) {
        console.error('[Vocabulary] 저장 오류:', error);
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
        
        let query = 'SELECT * FROM vocabulary WHERE user_id = $1';
        const values = [userId];
        
        if (search) {
            query += ' AND word ILIKE $2';
            values.push(`%${search}%`);
        }
        
        query += ' ORDER BY saved_at DESC';
        
        const result = await pool.query(query, values);
        
        // JSONB 파싱
        const words = result.rows.map(row => ({
            ...row,
            synonyms: row.synonyms || null,
            antonyms: row.antonyms || null
        }));
        
        res.json({
            success: true,
            words: words
        });
        
    } catch (error) {
        console.error('[Vocabulary] 목록 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '목록 조회 실패'
        });
    }
});

// ========== 단어 삭제 ==========
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { id } = req.params;
        
        const query = 'DELETE FROM vocabulary WHERE id = $1 AND user_id = $2 RETURNING id';
        const result = await pool.query(query, [id, userId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: '단어를 찾을 수 없습니다'
            });
        }
        
        res.json({
            success: true,
            message: '삭제되었습니다'
        });
        
    } catch (error) {
        console.error('[Vocabulary] 삭제 오류:', error);
        res.status(500).json({
            success: false,
            message: '삭제 실패'
        });
    }
});

module.exports = router;