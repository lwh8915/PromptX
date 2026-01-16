import type { Prompt } from '../../types';

type ViewMode = 'card' | 'list';

interface PromptCardProps {
    prompt: Prompt;
    onClick?: () => void;
    onCopy: () => void;
    onEdit: () => void;
    onDelete: () => void;
    onViewHistory?: () => void;
    onShare?: () => void;  // 分享到公共库
    onShareToTeam?: () => void;  // 分享到团队
    viewMode?: ViewMode;
    style?: React.CSSProperties;
}

/**
 * PromptCard - 提示词卡片/列表组件
 * 支持卡片和列表两种展示形式
 */
export default function PromptCard({ prompt, onClick, onCopy, onEdit, onDelete, onViewHistory, onShare, onShareToTeam, viewMode = 'card', style }: PromptCardProps) {
    // 列表视图
    if (viewMode === 'list') {
        return (
            <div
                className="glass-card p-4 animate-slideUp group hover:bg-[var(--bg-glass)] transition-all overflow-hidden"
                style={style}
            >
                <div className="flex items-center gap-3">
                    {/* 左侧：收藏标记 */}
                    {prompt.is_favorite && (
                        <span className="text-yellow-500 flex-shrink-0">⭐</span>
                    )}

                    {/* 主要内容 - 限制宽度，点击查看全文 */}
                    <div
                        className="flex-1 min-w-0 overflow-hidden cursor-pointer"
                        onClick={onClick}
                    >
                        <h3 className="font-semibold text-[var(--text-primary)] truncate mb-0.5">
                            {prompt.title}
                        </h3>
                        <p className="text-sm text-[var(--text-secondary)] truncate">
                            {prompt.content}
                        </p>
                    </div>

                    {/* 操作按钮 - 始终显示复制 */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                            onClick={onCopy}
                            className="btn btn-secondary p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="复制"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                        </button>
                        <button
                            onClick={onEdit}
                            className="btn btn-secondary p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="编辑"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </button>
                        {onViewHistory && prompt.version_count > 1 && (
                            <button
                                onClick={onViewHistory}
                                className="btn btn-ghost p-1.5 text-[var(--text-tertiary)] hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-all"
                                title={`版本历史 (${prompt.version_count})`}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </button>
                        )}
                        {onShare && (
                            <button
                                onClick={onShare}
                                className="btn btn-ghost p-1.5 text-[var(--text-tertiary)] hover:text-green-400 opacity-0 group-hover:opacity-100 transition-all"
                                title="分享到公共库"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.368-2.684 3 3 0 00-5.368 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                                </svg>
                            </button>
                        )}
                        {onShareToTeam && (
                            <button
                                onClick={onShareToTeam}
                                className="btn btn-ghost p-1.5 text-[var(--text-tertiary)] hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-all"
                                title="分享到团队"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </button>
                        )}
                        <button
                            onClick={onDelete}
                            className="btn btn-ghost p-1.5 text-[var(--text-tertiary)] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                            title="删除"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // 卡片视图（默认）
    return (
        <div
            className="glass-card p-5 flex flex-col animate-slideUp group cursor-pointer"
            style={style}
            onClick={onClick}
        >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-3">
                <h3 className="font-semibold text-[var(--text-primary)] line-clamp-1 flex-1">
                    {prompt.title}
                </h3>
                {prompt.is_favorite && (
                    <span className="text-yellow-500 flex-shrink-0">⭐</span>
                )}
            </div>

            {/* Tags */}
            {prompt.tags?.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                    {prompt.tags.slice(0, 3).map((tag, index) => (
                        <span
                            key={index}
                            className="px-2 py-0.5 text-xs rounded-full bg-[var(--primary-500)]/10 text-[var(--primary-400)] border border-[var(--primary-500)]/20"
                        >
                            {tag}
                        </span>
                    ))}
                    {prompt.tags.length > 3 && (
                        <span className="px-2 py-0.5 text-xs text-[var(--text-tertiary)]">
                            +{prompt.tags.length - 3}
                        </span>
                    )}
                </div>
            )}

            {/* Content Preview */}
            <p className="text-sm text-[var(--text-secondary)] line-clamp-3 flex-1 mb-4">
                {prompt.content}
            </p>

            {/* Category & Copy Count */}
            <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)] mb-4">
                {prompt.category_name && (
                    <>
                        <span className="flex items-center gap-1">
                            <span>📁</span>
                            {prompt.category_name}
                        </span>
                        <span>•</span>
                    </>
                )}
                <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    {prompt.copy_count}
                </span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                {/* 一键复制按钮 */}
                <button
                    onClick={onCopy}
                    className="btn btn-secondary p-2.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="复制"
                >
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                </button>

                {/* 编辑按钮 */}
                <button
                    onClick={onEdit}
                    className="btn btn-secondary p-2.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="编辑"
                >
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                </button>

                {/* 版本历史按钮 */}
                {onViewHistory && prompt.version_count > 1 && (
                    <button
                        onClick={onViewHistory}
                        className="btn btn-ghost p-2.5 text-[var(--text-tertiary)] hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-all"
                        title={`版本历史 (${prompt.version_count})`}
                    >
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </button>
                )}
                {/* 分享到公共库按钮 */}
                {onShare && (
                    <button
                        onClick={onShare}
                        className="btn btn-ghost p-2.5 text-[var(--text-tertiary)] hover:text-green-400 opacity-0 group-hover:opacity-100 transition-all"
                        title="分享到公共库"
                    >
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.368-2.684 3 3 0 00-5.368 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        </svg>
                    </button>
                )}

                {/* 分享到团队按钮 */}
                {onShareToTeam && (
                    <button
                        onClick={onShareToTeam}
                        className="btn btn-ghost p-2.5 text-[var(--text-tertiary)] hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-all"
                        title="分享到团队"
                    >
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </button>
                )}

                {/* 删除按钮 */}
                <button
                    onClick={onDelete}
                    className="btn btn-ghost p-2.5 text-[var(--text-tertiary)] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                    title="删除"
                >
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </button>
            </div>
        </div>
    );
}
