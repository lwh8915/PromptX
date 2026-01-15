import { useState, useEffect } from 'react';
import { teamsApi, type TeamPrompt, type TeamCategory } from '../../api/client';

interface TeamPromptEditModalProps {
    teamId: string;
    prompt: TeamPrompt;
    onClose: () => void;
    onSuccess: () => void;
}

/**
 * TeamPromptEditModal - 团队提示词编辑弹窗
 * 只修改团队副本，不影响个人提示词库
 */
export default function TeamPromptEditModal({
    teamId,
    prompt,
    onClose,
    onSuccess
}: TeamPromptEditModalProps) {
    const [title, setTitle] = useState(prompt.title || '');
    const [content, setContent] = useState(prompt.content || '');
    const [description, setDescription] = useState(prompt.description || '');
    const [categoryId, setCategoryId] = useState<string | null>(prompt.team_category_id || null);
    const [changeNote, setChangeNote] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [categories, setCategories] = useState<TeamCategory[]>([]);

    // 加载团队分类
    useEffect(() => {
        const loadCategories = async () => {
            try {
                const data = await teamsApi.getCategories(teamId);
                setCategories(data);
            } catch (err) {
                console.error('Failed to load categories:', err);
            }
        };
        loadCategories();
    }, [teamId]);

    // 从团队提示词获取当前内容
    useEffect(() => {
        setTitle(prompt.title || '');
        setContent(prompt.content || '');
        setDescription(prompt.description || '');
        setCategoryId(prompt.team_category_id || null);
    }, [prompt]);

    const handleSave = async () => {
        if (!title.trim() || !content.trim()) {
            setError('标题和内容不能为空');
            return;
        }

        setSaving(true);
        setError(null);

        try {
            // 更新提示词内容
            await teamsApi.updatePrompt(teamId, prompt.prompt_id, {
                title: title.trim(),
                content: content.trim(),
                description: description.trim() || undefined,
                change_note: changeNote.trim() || '更新内容'
            });
            // 更新分类
            if (categoryId !== prompt.team_category_id) {
                await teamsApi.updatePromptCategory(teamId, prompt.prompt_id, categoryId);
            }
            onSuccess();
        } catch (err: any) {
            setError(err.response?.data?.detail || '保存失败');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="glass-card w-full max-w-2xl max-h-[90vh] relative animate-scaleIn flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-[var(--border-primary)] flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-semibold text-[var(--text-primary)]">
                            编辑团队提示词
                        </h3>
                        <p className="text-sm text-[var(--text-muted)] mt-1">
                            修改将仅保存到团队，不影响个人提示词库
                        </p>
                    </div>
                    <button onClick={onClose} className="btn btn-ghost p-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {error && (
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm text-[var(--text-secondary)] mb-2">标题 *</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="输入提示词标题"
                            className="input w-full"
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-[var(--text-secondary)] mb-2">描述</label>
                        <input
                            type="text"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="简短描述提示词用途"
                            className="input w-full"
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-[var(--text-secondary)] mb-2">分类</label>
                        <select
                            value={categoryId || ''}
                            onChange={(e) => setCategoryId(e.target.value || null)}
                            className="input w-full"
                        >
                            <option value="">未分类</option>
                            {categories.map(cat => (
                                <option key={cat.id} value={cat.id}>
                                    {cat.icon} {cat.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm text-[var(--text-secondary)] mb-2">内容 *</label>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="输入提示词内容..."
                            className="input w-full min-h-[200px] resize-y"
                            rows={8}
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-[var(--text-secondary)] mb-2">修改说明</label>
                        <input
                            type="text"
                            value={changeNote}
                            onChange={(e) => setChangeNote(e.target.value)}
                            placeholder="简述本次修改内容（可选）"
                            className="input w-full"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-[var(--border-primary)] flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 btn btn-secondary"
                        disabled={saving}
                    >
                        取消
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || !title.trim() || !content.trim()}
                        className="flex-1 btn btn-primary disabled:opacity-50"
                    >
                        {saving ? '保存中...' : '保存'}
                    </button>
                </div>
            </div>
        </div>
    );
}
