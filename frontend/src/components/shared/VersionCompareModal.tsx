import { useState, useEffect } from 'react';
import { promptApi } from '../../api/client';
import type { Prompt, PromptCompareResponse, DiffLine } from '../../types';

interface VersionCompareModalProps {
    prompt: Prompt;
    version1: number;
    version2: number;
    onClose: () => void;
}

/**
 * VersionCompareModal - 版本对比弹窗
 * 左右分栏对比两个版本的差异
 */
export default function VersionCompareModal({
    prompt,
    version1,
    version2,
    onClose
}: VersionCompareModalProps) {
    const [compareData, setCompareData] = useState<PromptCompareResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadComparison();
    }, [prompt.id, version1, version2]);

    const loadComparison = async () => {
        try {
            setIsLoading(true);
            setError(null);
            const data = await promptApi.compareVersions(prompt.id, version1, version2);
            setCompareData(data);
        } catch (err) {
            console.error('Failed to compare versions:', err);
            setError('加载对比失败');
        } finally {
            setIsLoading(false);
        }
    };

    const renderDiffLine = (line: DiffLine, index: number) => {
        const bgColor =
            line.type === 'added' ? 'bg-green-500/10' :
                line.type === 'removed' ? 'bg-red-500/10' : '';

        const textColor =
            line.type === 'added' ? 'text-green-400' :
                line.type === 'removed' ? 'text-red-400' : 'text-[var(--text-primary)]';

        const prefix =
            line.type === 'added' ? '+' :
                line.type === 'removed' ? '-' : ' ';

        return (
            <div
                key={index}
                className={`flex font-mono text-sm ${bgColor}`}
            >
                <span className="w-12 text-center text-[var(--text-tertiary)] border-r border-[var(--border-secondary)] select-none shrink-0">
                    {line.line_number_old || ''}
                </span>
                <span className="w-12 text-center text-[var(--text-tertiary)] border-r border-[var(--border-secondary)] select-none shrink-0">
                    {line.line_number_new || ''}
                </span>
                <span className={`w-6 text-center ${textColor} shrink-0`}>
                    {prefix}
                </span>
                <span className={`flex-1 px-2 ${textColor} whitespace-pre-wrap`}>
                    {line.content}
                </span>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Overlay */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="glass-card w-full max-w-5xl max-h-[90vh] overflow-hidden relative animate-scaleIn flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-[var(--border-secondary)]">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-[var(--text-primary)]">
                                版本对比
                            </h2>
                            <p className="text-sm text-[var(--text-tertiary)]">
                                v{version1} → v{version2}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="btn btn-ghost p-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-32">
                            <div className="animate-spin w-8 h-8 border-2 border-[var(--primary-500)] border-t-transparent rounded-full"></div>
                        </div>
                    ) : error ? (
                        <div className="text-center text-red-400 py-8">
                            {error}
                        </div>
                    ) : compareData && (
                        <div className="space-y-6">
                            {/* Title Change */}
                            {compareData.title_changed && (
                                <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-secondary)]">
                                    <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-2">标题变更</h4>
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-red-400 font-mono">-</span>
                                            <span className="text-red-400 line-through">{compareData.title_old}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-green-400 font-mono">+</span>
                                            <span className="text-green-400">{compareData.title_new}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Tags Change */}
                            {(compareData.tags_added.length > 0 || compareData.tags_removed.length > 0) && (
                                <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-secondary)]">
                                    <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-2">标签变更</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {compareData.tags_removed.map(tag => (
                                            <span
                                                key={`removed-${tag}`}
                                                className="px-2 py-1 text-xs rounded-lg bg-red-500/20 text-red-400 line-through"
                                            >
                                                {tag}
                                            </span>
                                        ))}
                                        {compareData.tags_added.map(tag => (
                                            <span
                                                key={`added-${tag}`}
                                                className="px-2 py-1 text-xs rounded-lg bg-green-500/20 text-green-400"
                                            >
                                                + {tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Description Change */}
                            {compareData.description_changed && (
                                <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-secondary)]">
                                    <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-2">描述变更</h4>
                                    <div className="space-y-1 text-sm">
                                        {compareData.description_old && (
                                            <div className="text-red-400 line-through">
                                                {compareData.description_old}
                                            </div>
                                        )}
                                        {compareData.description_new && (
                                            <div className="text-green-400">
                                                {compareData.description_new}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Content Diff */}
                            <div className="rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-secondary)] overflow-hidden">
                                <div className="p-3 border-b border-[var(--border-secondary)] flex items-center justify-between">
                                    <h4 className="text-sm font-medium text-[var(--text-secondary)]">内容差异</h4>
                                    <div className="flex items-center gap-4 text-xs text-[var(--text-tertiary)]">
                                        <span className="flex items-center gap-1">
                                            <span className="w-3 h-3 rounded bg-green-500/20"></span>
                                            新增
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <span className="w-3 h-3 rounded bg-red-500/20"></span>
                                            删除
                                        </span>
                                    </div>
                                </div>
                                <div className="max-h-[400px] overflow-y-auto">
                                    {compareData.content_diff.length === 0 ? (
                                        <div className="p-4 text-center text-[var(--text-tertiary)]">
                                            内容无变化
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-[var(--border-secondary)]">
                                            {compareData.content_diff.map((line, index) =>
                                                renderDiffLine(line, index)
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
