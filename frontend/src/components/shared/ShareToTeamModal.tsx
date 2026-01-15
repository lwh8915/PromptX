import { useState, useEffect } from 'react';
import { teamsApi, type Team } from '../../api/client';

interface ShareToTeamModalProps {
    promptId: string;
    promptTitle: string;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (teamName: string) => void;
}

/**
 * ShareToTeamModal - 分享提示词到团队的弹窗
 */
export default function ShareToTeamModal({
    promptId,
    promptTitle,
    isOpen,
    onClose,
    onSuccess
}: ShareToTeamModalProps) {
    const [teams, setTeams] = useState<Team[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedTeamId, setSelectedTeamId] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            loadTeams();
        }
    }, [isOpen]);

    const loadTeams = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await teamsApi.getMyTeams();
            setTeams(data);
            if (data.length > 0) {
                setSelectedTeamId(data[0].id);
            }
        } catch (err) {
            setError('加载团队列表失败');
        } finally {
            setIsLoading(false);
        }
    };

    const handleShare = async () => {
        if (!selectedTeamId) return;

        setIsSubmitting(true);
        setError(null);
        try {
            await teamsApi.sharePrompt(selectedTeamId, promptId);
            const team = teams.find(t => t.id === selectedTeamId);
            onSuccess(team?.name || '团队');
            onClose();
        } catch (err: any) {
            setError(err.response?.data?.detail || '分享失败');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-[var(--bg-secondary)] rounded-2xl w-full max-w-md border border-[var(--border-primary)] animate-slideUp">
                {/* Header */}
                <div className="p-6 border-b border-[var(--border-primary)]">
                    <h3 className="text-xl font-bold text-[var(--text-primary)]">分享到团队</h3>
                    <p className="text-sm text-[var(--text-muted)] mt-1 truncate">
                        提示词: {promptTitle}
                    </p>
                </div>

                {/* Content */}
                <div className="p-6">
                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--primary-500)] border-t-transparent" />
                        </div>
                    ) : teams.length === 0 ? (
                        <div className="text-center py-8">
                            <p className="text-[var(--text-secondary)]">您还没有加入任何团队</p>
                            <a
                                href="/teams"
                                className="text-[var(--primary-500)] text-sm hover:underline mt-2 inline-block"
                            >
                                创建或加入团队 →
                            </a>
                        </div>
                    ) : (
                        <>
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-3">
                                选择要分享到的团队
                            </label>
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                {teams.map(team => (
                                    <label
                                        key={team.id}
                                        className={`flex items-center gap-3 p-4 rounded-xl cursor-pointer transition-all border ${selectedTeamId === team.id
                                                ? 'bg-[var(--primary-500)]/10 border-[var(--primary-500)]'
                                                : 'bg-[var(--bg-tertiary)] border-transparent hover:border-[var(--border-primary)]'
                                            }`}
                                    >
                                        <input
                                            type="radio"
                                            name="team"
                                            value={team.id}
                                            checked={selectedTeamId === team.id}
                                            onChange={() => setSelectedTeamId(team.id)}
                                            className="w-4 h-4 text-[var(--primary-500)]"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium text-[var(--text-primary)]">{team.name}</div>
                                            <div className="text-xs text-[var(--text-muted)]">
                                                {team.member_count} 位成员
                                            </div>
                                        </div>
                                        <span className="text-xs text-[var(--text-tertiary)]">
                                            {team.my_role === 'owner' ? '创建者' : team.my_role === 'admin' ? '管理员' : '成员'}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </>
                    )}

                    {error && (
                        <p className="text-red-500 text-sm mt-3">{error}</p>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-[var(--border-primary)] flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 btn btn-secondary"
                        disabled={isSubmitting}
                    >
                        取消
                    </button>
                    <button
                        onClick={handleShare}
                        className="flex-1 btn btn-primary"
                        disabled={isSubmitting || teams.length === 0 || !selectedTeamId}
                    >
                        {isSubmitting ? '分享中...' : '分享'}
                    </button>
                </div>
            </div>
        </div>
    );
}
