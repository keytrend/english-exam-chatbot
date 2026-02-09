/**
 * 파일명: wrong-answers.js
 * 목적: 오답노트 API
 * 작성일: 2026-02-07
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('./auth');
const { pool } = require('./database');

// ========== 오답 등록 ==========
router.post('/save', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { 
            course_name,
            problem_number,
            problem_url,
            wrong_reason,  // 틀린 이유 (필수)
            note           // 추가 메모 (선택)
        } = req.body;

        console.log('[WrongAnswers] 오답 등록:', { userId, course_name, problem_number });

        if (!course_name || !problem_number || !problem_url || !wrong_reason) {
            return res.status(400).json({
                success: false,
                message: '코스명, 문제번호, URL, 틀린 이유가 필요합니다.'
            });
        }

        // 중복 체크
        const checkQuery = `
            SELECT id FROM wrong_answers 
            WHERE user_id = $1 AND course_name = $2 AND problem_number = $3
        `;
        const checkResult = await pool.query(checkQuery, [userId, course_name, problem_number]);

        if (checkResult.rows.length > 0) {
            return res.json({
                success: false,
                message: '이미 등록된 오답입니다.'
            });
        }

        // 오답 등록
        const insertQuery = `
            INSERT INTO wrong_answers 
            (user_id, course_name, problem_number, problem_url, wrong_reason, note, saved_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            RETURNING *
        `;
        const result = await pool.query(insertQuery, [
            userId,
            course_name,
            problem_number,
            problem_url,
            wrong_reason,
            note || null
        ]);

        console.log('[WrongAnswers] 등록 성공:', result.rows[0].id);

        res.json({
            success: true,
            message: '오답이 등록되었습니다!',
            wrongAnswer: result.rows[0]
        });

    } catch (error) {
        console.error('[WrongAnswers] 등록 오류:', error);
        res.status(500).json({
            success: false,
            message: '오답 등록 실패'
        });
    }
});

// ========== 오답 목록 조회 ==========
router.get('/list', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { course_name } = req.query;

        console.log('[WrongAnswers] 목록 조회:', { userId, course_name });

        let query = `
            SELECT * FROM wrong_answers 
            WHERE user_id = $1
        `;
        const params = [userId];

        if (course_name) {
            query += ` AND course_name = $2`;
            params.push(course_name);
        }

        query += ` ORDER BY saved_at DESC`;

        const result = await pool.query(query, params);

        console.log('[WrongAnswers] 조회 결과:', result.rows.length, '개');

        res.json({
            success: true,
            wrongAnswers: result.rows
        });

    } catch (error) {
        console.error('[WrongAnswers] 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '목록 조회 실패'
        });
    }
});

// ========== 오답 수정 ==========
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const wrongAnswerId = req.params.id;
        const { wrong_reason, note } = req.body;

        console.log('[WrongAnswers] 수정 시도:', { userId, wrongAnswerId });

        const updateQuery = `
            UPDATE wrong_answers 
            SET wrong_reason = $1, note = $2, updated_at = NOW()
            WHERE id = $3 AND user_id = $4
            RETURNING *
        `;
        const result = await pool.query(updateQuery, [wrong_reason, note, wrongAnswerId, userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: '오답을 찾을 수 없습니다.'
            });
        }

        console.log('[WrongAnswers] 수정 성공:', wrongAnswerId);

        res.json({
            success: true,
            message: '오답이 수정되었습니다.',
            wrongAnswer: result.rows[0]
        });

    } catch (error) {
        console.error('[WrongAnswers] 수정 오류:', error);
        res.status(500).json({
            success: false,
            message: '수정 실패'
        });
    }
});

// ========== 오답 삭제 ==========
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const wrongAnswerId = req.params.id;

        console.log('[WrongAnswers] 삭제 시도:', { userId, wrongAnswerId });

        const deleteQuery = `
            DELETE FROM wrong_answers 
            WHERE id = $1 AND user_id = $2
            RETURNING *
        `;
        const result = await pool.query(deleteQuery, [wrongAnswerId, userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: '오답을 찾을 수 없습니다.'
            });
        }

        console.log('[WrongAnswers] 삭제 성공:', wrongAnswerId);

        res.json({
            success: true,
            message: '오답이 삭제되었습니다.'
        });

    } catch (error) {
        console.error('[WrongAnswers] 삭제 오류:', error);
        res.status(500).json({
            success: false,
            message: '삭제 실패'
        });
    }
});

// ========== 코스별 통계 ==========
router.get('/stats', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;

        const statsQuery = `
            SELECT course_name, COUNT(*) as count
            FROM wrong_answers
            WHERE user_id = $1
            GROUP BY course_name
            ORDER BY count DESC
        `;
        const result = await pool.query(statsQuery, [userId]);

        const stats = {};
        let total = 0;
        result.rows.forEach(row => {
            stats[row.course_name] = parseInt(row.count);
            total += parseInt(row.count);
        });

        res.json({
            success: true,
            stats: stats,
            total: total
        });

    } catch (error) {
        console.error('[WrongAnswers] 통계 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '통계 조회 실패'
        });
    }
});

module.exports = router;
