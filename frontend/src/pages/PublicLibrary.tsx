import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { publicPromptApi, type PublicPrompt, type PublicPromptCreate } from '../api/client';
import Toast from '../components/ui/Toast';
import ReviewSection from '../components/shared/ReviewSection';

type SortBy = 'latest' | 'likes' | 'downloads';

/**
 * PublicLibrary - 公共提示词库页面
 * 展示所有已审核通过的公共提示词，支持搜索、分类筛选、排序、点赞、下载
 * 管理员可直接新建公共提示词
 */
export default function PublicLibrary() {
    const navigate = useNavigate();
    const { isAuthenticated, checkAuth, user } = useAuthStore();

    // 数据状态
    const [prompts, setPrompts] = useState<PublicPrompt[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const pageSize = 20;

    // 筛选状态
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [sortBy, setSortBy] = useState<SortBy>('latest');

    // UI 状态
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [viewingPrompt, setViewingPrompt] = useState<PublicPrompt | null>(null);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);
    const [likingId, setLikingId] = useState<string | null>(null);

    // 管理员创建弹窗状态
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createForm, setCreateForm] = useState<PublicPromptCreate>({
        title: '',
        content: '',
        description: '',
        tags: [],
        category: '其他'
    });
    const [tagInput, setTagInput] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    const isAdmin = user?.is_admin || false;

    // 检查认证
    useEffect(() => {
        checkAuth();
    }, [checkAuth]);

    useEffect(() => {
        if (!isAuthenticated) {
            navigate('/login');
        }
    }, [isAuthenticated, navigate]);

    // 加载分类
    useEffect(() => {
        const loadCategories = async () => {
            try {
                const cats = await publicPromptApi.getCategories();
                setCategories(cats);
            } catch (error) {
                console.error('Failed to load categories:', error);
            }
        };
        if (isAuthenticated) {
            loadCategories();
        }
    }, [isAuthenticated]);

    // 加载提示词
    const fetchPrompts = async () => {
        setIsLoading(true);
        try {
            const result = await publicPromptApi.getAll({
                category: selectedCategory || undefined,
                search: searchQuery || undefined,
                sort_by: sortBy,
                page,
                page_size: pageSize
            });
            setPrompts(result.items);
            setTotal(result.total);
        } catch (error) {
            console.error('Failed to fetch public prompts:', error);
            setToast({ message: '加载失败，请重试', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isAuthenticated) {
            fetchPrompts();
        }
    }, [isAuthenticated, selectedCategory, searchQuery, sortBy, page]);

    // 搜索防抖
    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchInput !== searchQuery) {
                setSearchQuery(searchInput);
                setPage(1);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [searchInput]);

    // 下载到个人库
    const handleDownload = async (prompt: PublicPrompt) => {
        setDownloadingId(prompt.id);
        try {
            await publicPromptApi.download(prompt.id);
            setToast({ message: '已添加到我的提示词库', type: 'success' });
            fetchPrompts();
        } catch (error: any) {
            const message = error.response?.data?.detail || '下载失败';
            setToast({ message, type: 'error' });
        } finally {
            setDownloadingId(null);
        }
    };

    // 点赞/取消点赞
    const handleLike = async (e: React.MouseEvent, prompt: PublicPrompt) => {
        e.stopPropagation();
        setLikingId(prompt.id);
        try {
            if (prompt.is_liked) {
                await publicPromptApi.unlike(prompt.id);
            } else {
                await publicPromptApi.like(prompt.id);
            }
            // 更新本地状态
            setPrompts(prev => prev.map(p =>
                p.id === prompt.id
                    ? {
                        ...p,
                        is_liked: !p.is_liked,
                        like_count: p.is_liked ? p.like_count - 1 : p.like_count + 1
                    }
                    : p
            ));
            // 如果正在查看这个提示词，也更新它
            if (viewingPrompt?.id === prompt.id) {
                setViewingPrompt(prev => prev ? {
                    ...prev,
                    is_liked: !prev.is_liked,
                    like_count: prev.is_liked ? prev.like_count - 1 : prev.like_count + 1
                } : null);
            }
        } catch (error: any) {
            const message = error.response?.data?.detail || '操作失败';
            setToast({ message, type: 'error' });
        } finally {
            setLikingId(null);
        }
    };

    // 管理员创建提示词
    const handleCreate = async () => {
        if (!createForm.title.trim() || !createForm.content.trim()) {
            setToast({ message: '标题和内容不能为空', type: 'error' });
            return;
        }

        setIsCreating(true);
        try {
            await publicPromptApi.create(createForm);
            setToast({ message: '创建成功', type: 'success' });
            setShowCreateModal(false);
            setCreateForm({ title: '', content: '', description: '', tags: [], category: '其他' });
            setTagInput('');
            fetchPrompts();
        } catch (error: any) {
            const message = error.response?.data?.detail || '创建失败';
            setToast({ message, type: 'error' });
        } finally {
            setIsCreating(false);
        }
    };

    // 添加标签
    const handleAddTag = () => {
        const tag = tagInput.trim();
        if (tag && !createForm.tags.includes(tag)) {
            setCreateForm(prev => ({ ...prev, tags: [...prev.tags, tag] }));
            setTagInput('');
        }
    };

    // 移除标签
    const handleRemoveTag = (tag: string) => {
        setCreateForm(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }));
    };

    const totalPages = Math.ceil(total / pageSize);

    const sortOptions: { value: SortBy; label: string }[] = [
        { value: 'latest', label: '最新发布' },
        { value: 'likes', label: '最多点赞' },
        { value: 'downloads', label: '最多下载' },
    ];

    return (
        <div className="min-h-screen bg-[var(--bg-primary)]">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-[var(--bg-secondary)]/80 backdrop-blur-xl border-b border-[var(--border-primary)]">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        {/* 返回按钮 */}
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            <span>返回</span>
                        </button>

                        <h1 className="text-xl font-bold text-[var(--text-primary)]">公共提示词库</h1>

                        {/* 右侧按钮区域 */}
                        <div className="flex items-center gap-3">
                            {/* 管理员新建按钮 */}
                            {isAdmin && (
                                <button
                                    onClick={() => setShowCreateModal(true)}
                                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[var(--primary-500)] to-[var(--primary-600)] text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    新建提示词
                                </button>
                            )}
                            {/* 搜索框 */}
                            <div className="relative w-64">
                                <input
                                    type="text"
                                    placeholder="搜索..."
                                    value={searchInput}
                                    onChange={(e) => setSearchInput(e.target.value)}
                                    className="w-full px-4 py-2 pl-10 bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-500)] focus:border-transparent transition-all"
                                />
                                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Category Tabs */}
            <div className="border-b border-[var(--border-primary)] bg-[var(--bg-secondary)]">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex gap-1 py-2 overflow-x-auto scrollbar-hide">
                        <button
                            onClick={() => { setSelectedCategory(''); setPage(1); }}
                            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${!selectedCategory
                                ? 'bg-[var(--primary-500)] text-white'
                                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                                }`}
                        >
                            全部
                        </button>
                        {categories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => { setSelectedCategory(cat); setPage(1); }}
                                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${selectedCategory === cat
                                    ? 'bg-[var(--primary-500)] text-white'
                                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                                    }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Stats & Sort */}
                <div className="flex items-center justify-between mb-6">
                    <div className="text-[var(--text-secondary)] text-sm">
                        共 {total} 个公共提示词
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-[var(--text-muted)]">排序：</span>
                        <select
                            value={sortBy}
                            onChange={(e) => { setSortBy(e.target.value as SortBy); setPage(1); }}
                            className="px-3 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-500)]"
                        >
                            {sortOptions.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Loading */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--primary-500)] border-t-transparent"></div>
                    </div>
                ) : prompts.length === 0 ? (
                    <div className="text-center py-20">
                        <svg className="w-16 h-16 mx-auto text-[var(--text-muted)] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        <p className="text-[var(--text-muted)]">暂无公共提示词</p>
                    </div>
                ) : (
                    /* Cards Grid */
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {prompts.map(prompt => (
                            <div
                                key={prompt.id}
                                className="group bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl p-4 hover:border-[var(--primary-500)]/50 hover:shadow-lg hover:shadow-[var(--primary-500)]/5 transition-all cursor-pointer"
                                onClick={() => setViewingPrompt(prompt)}
                            >
                                {/* Title */}
                                <h3 className="font-semibold text-[var(--text-primary)] mb-2 line-clamp-1">
                                    {prompt.title}
                                </h3>

                                {/* Description */}
                                <p className="text-sm text-[var(--text-secondary)] mb-3 line-clamp-2 min-h-[2.5rem]">
                                    {prompt.description || prompt.content.slice(0, 100)}
                                </p>

                                {/* Tags */}
                                <div className="flex flex-wrap gap-1 mb-3 min-h-[1.5rem]">
                                    {prompt.tags.slice(0, 3).map(tag => (
                                        <span
                                            key={tag}
                                            className="px-2 py-0.5 text-xs bg-[var(--primary-500)]/10 text-[var(--primary-400)] rounded-full"
                                        >
                                            {tag}
                                        </span>
                                    ))}
                                </div>

                                {/* Footer with Stats */}
                                <div className="flex items-center justify-between text-xs text-[var(--text-muted)] mb-3">
                                    <span className="flex items-center gap-1">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                        {prompt.author_name}
                                    </span>
                                    <div className="flex items-center gap-3">
                                        {/* Rating */}
                                        <span className="flex items-center gap-1 text-yellow-500">
                                            <svg className="w-3.5 h-3.5" fill={prompt.avg_rating > 0 ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                            </svg>
                                            <span className={prompt.avg_rating > 0 ? '' : 'text-[var(--text-muted)]'}>
                                                {prompt.avg_rating > 0 ? prompt.avg_rating.toFixed(1) : '-'}
                                            </span>
                                            <span className="text-[var(--text-muted)]">({prompt.review_count})</span>
                                        </span>
                                        {/* Like Count */}
                                        <button
                                            onClick={(e) => handleLike(e, prompt)}
                                            disabled={likingId === prompt.id}
                                            className={`flex items-center gap-1 transition-colors ${prompt.is_liked
                                                ? 'text-red-500'
                                                : 'hover:text-red-500'
                                                }`}
                                        >
                                            <svg
                                                className="w-3.5 h-3.5"
                                                fill={prompt.is_liked ? "currentColor" : "none"}
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                            </svg>
                                            {prompt.like_count}
                                        </button>
                                        {/* Download Count */}
                                        <span className="flex items-center gap-1">
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                            </svg>
                                            {prompt.download_count}
                                        </span>
                                    </div>
                                </div>

                                {/* Download Button */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDownload(prompt);
                                    }}
                                    disabled={downloadingId === prompt.id}
                                    className="w-full py-2 bg-gradient-to-r from-[var(--primary-500)] to-[var(--primary-600)] text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
                                >
                                    {downloadingId === prompt.id ? '下载中...' : '添加到我的库'}
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex justify-center gap-2 mt-8">
                        <button
                            onClick={() => setPage(Math.max(1, page - 1))}
                            disabled={page === 1}
                            className="px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-secondary)] disabled:opacity-50 hover:border-[var(--primary-500)] transition-colors"
                        >
                            上一页
                        </button>
                        <span className="px-4 py-2 text-[var(--text-secondary)]">
                            {page} / {totalPages}
                        </span>
                        <button
                            onClick={() => setPage(Math.min(totalPages, page + 1))}
                            disabled={page === totalPages}
                            className="px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-secondary)] disabled:opacity-50 hover:border-[var(--primary-500)] transition-colors"
                        >
                            下一页
                        </button>
                    </div>
                )}
            </main>

            {/* View Modal */}
            {viewingPrompt && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-[var(--bg-secondary)] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden border border-[var(--border-primary)]">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-6 border-b border-[var(--border-primary)]">
                            <h2 className="text-xl font-bold text-[var(--text-primary)]">{viewingPrompt.title}</h2>
                            <button
                                onClick={() => setViewingPrompt(null)}
                                className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
                            >
                                <svg className="w-5 h-5 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto max-h-[60vh]">
                            {/* Meta */}
                            <div className="flex flex-wrap gap-2 mb-4">
                                <span className="px-3 py-1 bg-[var(--primary-500)]/10 text-[var(--primary-400)] rounded-full text-sm">
                                    {viewingPrompt.category}
                                </span>
                                {viewingPrompt.tags.map(tag => (
                                    <span key={tag} className="px-3 py-1 bg-[var(--bg-tertiary)] text-[var(--text-secondary)] rounded-full text-sm">
                                        {tag}
                                    </span>
                                ))}
                            </div>

                            {/* Content */}
                            <div className="bg-[var(--bg-tertiary)] rounded-xl p-4 mb-4">
                                <pre className="whitespace-pre-wrap text-[var(--text-primary)] font-mono text-sm">
                                    {viewingPrompt.content}
                                </pre>
                            </div>

                            {/* Author & Stats */}
                            <div className="flex items-center justify-between text-sm text-[var(--text-muted)]">
                                <span>作者：{viewingPrompt.author_name}</span>
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={(e) => handleLike(e, viewingPrompt)}
                                        disabled={likingId === viewingPrompt.id}
                                        className={`flex items-center gap-1 transition-colors ${viewingPrompt.is_liked
                                            ? 'text-red-500'
                                            : 'hover:text-red-500'
                                            }`}
                                    >
                                        <svg
                                            className="w-4 h-4"
                                            fill={viewingPrompt.is_liked ? "currentColor" : "none"}
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                        </svg>
                                        {viewingPrompt.like_count} 点赞
                                    </button>
                                    <span>下载量：{viewingPrompt.download_count}</span>
                                </div>
                            </div>

                            {/* Review Section */}
                            <ReviewSection
                                prompt={viewingPrompt}
                                onToast={(message, type) => setToast({ message, type })}
                            />
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 border-t border-[var(--border-primary)] flex gap-3">
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(viewingPrompt.content);
                                    setToast({ message: '已复制到剪贴板', type: 'success' });
                                }}
                                className="flex-1 py-3 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-xl font-medium hover:bg-[var(--bg-tertiary)]/80 transition-colors"
                            >
                                复制内容
                            </button>
                            <button
                                onClick={() => {
                                    handleDownload(viewingPrompt);
                                    setViewingPrompt(null);
                                }}
                                disabled={downloadingId === viewingPrompt.id}
                                className="flex-1 py-3 bg-gradient-to-r from-[var(--primary-500)] to-[var(--primary-600)] text-white rounded-xl font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                            >
                                添加到我的库
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Admin Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-[var(--bg-secondary)] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden border border-[var(--border-primary)]">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-6 border-b border-[var(--border-primary)]">
                            <h2 className="text-xl font-bold text-[var(--text-primary)]">新建公共提示词</h2>
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
                            >
                                <svg className="w-5 h-5 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto max-h-[60vh] space-y-4">
                            {/* Title */}
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">标题 *</label>
                                <input
                                    type="text"
                                    value={createForm.title}
                                    onChange={(e) => setCreateForm(prev => ({ ...prev, title: e.target.value }))}
                                    placeholder="输入提示词标题"
                                    className="w-full px-4 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded-xl text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-500)]"
                                />
                            </div>

                            {/* Content */}
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">内容 *</label>
                                <textarea
                                    value={createForm.content}
                                    onChange={(e) => setCreateForm(prev => ({ ...prev, content: e.target.value }))}
                                    placeholder="输入提示词内容"
                                    rows={6}
                                    className="w-full px-4 py-3 bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded-xl text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-500)] resize-none font-mono text-sm"
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">描述</label>
                                <input
                                    type="text"
                                    value={createForm.description || ''}
                                    onChange={(e) => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
                                    placeholder="简短描述这个提示词的用途"
                                    className="w-full px-4 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded-xl text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-500)]"
                                />
                            </div>

                            {/* Category */}
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">分类</label>
                                <select
                                    value={createForm.category}
                                    onChange={(e) => setCreateForm(prev => ({ ...prev, category: e.target.value }))}
                                    className="w-full px-4 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-500)]"
                                >
                                    {categories.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Tags */}
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">标签</label>
                                <div className="flex gap-2 mb-2">
                                    <input
                                        type="text"
                                        value={tagInput}
                                        onChange={(e) => setTagInput(e.target.value)}
                                        placeholder="输入标签后按回车添加"
                                        className="flex-1 px-4 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded-xl text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-500)]"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleAddTag();
                                            }
                                        }}
                                    />
                                    <button
                                        onClick={handleAddTag}
                                        className="px-4 py-2.5 bg-[var(--primary-500)] text-white rounded-xl font-medium hover:opacity-90"
                                    >
                                        添加
                                    </button>
                                </div>
                                {createForm.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {createForm.tags.map(tag => (
                                            <span
                                                key={tag}
                                                className="flex items-center gap-1 px-3 py-1 bg-[var(--primary-500)]/10 text-[var(--primary-400)] rounded-full text-sm"
                                            >
                                                {tag}
                                                <button
                                                    onClick={() => handleRemoveTag(tag)}
                                                    className="hover:text-red-500"
                                                >
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 border-t border-[var(--border-primary)] flex gap-3">
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="flex-1 py-3 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-xl font-medium hover:bg-[var(--bg-tertiary)]/80 transition-colors"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleCreate}
                                disabled={isCreating || !createForm.title.trim() || !createForm.content.trim()}
                                className="flex-1 py-3 bg-gradient-to-r from-[var(--primary-500)] to-[var(--primary-600)] text-white rounded-xl font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                            >
                                {isCreating ? '创建中...' : '创建'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast */}
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
        </div>
    );
}
