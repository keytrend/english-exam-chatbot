/**
 * 파일명: quiz.js
 * 목적: 수능 단어 퀴즈 API
 * 작성일: 2026-02-09
 * 수정일: 2026-02-10 (보기 형식 통일)
 */
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('./auth');
const { pool } = require('./database');

// 첫 번째 뜻만 추출하는 함수
function getFirstMeaning(text) {
    if (!text) return '';
    return text.split(',')[0].trim();
}

/**
 * 랜덤 퀴즈 문제 1개 반환
 * GET /api/quiz/random
 */
router.get('/random', authenticateToken, async (req, res) => {
    try {
        console.log('[Quiz] 랜덤 문제 요청 (v2 - 형식 통일)');
        
        const query = `
            SELECT 
                word,
                meaning,
                part_of_speech,
                distractor_ko_1,
                distractor_ko_2,
                distractor_ko_3,
                distractor_ko_4,
                frequency_rank
            FROM public_vocabulary
            ORDER BY RANDOM()
            LIMIT 1
        `;
        
        const result = await pool.query(query);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: '퀴즈 문제를 찾을 수 없습니다'
            });
        }
        
        const word = result.rows[0];
        
        // 모든 보기: 첫 번째 뜻만 사용 (형식 통일)
        const correctAnswer = getFirstMeaning(word.meaning);
        const d1 = getFirstMeaning(word.distractor_ko_1);
        const d2 = getFirstMeaning(word.distractor_ko_2);
        const d3 = getFirstMeaning(word.distractor_ko_3);
        const d4 = getFirstMeaning(word.distractor_ko_4);
        
        // 확인 로그
        console.log('[Quiz] 정답:', correctAnswer);
        console.log('[Quiz] 오답:', d1, '|', d2, '|', d3, '|', d4);
        
        const choices = [correctAnswer, d1, d2, d3, d4];
        
        // Fisher-Yates shuffle
        for (let i = choices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [choices[i], choices[j]] = [choices[j], choices[i]];
        }
        
        const correctIndex = choices.indexOf(correctAnswer);
        
        console.log('[Quiz] 문제:', word.word, '→ 보기:', choices);
        
        res.json({
            success: true,
            quiz: {
                word: word.word,
                part_of_speech: word.part_of_speech,
                choices: choices,
                correct_index: correctIndex,
                frequency_rank: word.frequency_rank
            }
        });
        
    } catch (error) {
        console.error('[Quiz] 랜덤 문제 오류:', error);
        res.status(500).json({
            success: false,
            message: '퀴즈 생성 실패'
        });
    }
});

module.exports = router;
