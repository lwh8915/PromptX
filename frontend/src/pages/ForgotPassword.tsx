import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../api/client';

type ResetMethod = 'email' | 'question';
type Step = 'input' | 'verify' | 'success';

/**
 * ForgotPassword Page - 忘记密码页面
 * 支持邮箱验证码和安全问题两种方式
 */
export default function ForgotPassword() {
    const navigate = useNavigate();

    // 状态
    const [identifier, setIdentifier] = useState('');
    const [method, setMethod] = useState<ResetMethod>('email');
    const [step, setStep] = useState<Step>('input');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    // 邮箱验证码方式
    const [email, setEmail] = useState('');
    const [code, setCode] = useState('');

    // 安全问题方式
    const [question, setQuestion] = useState('');
    const [answer, setAnswer] = useState('');
    const [maskedEmail, setMaskedEmail] = useState('');

    // 新密码
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // 第一步：输入用户名/邮箱并选择验证方式
    const handleStep1 = async () => {
        if (!identifier.trim()) {
            setError('请输入用户名或邮箱');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            if (method === 'email') {
                // 发送验证码
                const emailToUse = identifier.includes('@') ? identifier : '';
                if (!emailToUse) {
                    // 先获取安全问题以验证用户存在并获取脱敏邮箱
                    const data = await authApi.getSecurityQuestion(identifier);
                    setError(`请直接输入邮箱地址，或使用安全问题验证。该账户邮箱为：${data.email}`);
                    setIsLoading(false);
                    return;
                }
                await authApi.sendResetEmail(emailToUse);
                setEmail(emailToUse);
                setMessage('验证码已发送到您的邮箱');
                setStep('verify');
            } else {
                // 获取安全问题
                const data = await authApi.getSecurityQuestion(identifier);
                setQuestion(data.question);
                setMaskedEmail(data.email);
                setStep('verify');
            }
        } catch (err: any) {
            setError(err.response?.data?.detail || '请求失败，请检查输入');
        } finally {
            setIsLoading(false);
        }
    };

    // 第二步：验证并重置密码
    const handleStep2 = async () => {
        if (newPassword !== confirmPassword) {
            setError('两次输入的密码不一致');
            return;
        }

        if (newPassword.length < 6) {
            setError('密码至少需要6个字符');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            if (method === 'email') {
                await authApi.resetPasswordByCode(email, code, newPassword);
            } else {
                await authApi.resetPasswordByQuestion(identifier, answer, newPassword);
            }
            setStep('success');
        } catch (err: any) {
            setError(err.response?.data?.detail || '重置失败，请重试');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-6 relative overflow-hidden">
            {/* 背景光效 */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-[-30%] left-[20%] w-[500px] h-[500px] bg-[var(--primary-500)] opacity-10 blur-[150px] rounded-full" />
                <div className="absolute bottom-[-20%] right-[10%] w-[400px] h-[400px] bg-[var(--accent-500)] opacity-10 blur-[120px] rounded-full" />
            </div>

            {/* 返回登录 */}
            <Link
                to="/login"
                className="absolute top-6 left-6 flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors z-10"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                返回登录
            </Link>

            {/* 卡片 */}
            <div className="glass-card w-full max-w-md p-8 animate-scaleIn relative z-10">
                {/* Logo */}
                <div className="flex justify-center mb-6">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[var(--primary-500)] to-[var(--accent-500)] flex items-center justify-center shadow-lg">
                        <span className="text-white font-bold text-2xl">P</span>
                    </div>
                </div>

                {/* 标题 */}
                <div className="text-center mb-6">
                    <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
                        {step === 'success' ? '密码重置成功' : '找回密码'}
                    </h1>
                    <p className="text-[var(--text-secondary)]">
                        {step === 'input' && '选择验证方式重置密码'}
                        {step === 'verify' && (method === 'email' ? '输入验证码和新密码' : '回答安全问题并设置新密码')}
                        {step === 'success' && '您的密码已成功重置'}
                    </p>
                </div>

                {/* 错误提示 */}
                {error && (
                    <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                        {error}
                    </div>
                )}

                {/* 成功提示 */}
                {message && step === 'verify' && (
                    <div className="mb-6 p-4 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 text-sm">
                        {message}
                    </div>
                )}

                {/* 第一步：输入用户名和选择方式 */}
                {step === 'input' && (
                    <div className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                                用户名或邮箱
                            </label>
                            <input
                                type="text"
                                value={identifier}
                                onChange={(e) => setIdentifier(e.target.value)}
                                placeholder="输入您注册时使用的用户名或邮箱"
                                className="input"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-3">
                                选择验证方式
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setMethod('email')}
                                    className={`p-4 rounded-xl border-2 transition-all ${method === 'email'
                                            ? 'border-[var(--primary-500)] bg-[var(--primary-500)]/10'
                                            : 'border-[var(--border-primary)] hover:border-[var(--border-secondary)]'
                                        }`}
                                >
                                    <div className="text-2xl mb-2">📧</div>
                                    <div className="text-sm font-medium text-[var(--text-primary)]">邮箱验证码</div>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMethod('question')}
                                    className={`p-4 rounded-xl border-2 transition-all ${method === 'question'
                                            ? 'border-[var(--primary-500)] bg-[var(--primary-500)]/10'
                                            : 'border-[var(--border-primary)] hover:border-[var(--border-secondary)]'
                                        }`}
                                >
                                    <div className="text-2xl mb-2">🔐</div>
                                    <div className="text-sm font-medium text-[var(--text-primary)]">安全问题</div>
                                </button>
                            </div>
                        </div>

                        <button
                            onClick={handleStep1}
                            disabled={isLoading}
                            className="btn btn-primary w-full py-4 text-base disabled:opacity-50"
                        >
                            {isLoading ? '处理中...' : '下一步'}
                        </button>
                    </div>
                )}

                {/* 第二步：验证并重置 */}
                {step === 'verify' && (
                    <div className="space-y-5">
                        {method === 'email' ? (
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                                    验证码
                                </label>
                                <input
                                    type="text"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value)}
                                    placeholder="输入6位验证码"
                                    className="input text-center text-xl tracking-widest"
                                    maxLength={6}
                                />
                            </div>
                        ) : (
                            <>
                                <div className="p-4 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-secondary)]">
                                    <div className="text-sm text-[var(--text-tertiary)] mb-1">安全问题</div>
                                    <div className="font-medium text-[var(--text-primary)]">{question}</div>
                                    <div className="text-xs text-[var(--text-tertiary)] mt-2">账户邮箱：{maskedEmail}</div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                                        答案
                                    </label>
                                    <input
                                        type="text"
                                        value={answer}
                                        onChange={(e) => setAnswer(e.target.value)}
                                        placeholder="请输入安全问题的答案"
                                        className="input"
                                    />
                                </div>
                            </>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                                新密码
                            </label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="至少6个字符"
                                className="input"
                                minLength={6}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                                确认新密码
                            </label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="再次输入新密码"
                                className="input"
                                minLength={6}
                            />
                        </div>

                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => { setStep('input'); setError(''); }}
                                className="btn btn-secondary flex-1 py-4"
                            >
                                返回
                            </button>
                            <button
                                onClick={handleStep2}
                                disabled={isLoading}
                                className="btn btn-primary flex-1 py-4 disabled:opacity-50"
                            >
                                {isLoading ? '重置中...' : '重置密码'}
                            </button>
                        </div>
                    </div>
                )}

                {/* 成功 */}
                {step === 'success' && (
                    <div className="text-center space-y-6">
                        <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
                            <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <p className="text-[var(--text-secondary)]">
                            您的密码已成功重置，现在可以使用新密码登录了。
                        </p>
                        <button
                            onClick={() => navigate('/login')}
                            className="btn btn-primary w-full py-4 text-base"
                        >
                            去登录
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
