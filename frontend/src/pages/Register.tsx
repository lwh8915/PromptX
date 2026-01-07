import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { authApi } from '../api/client';

/**
 * Register Page - 注册页面
 * 包含安全问题设置
 */
export default function Register() {
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [securityQuestion, setSecurityQuestion] = useState('');
    const [securityAnswer, setSecurityAnswer] = useState('');
    const [securityQuestions, setSecurityQuestions] = useState<string[]>([]);
    const [localError, setLocalError] = useState('');
    const { register, isLoading, error, clearError } = useAuthStore();
    const navigate = useNavigate();

    // 获取安全问题列表
    useEffect(() => {
        const fetchQuestions = async () => {
            try {
                const data = await authApi.getSecurityQuestions();
                setSecurityQuestions(data.questions);
                if (data.questions.length > 0) {
                    setSecurityQuestion(data.questions[0]);
                }
            } catch {
                // 使用默认问题
                const defaultQuestions = [
                    "您的小学校名是什么？",
                    "您母亲的姓名是什么？",
                    "您的第一只宠物叫什么名字？"
                ];
                setSecurityQuestions(defaultQuestions);
                setSecurityQuestion(defaultQuestions[0]);
            }
        };
        fetchQuestions();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLocalError('');

        if (password !== confirmPassword) {
            setLocalError('两次输入的密码不一致');
            return;
        }

        if (!securityAnswer.trim()) {
            setLocalError('请回答安全问题');
            return;
        }

        try {
            await register(email, username, password, securityQuestion, securityAnswer);
            navigate('/dashboard');
        } catch {
            // Error handled in store
        }
    };

    const displayError = localError || error;

    return (
        <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-6 relative overflow-hidden">
            {/* 背景光效 */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-[-20%] right-[20%] w-[500px] h-[500px] bg-[var(--accent-500)] opacity-10 blur-[150px] rounded-full" />
                <div className="absolute bottom-[-30%] left-[10%] w-[400px] h-[400px] bg-[var(--primary-500)] opacity-10 blur-[120px] rounded-full" />
            </div>

            {/* 返回首页 */}
            <Link
                to="/"
                className="absolute top-6 left-6 flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors z-10"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                返回首页
            </Link>

            {/* 注册卡片 */}
            <div className="glass-card w-full max-w-md p-8 animate-scaleIn relative z-10 max-h-[90vh] overflow-y-auto">
                {/* Logo */}
                <div className="flex justify-center mb-6">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[var(--primary-500)] to-[var(--accent-500)] flex items-center justify-center shadow-lg">
                        <span className="text-white font-bold text-2xl">P</span>
                    </div>
                </div>

                {/* 标题 */}
                <div className="text-center mb-6">
                    <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
                        创建账户
                    </h1>
                    <p className="text-[var(--text-secondary)]">
                        开始使用 Prompt Manager
                    </p>
                </div>

                {/* 错误提示 */}
                {displayError && (
                    <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center justify-between animate-slideDown">
                        <span>{displayError}</span>
                        <button
                            onClick={() => { clearError(); setLocalError(''); }}
                            className="hover:text-red-300 transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                )}

                {/* 表单 */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                            用户名
                        </label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="你的用户名"
                            className="input"
                            required
                            minLength={3}
                            maxLength={50}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                            邮箱地址
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="your@email.com"
                            className="input"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                            密码
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="至少 6 个字符"
                            className="input"
                            required
                            minLength={6}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                            确认密码
                        </label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="再次输入密码"
                            className="input"
                            required
                            minLength={6}
                        />
                    </div>

                    {/* 安全问题 */}
                    <div className="border-t border-[var(--border-primary)] pt-4 mt-4">
                        <p className="text-sm text-[var(--text-tertiary)] mb-3">
                            设置安全问题（用于找回密码）
                        </p>
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                                安全问题
                            </label>
                            <select
                                value={securityQuestion}
                                onChange={(e) => setSecurityQuestion(e.target.value)}
                                className="input"
                                required
                            >
                                {securityQuestions.map((q, i) => (
                                    <option key={i} value={q}>{q}</option>
                                ))}
                            </select>
                        </div>
                        <div className="mt-3">
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                                答案
                            </label>
                            <input
                                type="text"
                                value={securityAnswer}
                                onChange={(e) => setSecurityAnswer(e.target.value)}
                                placeholder="请输入答案"
                                className="input"
                                required
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="btn btn-primary w-full py-4 text-base disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                    >
                        {isLoading ? (
                            <span className="flex items-center gap-2">
                                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                注册中...
                            </span>
                        ) : (
                            '创建账户'
                        )}
                    </button>
                </form>

                {/* 服务条款 */}
                <p className="text-xs text-[var(--text-tertiary)] text-center mt-4">
                    注册即表示你同意我们的{' '}
                    <a href="#" className="text-[var(--primary-400)] hover:underline">服务条款</a>
                    {' '}和{' '}
                    <a href="#" className="text-[var(--primary-400)] hover:underline">隐私政策</a>
                </p>

                {/* 分隔线 */}
                <div className="flex items-center gap-4 my-6">
                    <div className="flex-1 h-px bg-[var(--border-primary)]" />
                    <span className="text-sm text-[var(--text-tertiary)]">或</span>
                    <div className="flex-1 h-px bg-[var(--border-primary)]" />
                </div>

                {/* 登录链接 */}
                <p className="text-center text-[var(--text-secondary)]">
                    已有账户？{' '}
                    <Link to="/login" className="text-[var(--primary-400)] hover:text-[var(--primary-300)] font-medium transition-colors">
                        立即登录
                    </Link>
                </p>
            </div>
        </div>
    );
}
