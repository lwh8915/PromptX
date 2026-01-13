import { useState, useEffect } from 'react';

const slides = [
    {
        image: '/images/showcase/overview.png',
        title: '现代化界面',
        description: '极致流畅的 Prompt 管理体验'
    },
    {
        image: '/images/showcase/library.png',
        title: '公共模板库',
        description: '发现并收藏优质的 AI 提示词'
    },
    {
        image: '/images/showcase/ai.png',
        title: 'AI 智能优化',
        description: '一键优化提示词，提升生成质量'
    },
    {
        image: '/images/showcase/versions.png',
        title: '版本管理',
        description: '历史版本自动保存，随时回溯'
    },
    {
        image: '/images/showcase/reviews.png',
        title: '评价互动',
        description: '分享使用心得，建立社区连接'
    },
    {
        image: '/images/showcase/dashboard.png',
        title: '数据仪表盘',
        description: '全方位掌握您的使用数据'
    }
];

export default function ShowcaseCarousel() {
    const [current, setCurrent] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrent((prev) => (prev + 1) % slides.length);
        }, 5000);
        return () => clearInterval(timer);
    }, []);

    const goTo = (index: number) => {
        setCurrent(index);
    };

    return (
        <div className="relative w-full max-w-5xl mx-auto mt-20 mb-32 group">
            {/* Main Stage */}
            <div className="relative aspect-[16/9] md:aspect-[16/9] rounded-2xl overflow-hidden shadow-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)]">
                {slides.map((slide, index) => (
                    <div
                        key={index}
                        className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${index === current ? 'opacity-100 z-10' : 'opacity-0 z-0'
                            }`}
                    >
                        <img
                            src={slide.image}
                            alt={slide.title}
                            className="w-full h-full object-cover object-top"
                        />
                        {/* Overlay Gradient */}
                        <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-primary)]/90 via-transparent to-transparent opacity-80" />

                        {/* Content */}
                        <div className="absolute bottom-0 left-0 right-0 p-8 text-center md:text-left md:flex md:items-end md:justify-between">
                            <div className="mb-4 md:mb-0 transform transition-transform duration-700 delay-100 translate-y-0">
                                <h3 className="text-2xl font-bold text-white mb-2">{slide.title}</h3>
                                <p className="text-gray-200">{slide.description}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Navigation Dots */}
            <div className="absolute -bottom-10 left-1/2 transform -translate-x-1/2 flex items-center gap-3">
                {slides.map((_, index) => (
                    <button
                        key={index}
                        onClick={() => goTo(index)}
                        className={`transition-all duration-300 rounded-full ${index === current
                            ? 'w-8 h-2 bg-[var(--primary-500)]'
                            : 'w-2 h-2 bg-[var(--text-tertiary)] hover:bg-[var(--text-secondary)]'
                            }`}
                    />
                ))}
            </div>

            {/* Navigation Arrows */}
            <button
                onClick={() => setCurrent((prev) => (prev - 1 + slides.length) % slides.length)}
                className="absolute top-1/2 -left-4 md:-left-12 transform -translate-y-1/2 p-3 rounded-full bg-[var(--bg-glass)] border border-[var(--border-secondary)] text-[var(--text-secondary)] hover:text-[var(--primary-500)] hover:border-[var(--primary-500)] transition-all opacity-0 group-hover:opacity-100"
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
            </button>
            <button
                onClick={() => setCurrent((prev) => (prev + 1) % slides.length)}
                className="absolute top-1/2 -right-4 md:-right-12 transform -translate-y-1/2 p-3 rounded-full bg-[var(--bg-glass)] border border-[var(--border-secondary)] text-[var(--text-secondary)] hover:text-[var(--primary-500)] hover:border-[var(--primary-500)] transition-all opacity-0 group-hover:opacity-100"
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
            </button>
        </div>
    );
}
