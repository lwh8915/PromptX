import { useEffect, useState } from 'react';
import { publicPromptApi, type Review, type PublicPrompt } from '../../api/client';
import StarRating from '../ui/StarRating';
import { useAuthStore } from '../../stores/authStore';

interface ReviewSectionProps {
    prompt: PublicPrompt;
    onToast: (message: string, type: 'success' | 'error') => void;
}

/**
 * ReviewSection - 评价区域组件
 * 显示评价列表、评价表单和评价交互功能
 */
export default function ReviewSection({ prompt, onToast }: ReviewSectionProps) {
    const { user } = useAuthStore();
    const [reviews, setReviews] = useState<Review[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [sortBy, setSortBy] = useState<'latest' | 'likes'>('latest');

    // 我的评价状态
    const [myReviewData, setMyReviewData] = useState<{
        review: Review | null;
        has_downloaded: boolean;
        can_review: boolean;
    } | null>(null);

    // 创建评价状态
    const [newRating, setNewRating] = useState(5);
    const [newContent, setNewContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // 举报弹窗
    const [reportingReview, setReportingReview] = useState<Review | null>(null);
    const [reportReason, setReportReason] = useState('');

    const pageSize = 10;
    const isAuthor = user?.id === prompt.author_id;

    // 加载评价列表
    const loadReviews = async () => {
        setIsLoading(true);
        try {
            const result = await publicPromptApi.getReviews(prompt.id, {
                sort_by: sortBy,
                page,
                page_size: pageSize
            });
            setReviews(result.items);
            setTotal(result.total);
        } catch (error) {
            console.error('Failed to load reviews:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // 加载我的评价状态
    const loadMyReview = async () => {
        try {
            const data = await publicPromptApi.getMyReview(prompt.id);
            setMyReviewData(data);
        } catch (error) {
            console.error('Failed to load my review:', error);
        }
    };

    useEffect(() => {
        loadReviews();
        loadMyReview();
    }, [prompt.id, sortBy, page]);

    // 提交评价
    const handleSubmitReview = async () => {
        if (!newContent.trim()) {
            onToast('请输入评价内容', 'error');
            return;
        }

        setIsSubmitting(true);
        try {
            await publicPromptApi.createReview(prompt.id, newRating, newContent.trim());
            onToast('评价成功', 'success');
            setNewContent('');
            setNewRating(5);
            loadReviews();
            loadMyReview();
        } catch (error: any) {
            onToast(error.response?.data?.detail || '评价失败', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    // 点赞评论
    const handleLikeReview = async (review: Review) => {
        try {
            if (review.is_liked) {
                await publicPromptApi.unlikeReview(review.id);
            } else {
                await publicPromptApi.likeReview(review.id);
            }
            // 更新本地状态
            setReviews(prev => prev.map(r =>
                r.id === review.id
                    ? { ...r, is_liked: !r.is_liked, like_count: r.is_liked ? r.like_count - 1 : r.like_count + 1 }
                    : r
            ));
        } catch (error: any) {
            onToast(error.response?.data?.detail || '操作失败', 'error');
        }
    };

    // 举报评论
    const handleReport = async () => {
        if (!reportingReview || !reportReason.trim()) {
            onToast('请输入举报原因', 'error');
            return;
        }

        try {
            await publicPromptApi.reportReview(reportingReview.id, reportReason.trim());
            onToast('举报已提交', 'success');
            setReportingReview(null);
            setReportReason('');
        } catch (error: any) {
            onToast(error.response?.data?.detail || '举报失败', 'error');
        }
    };

    // 作者回复
    const [replyingTo, setReplyingTo] = useState<Review | null>(null);
    const [replyContent, setReplyContent] = useState('');

    const handleReply = async () => {
        if (!replyingTo || !replyContent.trim()) return;

        try {
            await publicPromptApi.replyToReview(replyingTo.id, replyContent.trim());
            onToast('回复成功', 'success');
            setReplyingTo(null);
            setReplyContent('');
            loadReviews();
        } catch (error: any) {
            onToast(error.response?.data?.detail || '回复失败', 'error');
        }
    };

    const totalPages = Math.ceil(total / pageSize);

    return (
        <div className="mt-6 border-t border-[var(--border-primary)] pt-6">
            {/* 评分概览 */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-[var(--text-primary)]">用户评价</h3>
                    {prompt.review_count > 0 && (
                        <div className="flex items-center gap-2">
                            <StarRating rating={prompt.avg_rating} readonly size="sm" />
                            <span className="text-sm text-[var(--text-secondary)]">
                                {prompt.avg_rating.toFixed(1)} ({prompt.review_count} 条评价)
                            </span>
                        </div>
                    )}
                </div>
                <select
                    value={sortBy}
                    onChange={(e) => { setSortBy(e.target.value as 'latest' | 'likes'); setPage(1); }}
                    className="px-3 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none"
                >
                    <option value="latest">最新</option>
                    <option value="likes">最有用</option>
                </select>
            </div>

            {/* 评价表单 */}
            {myReviewData?.can_review && (
                <div className="bg-[var(--bg-tertiary)] rounded-xl p-4 mb-6">
                    <h4 className="text-sm font-medium text-[var(--text-primary)] mb-3">写评价</h4>
                    <div className="flex items-center gap-3 mb-3">
                        <span className="text-sm text-[var(--text-secondary)]">评分：</span>
                        <StarRating rating={newRating} onChange={setNewRating} size="md" />
                    </div>
                    <textarea
                        value={newContent}
                        onChange={(e) => setNewContent(e.target.value)}
                        placeholder="分享你使用这个提示词的体验..."
                        maxLength={500}
                        className="w-full h-24 px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-500)] resize-none text-sm"
                    />
                    <div className="flex items-center justify-between mt-3">
                        <span className="text-xs text-[var(--text-muted)]">{newContent.length}/500</span>
                        <button
                            onClick={handleSubmitReview}
                            disabled={isSubmitting || !newContent.trim()}
                            className="px-4 py-2 bg-[var(--primary-500)] text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-50"
                        >
                            {isSubmitting ? '提交中...' : '提交评价'}
                        </button>
                    </div>
                </div>
            )}

            {/* 已评价提示 */}
            {myReviewData?.review && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 mb-6">
                    <div className="flex items-center gap-2 text-green-500 text-sm">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>您已评价过该提示词</span>
                    </div>
                </div>
            )}

            {/* 未下载提示 */}
            {myReviewData && !myReviewData.has_downloaded && !isAuthor && (
                <div className="bg-[var(--bg-tertiary)] rounded-xl p-4 mb-6 text-center">
                    <p className="text-sm text-[var(--text-muted)]">
                        下载该提示词后即可评价
                    </p>
                </div>
            )}

            {/* 评价列表 */}
            {isLoading ? (
                <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-[var(--primary-500)] border-t-transparent"></div>
                </div>
            ) : reviews.length === 0 ? (
                <div className="text-center py-8">
                    <p className="text-[var(--text-muted)]">暂无评价</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {reviews.map(review => (
                        <div key={review.id} className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl p-4">
                            {/* 评论头部 */}
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <span className="font-medium text-[var(--text-primary)]">{review.user_name}</span>
                                    <StarRating rating={review.rating} readonly size="sm" />
                                </div>
                                <span className="text-xs text-[var(--text-muted)]">
                                    {new Date(review.created_at).toLocaleDateString()}
                                </span>
                            </div>

                            {/* 评论内容 */}
                            <p className="text-sm text-[var(--text-secondary)] mb-3">{review.content}</p>

                            {/* 作者回复 */}
                            {review.author_reply && (
                                <div className="bg-[var(--bg-tertiary)] rounded-lg p-3 mb-3 ml-4 border-l-2 border-[var(--primary-500)]">
                                    <div className="text-xs text-[var(--text-muted)] mb-1">作者回复</div>
                                    <p className="text-sm text-[var(--text-secondary)]">{review.author_reply}</p>
                                </div>
                            )}

                            {/* 操作按钮 */}
                            <div className="flex items-center gap-4 text-xs">
                                <button
                                    onClick={() => handleLikeReview(review)}
                                    className={`flex items-center gap-1 transition-colors ${review.is_liked ? 'text-[var(--primary-500)]' : 'text-[var(--text-muted)] hover:text-[var(--primary-500)]'
                                        }`}
                                >
                                    <svg className="w-4 h-4" fill={review.is_liked ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                                    </svg>
                                    {review.like_count > 0 && <span>{review.like_count}</span>}
                                    <span>有用</span>
                                </button>

                                {/* 作者回复按钮 */}
                                {isAuthor && !review.author_reply && (
                                    <button
                                        onClick={() => setReplyingTo(review)}
                                        className="text-[var(--text-muted)] hover:text-[var(--primary-500)] transition-colors"
                                    >
                                        回复
                                    </button>
                                )}

                                {/* 举报按钮 */}
                                {user?.id !== review.user_id && (
                                    <button
                                        onClick={() => setReportingReview(review)}
                                        className="text-[var(--text-muted)] hover:text-red-500 transition-colors"
                                    >
                                        举报
                                    </button>
                                )}
                            </div>

                            {/* 回复表单 */}
                            {replyingTo?.id === review.id && (
                                <div className="mt-3 pt-3 border-t border-[var(--border-primary)]">
                                    <textarea
                                        value={replyContent}
                                        onChange={(e) => setReplyContent(e.target.value)}
                                        placeholder="输入回复内容..."
                                        maxLength={500}
                                        className="w-full h-16 px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none resize-none"
                                    />
                                    <div className="flex justify-end gap-2 mt-2">
                                        <button
                                            onClick={() => { setReplyingTo(null); setReplyContent(''); }}
                                            className="px-3 py-1.5 text-sm text-[var(--text-secondary)]"
                                        >
                                            取消
                                        </button>
                                        <button
                                            onClick={handleReply}
                                            disabled={!replyContent.trim()}
                                            className="px-3 py-1.5 bg-[var(--primary-500)] text-white text-sm rounded-lg hover:opacity-90 disabled:opacity-50"
                                        >
                                            发送
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* 分页 */}
            {totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-6">
                    <button
                        onClick={() => setPage(Math.max(1, page - 1))}
                        disabled={page === 1}
                        className="px-3 py-1.5 text-sm bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-secondary)] disabled:opacity-50"
                    >
                        上一页
                    </button>
                    <span className="px-3 py-1.5 text-sm text-[var(--text-secondary)]">{page}/{totalPages}</span>
                    <button
                        onClick={() => setPage(Math.min(totalPages, page + 1))}
                        disabled={page === totalPages}
                        className="px-3 py-1.5 text-sm bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-secondary)] disabled:opacity-50"
                    >
                        下一页
                    </button>
                </div>
            )}

            {/* 举报弹窗 */}
            {reportingReview && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-[var(--bg-secondary)] rounded-xl w-full max-w-sm border border-[var(--border-primary)]">
                        <div className="p-4 border-b border-[var(--border-primary)]">
                            <h3 className="font-semibold text-[var(--text-primary)]">举报评论</h3>
                        </div>
                        <div className="p-4">
                            <textarea
                                value={reportReason}
                                onChange={(e) => setReportReason(e.target.value)}
                                placeholder="请描述举报原因..."
                                maxLength={200}
                                className="w-full h-24 px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none resize-none"
                            />
                        </div>
                        <div className="p-4 border-t border-[var(--border-primary)] flex gap-3">
                            <button
                                onClick={() => { setReportingReview(null); setReportReason(''); }}
                                className="flex-1 py-2 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-lg text-sm"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleReport}
                                disabled={!reportReason.trim()}
                                className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50"
                            >
                                提交举报
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
