// ===================================================================
// 저장한 문제 기능 - 백엔드 API
// ===================================================================

const express = require('express');
const router = express.Router();
const { verifyToken } = require('./auth');
const { supabase } = require('./supabase-client');

// ===================================================================
// 1. 문제 저장 API
// ===================================================================
router.post('/save', verifyToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { 
            course_name,      // "빈칸500제"
            problem_number,   // 25
            problem_url,      // 전체 URL
            memo              // 선택사항
        } = req.body;

        // 필수 항목 체크
        if (!course_name || !problem_number || !problem_url) {
            return res.status(400).json({
                success: false,
                message: '코스명, 문제번호, URL이 필요합니다.'
            });
        }

        // 중복 체크 (같은 문제를 이미 저장했는지)
        const { data: existing, error: checkError } = await supabase
            .from('saved_problems')
            .select('id')
            .eq('user_id', userId)
            .eq('course_name', course_name)
            .eq('problem_number', problem_number)
            .single();

        if (existing) {
            return res.json({
                success: false,
                message: '이미 저장된 문제입니다.'
            });
        }

        // 문제 저장
        const { data, error } = await supabase
            .from('saved_problems')
            .insert([
                {
                    user_id: userId,
                    course_name: course_name,
                    problem_number: problem_number,
                    problem_url: problem_url,
                    memo: memo || null,
                    saved_at: new Date().toISOString()
                }
            ])
            .select();

        if (error) {
            console.error('저장 오류:', error);
            return res.status(500).json({
                success: false,
                message: '문제 저장 실패'
            });
        }

        res.json({
            success: true,
            message: '문제가 저장되었습니다!',
            problem: data[0]
        });

    } catch (error) {
        console.error('문제 저장 에러:', error);
        res.status(500).json({
            success: false,
            message: '서버 오류'
        });
    }
});

// ===================================================================
// 2. 저장된 문제 목록 조회 API
// ===================================================================
router.get('/list', verifyToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { course_name } = req.query; // 필터링용 (선택)

        let query = supabase
            .from('saved_problems')
            .select('*')
            .eq('user_id', userId)
            .order('saved_at', { ascending: false });

        // 코스명 필터 (선택)
        if (course_name) {
            query = query.eq('course_name', course_name);
        }

        const { data, error } = await query;

        if (error) {
            console.error('조회 오류:', error);
            return res.status(500).json({
                success: false,
                message: '목록 조회 실패'
            });
        }

        res.json({
            success: true,
            problems: data || []
        });

    } catch (error) {
        console.error('목록 조회 에러:', error);
        res.status(500).json({
            success: false,
            message: '서버 오류'
        });
    }
});

// ===================================================================
// 3. 저장된 문제 삭제 API
// ===================================================================
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const problemId = req.params.id;

        // 본인의 문제인지 확인 후 삭제
        const { data, error } = await supabase
            .from('saved_problems')
            .delete()
            .eq('id', problemId)
            .eq('user_id', userId) // 본인 확인
            .select();

        if (error) {
            console.error('삭제 오류:', error);
            return res.status(500).json({
                success: false,
                message: '삭제 실패'
            });
        }

        if (!data || data.length === 0) {
            return res.status(404).json({
                success: false,
                message: '문제를 찾을 수 없습니다.'
            });
        }

        res.json({
            success: true,
            message: '문제가 삭제되었습니다.'
        });

    } catch (error) {
        console.error('문제 삭제 에러:', error);
        res.status(500).json({
            success: false,
            message: '서버 오류'
        });
    }
});

// ===================================================================
// 4. 코스별 통계 API (선택)
// ===================================================================
router.get('/stats', verifyToken, async (req, res) => {
    try {
        const userId = req.user.userId;

        const { data, error } = await supabase
            .from('saved_problems')
            .select('course_name')
            .eq('user_id', userId);

        if (error) {
            console.error('통계 조회 오류:', error);
            return res.status(500).json({
                success: false,
                message: '통계 조회 실패'
            });
        }

        // 코스별 개수 집계
        const stats = {};
        data.forEach(problem => {
            stats[problem.course_name] = (stats[problem.course_name] || 0) + 1;
        });

        res.json({
            success: true,
            stats: stats,
            total: data.length
        });

    } catch (error) {
        console.error('통계 조회 에러:', error);
        res.status(500).json({
            success: false,
            message: '서버 오류'
        });
    }
});

module.exports = router;