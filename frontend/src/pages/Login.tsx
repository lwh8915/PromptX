import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

/**
 * Login Page - 登录页面
 * 支持用户名或邮箱登录
 */
export default function Login() {
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(true);
    const { login, isLoading, error, clearError } = useAuthStore();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await login(identifier, password, rememberMe);
            navigate('/dashboard');
        } catch {
            // Error handled in store
        }
    };

    return (
        <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-6 relative overflow-hidden">
            {/* 背景光效 */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-[-30%] left-[20%] w-[500px] h-[500px] bg-[var(--primary-500)] opacity-10 blur-[150px] rounded-full" />
                <div className="absolute bottom-[-20%] right-[10%] w-[400px] h-[400px] bg-[var(--accent-500)] opacity-10 blur-[120px] rounded-full" />
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

            {/* 登录卡片 */}
            <div className="glass-card w-full max-w-md p-8 animate-scaleIn relative z-10">
                {/* Logo */}
                <div className="flex justify-center mb-8">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[var(--primary-500)] to-[var(--accent-500)] flex items-center justify-center shadow-lg">
                        <span className="text-white font-bold text-2xl">P</span>
                    </div>
                </div>

                {/* 标题 */}
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
                        欢迎回来
                    </h1>
                    <p className="text-[var(--text-secondary)]">
                        登录你的 Prompt Manager 账户
                    </p>
                </div>

                {/* 错误提示 */}
                {error && (
                    <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center justify-between animate-slideDown">
                        <span>{error}</span>
                        <button onClick={clearError} className="hover:text-red-300 transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                )}

                {/* 表单 */}
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                            用户名或邮箱
                        </label>
                        <input
                            type="text"
                            value={identifier}
                            onChange={(e) => setIdentifier(e.target.value)}
                            placeholder="输入用户名或邮箱"
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
                            placeholder="••••••••"
                            className="input"
                            required
                            minLength={6}
                        />
                    </div>

                    <div className="flex items-center justify-between text-sm">
                        <label className="flex items-center gap-2 text-[var(--text-secondary)] cursor-pointer">
                            <input
                                type="checkbox"
                                checked={rememberMe}
                                onChange={(e) => setRememberMe(e.target.checked)}
                                className="w-4 h-4 rounded border-[var(--border-primary)] bg-[var(--bg-tertiary)]"
                            />
                            记住我
                        </label>
                        <Link to="/forgot-password" className="text-[var(--primary-400)] hover:text-[var(--primary-300)] transition-colors">
                            忘记密码？
                        </Link>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="btn btn-primary w-full py-4 text-base disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? (
                            <span className="flex items-center gap-2">
                                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                登录中...
                            </span>
                        ) : (
                            '登录'
                        )}
                    </button>
                </form>

                {/* 分隔线 */}
                <div className="flex items-center gap-4 my-8">
                    <div className="flex-1 h-px bg-[var(--border-primary)]" />
                    <span className="text-sm text-[var(--text-tertiary)]">或</span>
                    <div className="flex-1 h-px bg-[var(--border-primary)]" />
                </div>

                {/* 注册链接 */}
                <p className="text-center text-[var(--text-secondary)]">
                    还没有账户？{' '}
                    <Link to="/register" className="text-[var(--primary-400)] hover:text-[var(--primary-300)] font-medium transition-colors">
                        立即注册
                    </Link>
                </p>
            </div>
        </div>
    );
}
