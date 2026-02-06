/**
 * 파일명: saved-problems.js
 * 목적: 저장한 문제 API
 * 작성일: 2026-02-07
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('./auth');
const { pool } = require('./database');

// ========== 문제 저장 ==========
router.post('/save', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { 
            course_name,
            problem_number,
            problem_url,
            memo
        } = req.body;

        console.log('[SavedProblems] 저장 시도:', { userId, course_name, problem_number });

        if (!course_name || !problem_number || !problem_url) {
            return res.status(400).json({
                success: false,
                message: '코스명, 문제번호, URL이 필요합니다.'
            });
        }

        // 중복 체크
        const checkQuery = `
            SELECT id FROM saved_problems 
            WHERE user_id = $1 AND course_name = $2 AND problem_number = $3
        `;
        const checkResult = await pool.query(checkQuery, [userId, course_name, problem_number]);

        if (checkResult.rows.length > 0) {
            return res.json({
                success: false,
                message: '이미 저장된 문제입니다.'
            });
        }

        // 문제 저장
        const insertQuery = `
            INSERT INTO saved_problems 
            (user_id, course_name, problem_number, problem_url, memo, saved_at)
            VALUES ($1, $2, $3, $4, $5, NOW())
            RETURNING *
        `;
        const result = await pool.query(insertQuery, [
            userId,
            course_name,
            problem_number,
            problem_url,
            memo || null
        ]);

        console.log('[SavedProblems] 저장 성공:', result.rows[0].id);

        res.json({
            success: true,
            message: '문제가 저장되었습니다!',
            problem: result.rows[0]
        });

    } catch (error) {
        console.error('[SavedProblems] 저장 오류:', error);
        res.status(500).json({
            success: false,
            message: '문제 저장 실패'
        });
    }
});

// ========== 저장된 문제 목록 조회 ==========
router.get('/list', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { course_name } = req.query;

        console.log('[SavedProblems] 목록 조회:', { userId, course_name });

        let query = `
            SELECT * FROM saved_problems 
            WHERE user_id = $1
        `;
        const params = [userId];

        // 코스명 필터
        if (course_name) {
            query += ` AND course_name = $2`;
            params.push(course_name);
        }

        query += ` ORDER BY saved_at DESC`;

        const result = await pool.query(query, params);

        console.log('[SavedProblems] 조회 결과:', result.rows.length, '개');

        res.json({
            success: true,
            problems: result.rows
        });

    } catch (error) {
        console.error('[SavedProblems] 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '목록 조회 실패'
        });
    }
});

// ========== 저장된 문제 삭제 ==========
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const problemId = req.params.id;

        console.log('[SavedProblems] 삭제 시도:', { userId, problemId });

        const deleteQuery = `
            DELETE FROM saved_problems 
            WHERE id = $1 AND user_id = $2
            RETURNING *
        `;
        const result = await pool.query(deleteQuery, [problemId, userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: '문제를 찾을 수 없습니다.'
            });
        }

        console.log('[SavedProblems] 삭제 성공:', problemId);

        res.json({
            success: true,
            message: '문제가 삭제되었습니다.'
        });

    } catch (error) {
        console.error('[SavedProblems] 삭제 오류:', error);
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
            FROM saved_problems
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
        console.error('[SavedProblems] 통계 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '통계 조회 실패'
        });
    }
});

module.exports = router;
