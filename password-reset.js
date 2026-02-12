/**
 * 파일명: password-reset.js
 * 목적: 비밀번호 재설정 API (Resend 이메일 발송)
 * 작성일: 2026-02-12
 * 
 * 흐름:
 * 1. 사용자가 이메일 입력 → 6자리 인증코드 발송
 * 2. 사용자가 인증코드 입력 → 검증
 * 3. 사용자가 새 비밀번호 입력 → 비밀번호 변경
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { pool } = require('./database');
const { Resend } = require('resend');

// Resend 초기화
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * 6자리 인증코드 생성
 */
function generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * POST /api/auth/reset-password
 * 이메일로 인증코드 발송
 */
router.post('/reset-password', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: '이메일을 입력해주세요.'
            });
        }

        console.log('[PasswordReset] 요청:', email);

        // 1. 이메일이 DB에 존재하는지 확인
        const userQuery = await pool.query(
            'SELECT id, name FROM users WHERE email = $1',
            [email.trim().toLowerCase()]
        );

        if (userQuery.rows.length === 0) {
            // 보안: 이메일 존재 여부를 노출하지 않음
            return res.json({
                success: true,
                message: '등록된 이메일이면 인증코드가 발송됩니다.'
            });
        }

        const user = userQuery.rows[0];
        const code = generateCode();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10분 후 만료

        // 2. 기존 코드 삭제 후 새 코드 저장
        await pool.query(
            'DELETE FROM password_reset_tokens WHERE user_id = $1',
            [user.id]
        );

        await pool.query(
            'INSERT INTO password_reset_tokens (user_id, email, code, expires_at) VALUES ($1, $2, $3, $4)',
            [user.id, email.trim().toLowerCase(), code, expiresAt]
        );

        // 3. Resend로 이메일 발송
        const emailResult = await resend.emails.send({
            from: 'Key Trend <onboarding@resend.dev>',
            to: email.trim(),
            subject: '[Key Trend] 비밀번호 재설정 인증코드',
            html: `
                <div style="font-family: 'Apple SD Gothic Neo', sans-serif; max-width: 480px; margin: 0 auto; padding: 30px;">
                    <h2 style="color: #667eea; text-align: center;">🎓 Key Trend</h2>
                    <h3 style="text-align: center;">비밀번호 재설정 인증코드</h3>
                    <p>${user.name}님, 비밀번호 재설정을 요청하셨습니다.</p>
                    <div style="background: #f0f3ff; border-radius: 12px; padding: 24px; text-align: center; margin: 20px 0;">
                        <p style="font-size: 14px; color: #666; margin: 0 0 8px 0;">인증코드</p>
                        <p style="font-size: 36px; font-weight: bold; color: #667eea; letter-spacing: 8px; margin: 0;">${code}</p>
                    </div>
                    <p style="color: #999; font-size: 13px; text-align: center;">
                        이 코드는 <strong>10분간</strong> 유효합니다.<br>
                        본인이 요청하지 않은 경우 이 이메일을 무시하세요.
                    </p>
                </div>
            `
        });

        console.log('[PasswordReset] 이메일 발송:', emailResult);

        res.json({
            success: true,
            message: '인증코드가 이메일로 발송되었습니다.'
        });

    } catch (error) {
        console.error('[PasswordReset] 오류:', error);
        res.status(500).json({
            success: false,
            message: '인증코드 발송에 실패했습니다. 잠시 후 다시 시도해주세요.'
        });
    }
});

/**
 * POST /api/auth/verify-reset-code
 * 인증코드 검증
 */
router.post('/verify-reset-code', async (req, res) => {
    try {
        const { email, code } = req.body;

        if (!email || !code) {
            return res.status(400).json({
                success: false,
                message: '이메일과 인증코드를 입력해주세요.'
            });
        }

        console.log('[PasswordReset] 코드 검증:', email);

        const tokenQuery = await pool.query(
            'SELECT * FROM password_reset_tokens WHERE email = $1 AND code = $2 AND expires_at > NOW()',
            [email.trim().toLowerCase(), code.trim()]
        );

        if (tokenQuery.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: '인증코드가 올바르지 않거나 만료되었습니다.'
            });
        }

        res.json({
            success: true,
            message: '인증코드가 확인되었습니다. 새 비밀번호를 입력하세요.'
        });

    } catch (error) {
        console.error('[PasswordReset] 코드 검증 오류:', error);
        res.status(500).json({
            success: false,
            message: '검증 실패'
        });
    }
});

/**
 * POST /api/auth/reset-password/confirm
 * 새 비밀번호 설정
 */
router.post('/reset-password/confirm', async (req, res) => {
    try {
        const { email, code, newPassword } = req.body;

        if (!email || !code || !newPassword) {
            return res.status(400).json({
                success: false,
                message: '모든 항목을 입력해주세요.'
            });
        }

        // 비밀번호 강도 검사
        if (newPassword.length < 8) {
            return res.status(400).json({
                success: false,
                message: '비밀번호는 최소 8자 이상이어야 합니다.'
            });
        }

        console.log('[PasswordReset] 비밀번호 변경:', email);

        // 1. 인증코드 재검증
        const tokenQuery = await pool.query(
            'SELECT user_id FROM password_reset_tokens WHERE email = $1 AND code = $2 AND expires_at > NOW()',
            [email.trim().toLowerCase(), code.trim()]
        );

        if (tokenQuery.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: '인증코드가 올바르지 않거나 만료되었습니다. 다시 요청해주세요.'
            });
        }

        const userId = tokenQuery.rows[0].user_id;

        // 2. 새 비밀번호 해시
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // 3. 비밀번호 업데이트
        await pool.query(
            'UPDATE users SET password = $1 WHERE id = $2',
            [hashedPassword, userId]
        );

        // 4. 사용된 인증코드 삭제
        await pool.query(
            'DELETE FROM password_reset_tokens WHERE user_id = $1',
            [userId]
        );

        console.log('[PasswordReset] 비밀번호 변경 완료:', userId);

        res.json({
            success: true,
            message: '비밀번호가 변경되었습니다. 새 비밀번호로 로그인하세요.'
        });

    } catch (error) {
        console.error('[PasswordReset] 비밀번호 변경 오류:', error);
        res.status(500).json({
            success: false,
            message: '비밀번호 변경 실패'
        });
    }
});

module.exports = router;
