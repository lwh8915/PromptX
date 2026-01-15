import { useEffect, useState } from 'react';
import { teamsApi, type TeamPromptVersion } from '../../api/client';

interface TeamVersionHistoryModalProps {
    teamId: string;
    promptId: string;
    promptTitle: string;
    onClose: () => void;
    onRestore: (newVersion: number) => void;
}

export default function TeamVersionHistoryModal({
    teamId,
    promptId,
    promptTitle,
    onClose,
    onRestore
}: TeamVersionHistoryModalProps) {
    const [versions, setVersions] = useState<TeamPromptVersion[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedVersion, setSelectedVersion] = useState<TeamPromptVersion | null>(null);
    const [restoring, setRestoring] = useState(false);

    useEffect(() => {
        loadVersions();
    }, [teamId, promptId]);

    const loadVersions = async () => {
        try {
            const data = await teamsApi.getPromptVersions(teamId, promptId);
            setVersions(data);
            if (data.length > 0) {
                setSelectedVersion(data[0]);
            }
        } catch (error) {
            console.error('Failed to load versions:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleRestore = async (version: number) => {
        if (!confirm(`确定要恢复到第 ${version} 版吗？`)) return;
        setRestoring(true);
        try {
            const result = await teamsApi.restorePromptVersion(teamId, promptId, version);
            onRestore(result.new_version);
        } catch (error) {
            console.error('Failed to restore:', error);
        } finally {
            setRestoring(false);
        }
    };

    const formatDate = (dateStr: string) => {
        // 后端返回的是UTC时间，需要正确转换为本地时间
        const utcDate = dateStr.endsWith('Z') ? dateStr : dateStr + 'Z';
        return new Date(utcDate).toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Asia/Shanghai'
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="glass-card w-full max-w-4xl max-h-[85vh] relative animate-scaleIn flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-[var(--border-primary)] flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-semibold text-[var(--text-primary)]">
                            版本历史
                        </h3>
                        <p className="text-sm text-[var(--text-secondary)] mt-1">{promptTitle}</p>
                    </div>
                    <button onClick={onClose} className="btn btn-ghost p-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 flex overflow-hidden">
                    {loading ? (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--primary-500)] border-t-transparent" />
                        </div>
                    ) : versions.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center text-[var(--text-muted)]">
                            暂无版本历史
                        </div>
                    ) : (
                        <>
                            {/* Version List */}
                            <div className="w-64 border-r border-[var(--border-primary)] overflow-y-auto">
                                {versions.map((v) => (
                                    <div
                                        key={v.id}
                                        onClick={() => setSelectedVersion(v)}
                                        className={`p-4 cursor-pointer border-b border-[var(--border-primary)] transition-colors ${selectedVersion?.id === v.id
                                            ? 'bg-[var(--primary-500)]/10 border-l-2 border-l-[var(--primary-500)]'
                                            : 'hover:bg-[var(--bg-secondary)]'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="font-medium text-[var(--text-primary)]">
                                                第 {v.version} 版
                                            </span>
                                            {v.version === versions[0].version && (
                                                <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--primary-500)]/20 text-[var(--primary-500)]">
                                                    当前
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-[var(--text-muted)]">
                                            {v.modified_by_name} · {formatDate(v.modified_at)}
                                        </div>
                                        <div className="text-xs text-[var(--text-secondary)] mt-1 truncate">
                                            {v.change_note}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Version Detail */}
                            {selectedVersion && (
                                <div className="flex-1 overflow-y-auto p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <h4 className="text-lg font-medium text-[var(--text-primary)]">
                                                {selectedVersion.title}
                                            </h4>
                                            <p className="text-sm text-[var(--text-muted)]">
                                                {selectedVersion.change_note}
                                            </p>
                                        </div>
                                        {selectedVersion.version !== versions[0].version && (
                                            <button
                                                onClick={() => handleRestore(selectedVersion.version)}
                                                disabled={restoring}
                                                className="btn btn-primary text-sm disabled:opacity-50"
                                            >
                                                {restoring ? '恢复中...' : '恢复此版本'}
                                            </button>
                                        )}
                                    </div>
                                    <div className="space-y-4">
                                        {selectedVersion.description && (
                                            <div>
                                                <label className="text-sm text-[var(--text-secondary)]">描述</label>
                                                <p className="text-[var(--text-primary)] mt-1">{selectedVersion.description}</p>
                                            </div>
                                        )}
                                        <div>
                                            <label className="text-sm text-[var(--text-secondary)]">内容</label>
                                            <pre className="mt-1 p-4 rounded-lg bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm whitespace-pre-wrap overflow-x-auto max-h-96">
                                                {selectedVersion.content}
                                            </pre>
                                        </div>
                                        {selectedVersion.tags.length > 0 && (
                                            <div>
                                                <label className="text-sm text-[var(--text-secondary)]">标签</label>
                                                <div className="flex gap-2 mt-1 flex-wrap">
                                                    {selectedVersion.tags.map((tag) => (
                                                        <span key={tag} className="px-2 py-1 rounded-full bg-[var(--bg-tertiary)] text-[var(--text-secondary)] text-xs">
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
