import { useState } from 'react';
import { promptApi } from '../../api/client';

interface AIModifyModalProps {
    content: string;
    onClose: () => void;
    onApply: (modifiedContent: string) => void;
}

/**
 * AIModifyModal - AI 修改建议输入弹窗
 * 用户输入修改建议，调用 AI 进行提示词优化
 * 支持输入建议和结果对比两个视图
 */
export default function AIModifyModal({ content, onClose, onApply }: AIModifyModalProps) {
    const [suggestion, setSuggestion] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [modifiedContent, setModifiedContent] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleSend = async () => {
        if (!suggestion.trim()) {
            setError('请输入修改建议');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const result = await promptApi.aiModify(content, suggestion);
            setModifiedContent(result.modified_content);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'AI 服务调用失败');
        } finally {
            setIsLoading(false);
        }
    };

    const handleApply = () => {
        if (modifiedContent) {
            onApply(modifiedContent);
            onClose();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
    };

    // 动态计算宽度：对比模式下更宽
    const maxWidthClass = modifiedContent ? 'max-w-5xl' : 'max-w-2xl';

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            onKeyDown={handleKeyDown}
            tabIndex={-1}
        >
            {/* Overlay */}
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Modal */}
            <div className={`glass-card w-full ${maxWidthClass} max-h-[90vh] overflow-hidden relative animate-scaleIn flex flex-col transition-all duration-300`}>
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-[var(--border-secondary)]">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                                {modifiedContent ? 'AI 优化对比' : 'AI 智能修改'}
                            </h2>
                            <p className="text-xs text-[var(--text-tertiary)]">
                                {modifiedContent ? '请对比修改前后的内容，确认无误后应用' : '输入您的修改建议，让 AI 为您优化提示词'}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="btn btn-ghost p-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
                    {!modifiedContent ? (
                        // 输入模式
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                                    当前提示词预览
                                </label>
                                <div className="p-3 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] max-h-40 overflow-y-auto">
                                    <pre className="whitespace-pre-wrap text-sm text-[var(--text-tertiary)] font-mono line-clamp-6">
                                        {content}
                                    </pre>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                                    修改建议
                                </label>
                                <textarea
                                    value={suggestion}
                                    onChange={(e) => setSuggestion(e.target.value)}
                                    placeholder="例如：让语气更加专业、添加更多细节、使用结构化格式..."
                                    className="input w-full h-32 resize-none focus:ring-2 focus:ring-purple-500/50"
                                    disabled={isLoading}
                                    autoFocus
                                />
                                <div className="mt-2 flex gap-2">
                                    {['更加专业', '精简内容', 'Structured Format', '添加更多细节', '优化逻辑'].map(tag => (
                                        <button
                                            key={tag}
                                            onClick={() => setSuggestion(prev => prev ? `${prev}，${tag}` : tag)}
                                            className="px-2 py-1 text-xs rounded-full bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] transition-colors"
                                        >
                                            + {tag}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Error Message */}
                            {error && (
                                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2 animate-fadeIn">
                                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    {error}
                                </div>
                            )}
                        </div>
                    ) : (
                        // 对比模式
                        <div className="grid grid-cols-2 gap-6 h-full min-h-[400px]">
                            {/* 左侧：原版 */}
                            <div className="flex flex-col h-full">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-sm font-medium text-[var(--text-secondary)] flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-red-400"></span>
                                        修改前 (Original)
                                    </span>
                                </div>
                                <div className="flex-1 p-4 rounded-xl bg-red-500/5 border border-red-500/20 overflow-y-auto">
                                    <pre className="whitespace-pre-wrap text-sm text-[var(--text-primary)] font-mono leading-relaxed opacity-80">
                                        {content}
                                    </pre>
                                </div>
                            </div>

                            {/* 右侧：新版 */}
                            <div className="flex flex-col h-full">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-sm font-medium text-green-400 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-green-400"></span>
                                        修改后 (AI Modified)
                                    </span>
                                    <div className="text-xs text-[var(--text-tertiary)]">
                                        建议: {suggestion}
                                    </div>
                                </div>
                                <div className="flex-1 p-4 rounded-xl bg-green-500/5 border border-green-500/20 overflow-y-auto shadow-inner relative group">
                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <span className="px-2 py-1 text-xs bg-green-500/20 text-green-400 rounded">New</span>
                                    </div>
                                    <pre className="whitespace-pre-wrap text-sm text-[var(--text-primary)] font-mono leading-relaxed">
                                        {modifiedContent}
                                    </pre>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-4 border-t border-[var(--border-secondary)] bg-[var(--bg-secondary)]/50">
                    <button
                        onClick={onClose}
                        className="btn btn-secondary"
                        disabled={isLoading}
                    >
                        取消
                    </button>

                    {!modifiedContent ? (
                        <button
                            onClick={handleSend}
                            disabled={isLoading || !suggestion.trim()}
                            className="btn btn-primary flex items-center gap-2 px-6 shadow-lg shadow-purple-500/20"
                        >
                            {isLoading ? (
                                <>
                                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    AI 正在思考...
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                    发送给 AI
                                </>
                            )}
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={() => setModifiedContent(null)}
                                className="btn btn-secondary flex items-center gap-2 hover:bg-[var(--bg-tertiary)]"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                重新生成
                            </button>
                            <button
                                onClick={handleApply}
                                className="btn btn-primary flex items-center gap-2 px-6 shadow-lg shadow-green-500/20 bg-green-600 hover:bg-green-700 border-green-600"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                应用修改
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
