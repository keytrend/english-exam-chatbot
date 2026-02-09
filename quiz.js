/**
 * 파일명: quiz.js
 * 목적: 수능 단어 퀴즈 API
 * 작성일: 2026-02-09
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('./auth');
const { pool } = require('./database');

/**
 * 랜덤 퀴즈 문제 1개 반환
 * GET /api/quiz/random
 */
router.get('/random', authenticateToken, async (req, res) => {
    try {
        console.log('[Quiz] 랜덤 문제 요청');
        
        // public_vocabulary에서 랜덤 단어 1개 선택
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
        
        // 뜻이 여러 개면 첫 번째만 사용 (쉼표로 구분)
        const mainMeaning = word.meaning.split(',')[0].trim();
        
        // 5지선다 만들기 (정답 1개 + 오답 4개)
        const choices = [
            mainMeaning,              // 정답
            word.distractor_ko_1,      // 오답 1
            word.distractor_ko_2,      // 오답 2
            word.distractor_ko_3,      // 오답 3
            word.distractor_ko_4       // 오답 4
        ];
        
        // 정답 인덱스 저장 (섞기 전)
        const correctAnswer = mainMeaning;
        
        // 배열 섞기 (Fisher-Yates shuffle)
        for (let i = choices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [choices[i], choices[j]] = [choices[j], choices[i]];
        }
        
        // 섞인 후 정답 인덱스 찾기
        const correctIndex = choices.indexOf(correctAnswer);
        
        console.log('[Quiz] 문제 생성:', word.word);
        
        res.json({
            success: true,
            quiz: {
                word: word.word,
                part_of_speech: word.part_of_speech,
                choices: choices,
                correct_index: correctIndex,  // 0~4
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
 