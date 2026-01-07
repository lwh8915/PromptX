import { useState, useEffect } from 'react';
import { promptApi } from '../../api/client';
import type { Prompt, PromptVersion } from '../../types';

interface VersionHistoryModalProps {
    prompt: Prompt;
    onClose: () => void;
    onRestore: (updatedPrompt: Prompt) => void;
    onCompare: (v1: number, v2: number) => void;
}

/**
 * VersionHistoryModal - 版本历史弹窗
 * 显示提示词的所有历史版本，支持预览、恢复和对比
 */
export default function VersionHistoryModal({
    prompt,
    onClose,
    onRestore,
    onCompare
}: VersionHistoryModalProps) {
    const [versions, setVersions] = useState<PromptVersion[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedVersion, setSelectedVersion] = useState<PromptVersion | null>(null);
    const [compareMode, setCompareMode] = useState(false);
    const [compareSelections, setCompareSelections] = useState<number[]>([]);
    const [isRestoring, setIsRestoring] = useState(false);

    useEffect(() => {
        loadVersions();
    }, [prompt.id]);

    const loadVersions = async () => {
        try {
            setIsLoading(true);
            const response = await promptApi.getVersions(prompt.id);
            setVersions(response.items);
        } catch (error) {
            console.error('Failed to load versions:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRestore = async (version: number) => {
        if (!confirm(`确定要恢复到版本 ${version} 吗？当前内容将被保存为新版本。`)) {
            return;
        }

        try {
            setIsRestoring(true);
            const updated = await promptApi.restoreVersion(prompt.id, version);
            onRestore(updated);
            onClose();
        } catch (error) {
            console.error('Failed to restore version:', error);
            alert('恢复失败');
        } finally {
            setIsRestoring(false);
        }
    };

    const toggleCompareSelection = (version: number) => {
        if (compareSelections.includes(version)) {
            setCompareSelections(prev => prev.filter(v => v !== version));
        } else if (compareSelections.length < 2) {
            setCompareSelections(prev => [...prev, version]);
        }
    };

    const handleCompare = () => {
        if (compareSelections.length === 2) {
            const [v1, v2] = compareSelections.sort((a, b) => a - b);
            onCompare(v1, v2);
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleString('zh-CN', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Overlay */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="glass-card w-full max-w-4xl max-h-[85vh] overflow-hidden relative animate-scaleIn flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-[var(--border-secondary)]">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-[var(--text-primary)]">
                                版本历史
                            </h2>
                            <p className="text-sm text-[var(--text-tertiary)]">
                                {prompt.title} · {prompt.version_count} 个版本
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {compareMode && compareSelections.length === 2 && (
                            <button
                                onClick={handleCompare}
                                className="btn btn-primary text-sm"
                            >
                                对比选中版本
                            </button>
                        )}
                        <button
                            onClick={() => {
                                setCompareMode(!compareMode);
                                setCompareSelections([]);
                            }}
                            className={`btn text-sm ${compareMode ? 'btn-secondary' : 'btn-ghost'}`}
                        >
                            {compareMode ? '取消对比' : '版本对比'}
                        </button>
                        <button onClick={onClose} className="btn btn-ghost p-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden flex">
                    {/* Version List */}
                    <div className="w-80 border-r border-[var(--border-secondary)] overflow-y-auto">
                        {isLoading ? (
                            <div className="flex items-center justify-center h-32">
                                <div className="animate-spin w-6 h-6 border-2 border-[var(--primary-500)] border-t-transparent rounded-full"></div>
                            </div>
                        ) : (
                            <div className="p-4 space-y-2">
                                {versions.map((version, index) => (
                                    <button
                                        key={version.id}
                                        onClick={() => {
                                            if (compareMode) {
                                                toggleCompareSelection(version.version);
                                            } else {
                                                setSelectedVersion(version);
                                            }
                                        }}
                                        className={`w-full text-left p-4 rounded-xl border transition-all cursor-pointer ${compareMode && compareSelections.includes(version.version)
                                                ? 'border-[var(--primary-500)] bg-[var(--primary-500)]/10'
                                                : selectedVersion?.version === version.version
                                                    ? 'border-[var(--primary-500)]/50 bg-[var(--bg-glass)]'
                                                    : 'border-transparent hover:bg-[var(--bg-glass)]'
                                            }`}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-2">
                                                {compareMode && (
                                                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${compareSelections.includes(version.version)
                                                            ? 'border-[var(--primary-500)] bg-[var(--primary-500)]'
                                                            : 'border-[var(--border-primary)]'
                                                        }`}>
                                                        {compareSelections.includes(version.version) && (
                                                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                                <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                                                            </svg>
                                                        )}
                                                    </div>
                                                )}
                                                <div>
                                                    <span className="font-medium text-[var(--text-primary)]">
                                                        v{version.version}
                                                    </span>
                                                    {index === 0 && (
                                                        <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
                                                            当前
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <span className="text-xs text-[var(--text-tertiary)]">
                                                {formatDate(version.created_at)}
                                            </span>
                                        </div>
                                        <p className="text-sm text-[var(--text-secondary)] mt-1 line-clamp-1">
                                            {version.title}
                                        </p>
                                        {version.change_note && (
                                            <p className="text-xs text-[var(--text-tertiary)] mt-1 italic">
                                                {version.change_note}
                                            </p>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Preview */}
                    <div className="flex-1 overflow-y-auto p-6">
                        {selectedVersion ? (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                                        {selectedVersion.title}
                                    </h3>
                                    {selectedVersion.version !== prompt.current_version && (
                                        <button
                                            onClick={() => handleRestore(selectedVersion.version)}
                                            disabled={isRestoring}
                                            className="btn btn-primary text-sm disabled:opacity-50"
                                        >
                                            {isRestoring ? '恢复中...' : '恢复到此版本'}
                                        </button>
                                    )}
                                </div>

                                {selectedVersion.description && (
                                    <p className="text-sm text-[var(--text-secondary)]">
                                        {selectedVersion.description}
                                    </p>
                                )}

                                {selectedVersion.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {selectedVersion.tags.map(tag => (
                                            <span
                                                key={tag}
                                                className="px-2 py-1 text-xs rounded-lg bg-[var(--bg-glass)] text-[var(--text-secondary)]"
                                            >
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-secondary)]">
                                    <pre className="text-sm text-[var(--text-primary)] whitespace-pre-wrap font-mono">
                                        {selectedVersion.content}
                                    </pre>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex items-center justify-center text-[var(--text-tertiary)]">
                                <div className="text-center">
                                    <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    <p>选择一个版本查看详情</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
