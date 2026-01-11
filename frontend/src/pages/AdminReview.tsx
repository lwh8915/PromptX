import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { publicPromptApi, type PublicPrompt, type Review } from '../api/client';
import Toast from '../components/ui/Toast';

type TabType = 'pending' | 'approved' | 'rejected' | 'all' | 'categories' | 'reviews';

interface Category {
    id: string;
    name: string;
    sort_order: number;
    created_at: string;
}

/**
 * AdminReview - 管理员审核中心
 * 审核待发布的公共提示词 & 管理所有公共提示词 & 管理分类
 */
export default function AdminReview() {
    const navigate = useNavigate();
    const { isAuthenticated, checkAuth } = useAuthStore();

    // 数据状态
    const [prompts, setPrompts] = useState<PublicPrompt[]>([]);
    const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0, total: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const pageSize = 20;

    // 分类管理状态
    const [categories, setCategories] = useState<Category[]>([]);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);

    // 筛选状态
    const [activeTab, setActiveTab] = useState<TabType>('pending');
    const [searchQuery, setSearchQuery] = useState('');

    // UI 状态
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [viewingPrompt, setViewingPrompt] = useState<PublicPrompt | null>(null);
    const [rejectingPrompt, setRejectingPrompt] = useState<PublicPrompt | null>(null);
    const [rejectNote, setRejectNote] = useState('');
    const [deletingPrompt, setDeletingPrompt] = useState<PublicPrompt | null>(null);
    const [processingId, setProcessingId] = useState<string | null>(null);

    // 评论管理状态
    const [reviews, setReviews] = useState<Review[]>([]);
    const [reviewStats, setReviewStats] = useState({ total_reviews: 0, reported_reviews: 0, pending_reports: 0, overall_avg_rating: 0 });
    const [reviewFilter, setReviewFilter] = useState<'all' | 'reported'>('all');
    const [reviewPage, setReviewPage] = useState(1);
    const [reviewTotal, setReviewTotal] = useState(0);
    const [deletingReview, setDeletingReview] = useState<Review | null>(null);

    // 检查认证和权限
    useEffect(() => {
        checkAuth();
    }, [checkAuth]);

    useEffect(() => {
        if (!isAuthenticated) {
            navigate('/login');
        }
    }, [isAuthenticated, navigate]);

    // 加载统计信息
    const loadStats = async () => {
        try {
            const data = await publicPromptApi.getStats();
            setStats(data);
        } catch (error: any) {
            if (error.response?.status === 403) {
                setToast({ message: '需要管理员权限', type: 'error' });
                setTimeout(() => navigate('/dashboard'), 2000);
            }
        }
    };

    // 加载提示词列表
    const loadPrompts = async () => {
        if (activeTab === 'categories') return;

        setIsLoading(true);
        try {
            let result;
            if (activeTab === 'pending') {
                result = await publicPromptApi.getPending(page, pageSize);
            } else {
                const statusFilter = activeTab === 'all' ? undefined : activeTab;
                result = await publicPromptApi.getAllAdmin({
                    status: statusFilter,
                    search: searchQuery || undefined,
                    page,
                    page_size: pageSize
                });
            }
            setPrompts(result.items);
            setTotal(result.total);
        } catch (error: any) {
            if (error.response?.status === 403) {
                setToast({ message: '需要管理员权限', type: 'error' });
                setTimeout(() => navigate('/dashboard'), 2000);
            } else {
                setToast({ message: '加载失败', type: 'error' });
            }
        } finally {
            setIsLoading(false);
        }
    };

    // 加载分类列表
    const loadCategories = async () => {
        try {
            const data = await publicPromptApi.getAdminCategories();
            setCategories(data);
        } catch (error: any) {
            setToast({ message: '加载分类失败', type: 'error' });
        }
    };

    // 加载评论列表
    const loadReviews = async () => {
        setIsLoading(true);
        try {
            const result = await publicPromptApi.getAdminReviews({
                status: reviewFilter === 'reported' ? 'reported' : undefined,
                page: reviewPage,
                page_size: pageSize
            });
            setReviews(result.items);
            setReviewTotal(result.total);
        } catch (error: any) {
            setToast({ message: '加载评论失败', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    // 加载评论统计
    const loadReviewStats = async () => {
        try {
            const data = await publicPromptApi.getReviewStats();
            setReviewStats(data);
        } catch (error: any) {
            console.error('Failed to load review stats:', error);
        }
    };

    // 删除评论
    const handleDeleteReview = async () => {
        if (!deletingReview) return;

        setProcessingId(deletingReview.id);
        try {
            await publicPromptApi.deleteReview(deletingReview.id);
            setToast({ message: '删除成功', type: 'success' });
            setDeletingReview(null);
            loadReviews();
            loadReviewStats();
        } catch (error: any) {
            setToast({ message: error.response?.data?.detail || '删除失败', type: 'error' });
        } finally {
            setProcessingId(null);
        }
    };

    useEffect(() => {
        if (isAuthenticated) {
            loadStats();
            loadReviewStats();
        }
    }, [isAuthenticated]);

    useEffect(() => {
        if (isAuthenticated) {
            setPage(1);
            setReviewPage(1);
            if (activeTab === 'categories') {
                loadCategories();
            } else if (activeTab === 'reviews') {
                loadReviews();
            } else {
                loadPrompts();
            }
        }
    }, [isAuthenticated, activeTab, searchQuery, reviewFilter]);

    useEffect(() => {
        if (isAuthenticated && activeTab !== 'categories' && activeTab !== 'reviews') {
            loadPrompts();
        }
    }, [page]);

    useEffect(() => {
        if (isAuthenticated && activeTab === 'reviews') {
            loadReviews();
        }
    }, [reviewPage]);

    // 审核通过
    const handleApprove = async (prompt: PublicPrompt) => {
        setProcessingId(prompt.id);
        try {
            await publicPromptApi.approve(prompt.id);
            setToast({ message: '已通过审核', type: 'success' });
            loadStats();
            loadPrompts();
        } catch (error: any) {
            setToast({ message: error.response?.data?.detail || '操作失败', type: 'error' });
        } finally {
            setProcessingId(null);
        }
    };

    // 审核拒绝
    const handleReject = async () => {
        if (!rejectingPrompt) return;

        setProcessingId(rejectingPrompt.id);
        try {
            await publicPromptApi.reject(rejectingPrompt.id, rejectNote || undefined);
            setToast({ message: '已拒绝', type: 'success' });
            setRejectingPrompt(null);
            setRejectNote('');
            loadStats();
            loadPrompts();
        } catch (error: any) {
            setToast({ message: error.response?.data?.detail || '操作失败', type: 'error' });
        } finally {
            setProcessingId(null);
        }
    };

    // 删除提示词
    const handleDelete = async () => {
        if (!deletingPrompt) return;

        setProcessingId(deletingPrompt.id);
        try {
            await publicPromptApi.delete(deletingPrompt.id);
            setToast({ message: '删除成功', type: 'success' });
            setDeletingPrompt(null);
            loadStats();
            loadPrompts();
        } catch (error: any) {
            setToast({ message: error.response?.data?.detail || '删除失败', type: 'error' });
        } finally {
            setProcessingId(null);
        }
    };

    // 创建分类
    const handleCreateCategory = async () => {
        if (!newCategoryName.trim()) {
            setToast({ message: '请输入分类名称', type: 'error' });
            return;
        }

        try {
            await publicPromptApi.createCategory(newCategoryName.trim());
            setToast({ message: '创建成功', type: 'success' });
            setNewCategoryName('');
            loadCategories();
        } catch (error: any) {
            setToast({ message: error.response?.data?.detail || '创建失败', type: 'error' });
        }
    };

    // 删除分类
    const handleDeleteCategory = async () => {
        if (!deletingCategory) return;

        try {
            await publicPromptApi.deleteCategory(deletingCategory.id);
            setToast({ message: '删除成功', type: 'success' });
            setDeletingCategory(null);
            loadCategories();
        } catch (error: any) {
            setToast({ message: error.response?.data?.detail || '删除失败', type: 'error' });
        }
    };

    // 拖拽排序状态
    const [draggedCategory, setDraggedCategory] = useState<Category | null>(null);
    const [dragOverId, setDragOverId] = useState<string | null>(null);

    // 处理拖拽排序
    const handleDragStart = (e: React.DragEvent, cat: Category) => {
        setDraggedCategory(cat);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent, catId: string) => {
        e.preventDefault();
        if (draggedCategory && draggedCategory.id !== catId) {
            setDragOverId(catId);
        }
    };

    const handleDragLeave = () => {
        setDragOverId(null);
    };

    const handleDrop = async (e: React.DragEvent, targetCat: Category) => {
        e.preventDefault();
        setDragOverId(null);

        if (!draggedCategory || draggedCategory.id === targetCat.id) {
            setDraggedCategory(null);
            return;
        }

        // 重新排列分类
        const newCategories = [...categories];
        const draggedIndex = newCategories.findIndex(c => c.id === draggedCategory.id);
        const targetIndex = newCategories.findIndex(c => c.id === targetCat.id);

        // 移动元素
        newCategories.splice(draggedIndex, 1);
        newCategories.splice(targetIndex, 0, draggedCategory);

        // 更新本地状态
        setCategories(newCategories);
        setDraggedCategory(null);

        // 保存到服务器
        try {
            await publicPromptApi.reorderCategories(newCategories.map(c => c.id));
            setToast({ message: '排序已保存', type: 'success' });
        } catch (error: any) {
            setToast({ message: '保存排序失败', type: 'error' });
            loadCategories(); // 恢复原排序
        }
    };

    const handleDragEnd = () => {
        setDraggedCategory(null);
        setDragOverId(null);
    };

    const totalPages = Math.ceil(total / pageSize);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'pending':
                return <span className="px-2 py-1 text-xs bg-yellow-500/10 text-yellow-500 rounded-full">待审核</span>;
            case 'approved':
                return <span className="px-2 py-1 text-xs bg-green-500/10 text-green-500 rounded-full">已通过</span>;
            case 'rejected':
                return <span className="px-2 py-1 text-xs bg-red-500/10 text-red-500 rounded-full">已拒绝</span>;
            default:
                return null;
        }
    };

    const tabs: { key: TabType; label: string; count?: number }[] = [
        { key: 'pending', label: '待审核', count: stats.pending },
        { key: 'approved', label: '已通过', count: stats.approved },
        { key: 'rejected', label: '已拒绝', count: stats.rejected },
        { key: 'all', label: '全部', count: stats.total },
        { key: 'categories', label: '📂 分类管理' },
        { key: 'reviews', label: '💬 评论管理', count: reviewStats.reported_reviews },
    ];

    const reviewTotalPages = Math.ceil(reviewTotal / pageSize);

    return (
        <div className="min-h-screen bg-[var(--bg-primary)]">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-[var(--bg-secondary)]/80 backdrop-blur-xl border-b border-[var(--border-primary)]">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            <span>返回</span>
                        </button>

                        <h1 className="text-xl font-bold text-[var(--text-primary)]">审核中心</h1>

                        <div className="w-20"></div>
                    </div>
                </div>
            </header>

            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                {/* Tabs */}
                <div className="flex flex-wrap gap-2 mb-6">
                    {tabs.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`px-4 py-2 rounded-lg font-medium transition-all ${activeTab === tab.key
                                ? 'bg-[var(--primary-500)] text-white'
                                : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                }`}
                        >
                            {tab.label}
                            {tab.count !== undefined && (
                                <span className={`ml-2 px-1.5 py-0.5 text-xs rounded-full ${activeTab === tab.key
                                    ? 'bg-white/20 text-white'
                                    : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
                                    }`}>
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Categories Management Tab */}
                {activeTab === 'categories' ? (
                    <div className="space-y-6">
                        {/* Add Category */}
                        <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl p-5">
                            <h3 className="font-semibold text-[var(--text-primary)] mb-4">添加新分类</h3>
                            <div className="flex gap-3">
                                <input
                                    type="text"
                                    value={newCategoryName}
                                    onChange={(e) => setNewCategoryName(e.target.value)}
                                    placeholder="输入分类名称"
                                    maxLength={20}
                                    className="flex-1 px-4 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded-xl text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-500)]"
                                    onKeyDown={(e) => e.key === 'Enter' && handleCreateCategory()}
                                />
                                <button
                                    onClick={handleCreateCategory}
                                    className="px-6 py-2.5 bg-[var(--primary-500)] text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
                                >
                                    添加
                                </button>
                            </div>
                        </div>

                        {/* Category List */}
                        <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl overflow-hidden">
                            <div className="p-4 border-b border-[var(--border-primary)] flex items-center justify-between">
                                <h3 className="font-semibold text-[var(--text-primary)]">当前分类 ({categories.length})</h3>
                                <span className="text-xs text-[var(--text-muted)]">拖拽调整顺序</span>
                            </div>
                            <div className="divide-y divide-[var(--border-primary)]">
                                {categories.map((cat, index) => (
                                    <div
                                        key={cat.id}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, cat)}
                                        onDragOver={(e) => handleDragOver(e, cat.id)}
                                        onDragLeave={handleDragLeave}
                                        onDrop={(e) => handleDrop(e, cat)}
                                        onDragEnd={handleDragEnd}
                                        className={`flex items-center justify-between p-4 cursor-grab active:cursor-grabbing transition-colors ${draggedCategory?.id === cat.id
                                            ? 'opacity-50 bg-[var(--primary-500)]/10'
                                            : dragOverId === cat.id
                                                ? 'bg-[var(--primary-500)]/20 border-l-4 border-[var(--primary-500)]'
                                                : 'hover:bg-[var(--bg-tertiary)]/50'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                                            </svg>
                                            <span className="text-[var(--text-muted)] text-sm w-6">{index + 1}.</span>
                                            <span className="text-[var(--text-primary)] font-medium">{cat.name}</span>
                                            {cat.name === '其他' && (
                                                <span className="text-xs text-[var(--text-muted)]">(默认)</span>
                                            )}
                                        </div>
                                        {cat.name !== '其他' && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setDeletingCategory(cat);
                                                }}
                                                className="px-3 py-1.5 text-sm text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                            >
                                                删除
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : activeTab === 'reviews' ? (
                    <div className="space-y-6">
                        {/* Review Stats */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl p-4 text-center">
                                <div className="text-2xl font-bold text-[var(--text-primary)]">{reviewStats.total_reviews}</div>
                                <div className="text-xs text-[var(--text-muted)]">总评论数</div>
                            </div>
                            <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl p-4 text-center">
                                <div className="text-2xl font-bold text-yellow-500">{reviewStats.overall_avg_rating.toFixed(1)}</div>
                                <div className="text-xs text-[var(--text-muted)]">平均评分</div>
                            </div>
                            <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl p-4 text-center">
                                <div className="text-2xl font-bold text-red-500">{reviewStats.reported_reviews}</div>
                                <div className="text-xs text-[var(--text-muted)]">被举报评论</div>
                            </div>
                            <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl p-4 text-center">
                                <div className="text-2xl font-bold text-orange-500">{reviewStats.pending_reports}</div>
                                <div className="text-xs text-[var(--text-muted)]">待处理举报</div>
                            </div>
                        </div>

                        {/* Filter Buttons */}
                        <div className="flex gap-2">
                            <button
                                onClick={() => setReviewFilter('all')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${reviewFilter === 'all'
                                    ? 'bg-[var(--primary-500)] text-white'
                                    : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                    }`}
                            >
                                全部评论
                            </button>
                            <button
                                onClick={() => setReviewFilter('reported')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${reviewFilter === 'reported'
                                    ? 'bg-red-600 text-white'
                                    : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-red-500'
                                    }`}
                            >
                                被举报 ({reviewStats.reported_reviews})
                            </button>
                        </div>

                        {/* Reviews List */}
                        {isLoading ? (
                            <div className="flex items-center justify-center py-20">
                                <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--primary-500)] border-t-transparent"></div>
                            </div>
                        ) : reviews.length === 0 ? (
                            <div className="text-center py-20">
                                <p className="text-[var(--text-muted)]">暂无评论</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {reviews.map(review => (
                                    <div
                                        key={review.id}
                                        className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl p-5"
                                    >
                                        <div className="flex items-start justify-between mb-3">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-semibold text-[var(--text-primary)]">{review.user_name}</span>
                                                    <div className="flex items-center gap-1 text-yellow-500">
                                                        {[1, 2, 3, 4, 5].map(star => (
                                                            <svg key={star} className="w-3.5 h-3.5" fill={star <= review.rating ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                                            </svg>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="text-xs text-[var(--text-muted)]">
                                                    {new Date(review.created_at).toLocaleString()}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {review.status === 'reported' && (
                                                    <span className="px-2 py-1 text-xs bg-red-500/10 text-red-500 rounded-full">已举报</span>
                                                )}
                                                <span className="text-xs text-[var(--text-muted)]">👍 {review.like_count}</span>
                                            </div>
                                        </div>

                                        <p className="text-sm text-[var(--text-secondary)] mb-3">{review.content}</p>

                                        {review.author_reply && (
                                            <div className="bg-[var(--bg-tertiary)] rounded-lg p-3 mb-3 ml-4 border-l-2 border-[var(--primary-500)]">
                                                <div className="text-xs text-[var(--text-muted)] mb-1">作者回复</div>
                                                <p className="text-sm text-[var(--text-secondary)]">{review.author_reply}</p>
                                            </div>
                                        )}

                                        <button
                                            onClick={() => setDeletingReview(review)}
                                            className="px-3 py-1.5 text-sm text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                        >
                                            删除评论
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Pagination */}
                        {reviewTotalPages > 1 && (
                            <div className="flex justify-center gap-2 mt-8">
                                <button
                                    onClick={() => setReviewPage(Math.max(1, reviewPage - 1))}
                                    disabled={reviewPage === 1}
                                    className="px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-secondary)] disabled:opacity-50"
                                >
                                    上一页
                                </button>
                                <span className="px-4 py-2 text-[var(--text-secondary)]">
                                    {reviewPage} / {reviewTotalPages}
                                </span>
                                <button
                                    onClick={() => setReviewPage(Math.min(reviewTotalPages, reviewPage + 1))}
                                    disabled={reviewPage === reviewTotalPages}
                                    className="px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-secondary)] disabled:opacity-50"
                                >
                                    下一页
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <>
                        {/* Search (for non-pending tabs) */}
                        {activeTab !== 'pending' && (
                            <div className="mb-6">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="搜索标题、内容或作者..."
                                    className="w-full max-w-md px-4 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-500)]"
                                />
                            </div>
                        )}

                        {/* Loading */}
                        {isLoading ? (
                            <div className="flex items-center justify-center py-20">
                                <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--primary-500)] border-t-transparent"></div>
                            </div>
                        ) : prompts.length === 0 ? (
                            <div className="text-center py-20">
                                <svg className="w-16 h-16 mx-auto text-[var(--text-muted)] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <p className="text-[var(--text-muted)]">暂无内容</p>
                            </div>
                        ) : (
                            /* Prompt List */
                            <div className="space-y-4">
                                {prompts.map(prompt => (
                                    <div
                                        key={prompt.id}
                                        className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl p-5"
                                    >
                                        {/* Header */}
                                        <div className="flex items-start justify-between mb-3">
                                            <div>
                                                <h3 className="font-semibold text-[var(--text-primary)] mb-1">
                                                    {prompt.title}
                                                </h3>
                                                <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                                                    <span>提交者：{prompt.author_name}</span>
                                                    <span>•</span>
                                                    <span>分类：{prompt.category}</span>
                                                    <span>•</span>
                                                    <span>{new Date(prompt.created_at).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                            {getStatusBadge(prompt.status)}
                                        </div>

                                        {/* Content Preview */}
                                        <div
                                            className="bg-[var(--bg-tertiary)] rounded-lg p-3 mb-4 cursor-pointer hover:bg-[var(--bg-tertiary)]/80 transition-colors"
                                            onClick={() => setViewingPrompt(prompt)}
                                        >
                                            <pre className="whitespace-pre-wrap text-sm text-[var(--text-secondary)] line-clamp-4 font-mono">
                                                {prompt.content}
                                            </pre>
                                            <div className="text-xs text-[var(--primary-400)] mt-2">点击查看完整内容</div>
                                        </div>

                                        {/* Tags */}
                                        {prompt.tags.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mb-4">
                                                {prompt.tags.map(tag => (
                                                    <span
                                                        key={tag}
                                                        className="px-2 py-0.5 text-xs bg-[var(--primary-500)]/10 text-[var(--primary-400)] rounded-full"
                                                    >
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        {/* Actions */}
                                        <div className="flex gap-3">
                                            {prompt.status === 'pending' && (
                                                <>
                                                    <button
                                                        onClick={() => handleApprove(prompt)}
                                                        disabled={processingId === prompt.id}
                                                        className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                                                    >
                                                        {processingId === prompt.id ? '处理中...' : '✓ 通过'}
                                                    </button>
                                                    <button
                                                        onClick={() => setRejectingPrompt(prompt)}
                                                        disabled={processingId === prompt.id}
                                                        className="flex-1 py-2.5 bg-red-600/10 hover:bg-red-600/20 text-red-500 rounded-lg font-medium transition-colors disabled:opacity-50"
                                                    >
                                                        ✗ 拒绝
                                                    </button>
                                                </>
                                            )}
                                            <button
                                                onClick={() => setDeletingPrompt(prompt)}
                                                disabled={processingId === prompt.id}
                                                className="py-2.5 px-4 bg-[var(--bg-tertiary)] hover:bg-red-600/10 text-[var(--text-secondary)] hover:text-red-500 rounded-lg font-medium transition-colors disabled:opacity-50"
                                            >
                                                🗑️ 删除
                                            </button>
                                        </div>
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
                                    className="px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-secondary)] disabled:opacity-50"
                                >
                                    上一页
                                </button>
                                <span className="px-4 py-2 text-[var(--text-secondary)]">
                                    {page} / {totalPages}
                                </span>
                                <button
                                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                                    disabled={page === totalPages}
                                    className="px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-secondary)] disabled:opacity-50"
                                >
                                    下一页
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* View Modal */}
            {viewingPrompt && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-[var(--bg-secondary)] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden border border-[var(--border-primary)]">
                        <div className="flex items-center justify-between p-6 border-b border-[var(--border-primary)]">
                            <div>
                                <h2 className="text-xl font-bold text-[var(--text-primary)]">{viewingPrompt.title}</h2>
                                <div className="flex items-center gap-2 mt-1">
                                    {getStatusBadge(viewingPrompt.status)}
                                    <span className="text-sm text-[var(--text-muted)]">by {viewingPrompt.author_name}</span>
                                </div>
                            </div>
                            <button
                                onClick={() => setViewingPrompt(null)}
                                className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
                            >
                                <svg className="w-5 h-5 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto max-h-[60vh]">
                            <pre className="whitespace-pre-wrap text-[var(--text-primary)] font-mono text-sm bg-[var(--bg-tertiary)] rounded-xl p-4">
                                {viewingPrompt.content}
                            </pre>
                        </div>
                        <div className="p-6 border-t border-[var(--border-primary)] flex gap-3">
                            {viewingPrompt.status === 'pending' && (
                                <>
                                    <button
                                        onClick={() => {
                                            handleApprove(viewingPrompt);
                                            setViewingPrompt(null);
                                        }}
                                        className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium"
                                    >
                                        ✓ 通过
                                    </button>
                                    <button
                                        onClick={() => {
                                            setRejectingPrompt(viewingPrompt);
                                            setViewingPrompt(null);
                                        }}
                                        className="flex-1 py-3 bg-red-600/10 hover:bg-red-600/20 text-red-500 rounded-xl font-medium"
                                    >
                                        ✗ 拒绝
                                    </button>
                                </>
                            )}
                            <button
                                onClick={() => {
                                    setDeletingPrompt(viewingPrompt);
                                    setViewingPrompt(null);
                                }}
                                className="py-3 px-6 bg-[var(--bg-tertiary)] hover:bg-red-600/10 text-[var(--text-secondary)] hover:text-red-500 rounded-xl font-medium"
                            >
                                🗑️ 删除
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reject Modal */}
            {rejectingPrompt && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-[var(--bg-secondary)] rounded-2xl shadow-2xl w-full max-w-md border border-[var(--border-primary)]">
                        <div className="p-6 border-b border-[var(--border-primary)]">
                            <h2 className="text-xl font-bold text-[var(--text-primary)]">拒绝原因</h2>
                        </div>
                        <div className="p-6">
                            <p className="text-sm text-[var(--text-secondary)] mb-4">
                                拒绝 "{rejectingPrompt.title}"
                            </p>
                            <textarea
                                value={rejectNote}
                                onChange={(e) => setRejectNote(e.target.value)}
                                placeholder="请输入拒绝原因（可选）"
                                className="w-full h-24 px-4 py-3 bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded-xl text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                            />
                        </div>
                        <div className="p-6 border-t border-[var(--border-primary)] flex gap-3">
                            <button
                                onClick={() => {
                                    setRejectingPrompt(null);
                                    setRejectNote('');
                                }}
                                className="flex-1 py-3 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-xl font-medium"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleReject}
                                disabled={processingId === rejectingPrompt.id}
                                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium disabled:opacity-50"
                            >
                                确认拒绝
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Prompt Confirmation Modal */}
            {deletingPrompt && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-[var(--bg-secondary)] rounded-2xl shadow-2xl w-full max-w-md border border-[var(--border-primary)]">
                        <div className="p-6 border-b border-[var(--border-primary)]">
                            <h2 className="text-xl font-bold text-red-500">确认删除</h2>
                        </div>
                        <div className="p-6">
                            <p className="text-[var(--text-secondary)]">
                                确定要删除 "<span className="text-[var(--text-primary)] font-medium">{deletingPrompt.title}</span>" 吗？
                            </p>
                            <p className="text-sm text-[var(--text-muted)] mt-2">
                                此操作不可撤销，提示词将从公共库中永久删除。
                            </p>
                        </div>
                        <div className="p-6 border-t border-[var(--border-primary)] flex gap-3">
                            <button
                                onClick={() => setDeletingPrompt(null)}
                                className="flex-1 py-3 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-xl font-medium"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={processingId === deletingPrompt.id}
                                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium disabled:opacity-50"
                            >
                                {processingId === deletingPrompt.id ? '删除中...' : '确认删除'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Category Confirmation Modal */}
            {deletingCategory && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-[var(--bg-secondary)] rounded-2xl shadow-2xl w-full max-w-md border border-[var(--border-primary)]">
                        <div className="p-6 border-b border-[var(--border-primary)]">
                            <h2 className="text-xl font-bold text-red-500">确认删除分类</h2>
                        </div>
                        <div className="p-6">
                            <p className="text-[var(--text-secondary)]">
                                确定要删除分类 "<span className="text-[var(--text-primary)] font-medium">{deletingCategory.name}</span>" 吗？
                            </p>
                            <p className="text-sm text-[var(--text-muted)] mt-2">
                                使用该分类的提示词将被自动归类到"其他"。
                            </p>
                        </div>
                        <div className="p-6 border-t border-[var(--border-primary)] flex gap-3">
                            <button
                                onClick={() => setDeletingCategory(null)}
                                className="flex-1 py-3 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-xl font-medium"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleDeleteCategory}
                                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium"
                            >
                                确认删除
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Review Confirmation Modal */}
            {deletingReview && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-[var(--bg-secondary)] rounded-2xl shadow-2xl w-full max-w-md border border-[var(--border-primary)]">
                        <div className="p-6 border-b border-[var(--border-primary)]">
                            <h2 className="text-xl font-bold text-red-500">确认删除评论</h2>
                        </div>
                        <div className="p-6">
                            <p className="text-[var(--text-secondary)]">
                                确定要删除 <span className="text-[var(--text-primary)] font-medium">{deletingReview.user_name}</span> 的评论吗？
                            </p>
                            <div className="mt-3 bg-[var(--bg-tertiary)] rounded-lg p-3 text-sm text-[var(--text-muted)]">
                                "{deletingReview.content.slice(0, 100)}{deletingReview.content.length > 100 ? '...' : ''}"
                            </div>
                            <p className="text-sm text-[var(--text-muted)] mt-2">
                                此操作不可撤销。
                            </p>
                        </div>
                        <div className="p-6 border-t border-[var(--border-primary)] flex gap-3">
                            <button
                                onClick={() => setDeletingReview(null)}
                                className="flex-1 py-3 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-xl font-medium"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleDeleteReview}
                                disabled={processingId === deletingReview.id}
                                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium disabled:opacity-50"
                            >
                                {processingId === deletingReview.id ? '删除中...' : '确认删除'}
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
