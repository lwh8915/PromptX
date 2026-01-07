import { Link } from 'react-router-dom';

/**
 * Landing Page - 产品展示页
 * UI UX Pro Max: 极致现代感、玻璃态设计、丰富微交互
 */
export default function Landing() {
    return (
        <div className="min-h-screen bg-[var(--bg-primary)] overflow-hidden">
            {/* 背景光效 */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-[var(--primary-500)] opacity-10 blur-[150px] rounded-full" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-[var(--accent-500)] opacity-10 blur-[150px] rounded-full" />
            </div>

            {/* 导航栏 */}
            <nav className="relative z-10 flex items-center justify-between px-6 md:px-12 py-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--primary-500)] to-[var(--accent-500)] flex items-center justify-center">
                        <span className="text-white font-bold text-lg">P</span>
                    </div>
                    <span className="text-xl font-bold text-[var(--text-primary)]">Prompt Manager</span>
                </div>

                <div className="flex items-center gap-4">
                    <a
                        href="https://github.com/lwh8915/PromptX"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-ghost text-sm"
                    >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                        </svg>
                        GitHub
                    </a>
                    <Link to="/login" className="btn btn-secondary text-sm">
                        登录
                    </Link>
                    <Link to="/register" className="btn btn-primary text-sm">
                        免费开始
                    </Link>
                </div>
            </nav>

            {/* Hero 区域 */}
            <main className="relative z-10 max-w-6xl mx-auto px-6 md:px-12 pt-20 md:pt-32 pb-20">
                <div className="text-center animate-slideUp">
                    {/* 标签 */}
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--bg-glass)] border border-[var(--border-primary)] mb-8">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-sm text-[var(--text-secondary)]">✨ 全新 AI 时代的提示词管理工具</span>
                    </div>

                    {/* 标题 */}
                    <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold leading-tight mb-6">
                        <span className="text-[var(--text-primary)]">管理你的</span>
                        <br />
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-[var(--primary-400)] via-[var(--accent-400)] to-[var(--primary-400)]">
                            AI 提示词
                        </span>
                    </h1>

                    {/* 描述 */}
                    <p className="text-lg md:text-xl text-[var(--text-secondary)] max-w-2xl mx-auto mb-12">
                        一键复制、智能分类、跨平台同步。让你的 AI 提示词井井有条，
                        <br className="hidden md:block" />
                        提升工作效率 10x。
                    </p>

                    {/* CTA 按钮 */}
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Link
                            to="/register"
                            className="btn btn-primary text-base px-8 py-4 rounded-xl shadow-lg hover:shadow-xl transition-all"
                        >
                            <span>🚀 立即开始</span>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                        </Link>
                        <a
                            href="#features"
                            className="btn btn-secondary text-base px-8 py-4 rounded-xl"
                        >
                            了解更多
                        </a>
                    </div>
                </div>

                {/* 功能展示卡片 */}
                <div id="features" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-32">
                    {[
                        {
                            icon: '🏷️',
                            title: '高级标签筛选',
                            description: '采用多维标签智能聚合逻辑，支持精准过滤与组合筛选，轻松定位你的灵感片段。',
                        },
                        {
                            icon: '📁',
                            title: '智能分类',
                            description: '支持多级嵌套分类和标签系统，让你的提示词井井有条。',
                        },
                        {
                            icon: '🔍',
                            title: '全局搜索',
                            description: '快速搜索标题、内容、描述，瞬间找到你需要的提示词。',
                        },
                        {
                            icon: '🔐',
                            title: '安全登录',
                            description: '支持用户名或邮箱登录，安全问题验证找回密码。',
                        },
                        {
                            icon: '⏱️',
                            title: '版本管理',
                            description: '自动保存历史版本，支持差异对比和一键恢复。',
                        },
                        {
                            icon: '🔄',
                            title: '跨平台同步',
                            description: 'Web、桌面、移动端无缝同步，随时随地访问你的提示词。',
                        },
                    ].map((feature, index) => (
                        <div
                            key={index}
                            className="glass-card p-8 group cursor-pointer"
                            style={{ animationDelay: `${index * 100}ms` }}
                        >
                            <div className="text-4xl mb-4 transform group-hover:scale-110 transition-transform duration-300">
                                {feature.icon}
                            </div>
                            <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-3">
                                {feature.title}
                            </h3>
                            <p className="text-[var(--text-secondary)] leading-relaxed">
                                {feature.description}
                            </p>
                        </div>
                    ))}
                </div>

                {/* 更多功能 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-16">
                    {[
                        { icon: '🔒', label: '安全加密' },
                        { icon: '🌙', label: '深色模式' },
                        { icon: '⚡', label: '极速响应' },
                        { icon: '🎨', label: '精美界面' },
                        { icon: '⭐', label: '收藏功能' },
                        { icon: '🏷️', label: '标签系统' },
                        { icon: '📊', label: '卡片/列表视图' },
                        { icon: '👁️', label: '提示词预览' },
                    ].map((item, index) => (
                        <div
                            key={index}
                            className="flex items-center gap-3 p-4 rounded-xl bg-[var(--bg-glass)] border border-[var(--border-secondary)] hover:border-[var(--border-primary)] transition-colors"
                        >
                            <span className="text-2xl">{item.icon}</span>
                            <span className="text-sm text-[var(--text-secondary)]">{item.label}</span>
                        </div>
                    ))}                </div>
            </main>

            {/* 页脚 */}
            <footer className="relative z-10 border-t border-[var(--border-secondary)] mt-20 py-8 px-6 md:px-12">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                    <p className="text-sm text-[var(--text-tertiary)]">
                        © 2024 Prompt Manager. All rights reserved.
                    </p>
                    <div className="flex items-center gap-6">
                        <a href="#" className="text-sm text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors">
                            隐私政策
                        </a>
                        <a href="#" className="text-sm text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors">
                            服务条款
                        </a>
                    </div>
                </div>
            </footer>
        </div>
    );
}
