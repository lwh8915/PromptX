import { useState, useEffect } from 'react';
import { usePromptStore } from '../../stores/promptStore';
import type { Prompt, Category } from '../../types';

interface PromptModalProps {
    prompt: Prompt | null;
    defaultCategoryId?: string | null;  // 默认选择的分类ID（用于从分类页面创建时）
    onClose: () => void;
    onSuccess: () => void;
}

/**
 * PromptModal - 创建/编辑提示词弹窗
 */
export default function PromptModal({ prompt, defaultCategoryId, onClose, onSuccess }: PromptModalProps) {
    const { categories, createPrompt, updatePrompt } = usePromptStore();
    const [isLoading, setIsLoading] = useState(false);

    const [title, setTitle] = useState(prompt?.title || '');
    const [content, setContent] = useState(prompt?.content || '');
    const [categoryId, setCategoryId] = useState(prompt?.category_id || defaultCategoryId || '');
    const [tagsInput, setTagsInput] = useState(prompt?.tags.join(', ') || '');
    const [description, setDescription] = useState(prompt?.description || '');
    const [isFavorite, setIsFavorite] = useState(prompt?.is_favorite || false);

    const isEditing = !!prompt;

    // ESC 键关闭
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    // 递归获取所有分类（扁平化）
    const flattenCategories = (cats: Category[], depth = 0): { category: Category; depth: number }[] => {
        return cats.flatMap(cat => [
            { category: cat, depth },
            ...flattenCategories(cat.children, depth + 1)
        ]);
    };

    const flatCategories = flattenCategories(categories);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const tags = tagsInput
                .split(',')
                .map(t => t.trim())
                .filter(t => t.length > 0);

            const data = {
                title,
                content,
                category_id: categoryId || undefined,
                tags,
                description: description || undefined,
                is_favorite: isFavorite,
            };

            if (isEditing) {
                await updatePrompt(prompt.id, data);
            } else {
                await createPrompt(data);
            }

            onSuccess();
        } catch (error) {
            console.error('Save failed:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Overlay */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="glass-card w-full max-w-2xl max-h-[90vh] overflow-y-auto relative animate-scaleIn">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-[var(--border-secondary)]">
                    <h2 className="text-xl font-semibold text-[var(--text-primary)]">
                        {isEditing ? '编辑提示词' : '新建提示词'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="btn btn-ghost p-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Title */}
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                            标题 <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="给你的提示词起个名字"
                            className="input"
                            required
                        />
                    </div>

                    {/* Content */}
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                            内容 <span className="text-red-400">*</span>
                        </label>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="输入你的提示词内容..."
                            className="input min-h-[200px] resize-y"
                            required
                        />
                    </div>

                    {/* Category */}
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                            分类
                        </label>
                        <select
                            value={categoryId}
                            onChange={(e) => setCategoryId(e.target.value)}
                            className="input"
                        >
                            <option value="">不选择分类</option>
                            {flatCategories.map(({ category, depth }) => (
                                <option key={category.id} value={category.id}>
                                    {'　'.repeat(depth)}{category.icon || '📁'} {category.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Tags */}
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                            标签
                        </label>
                        <input
                            type="text"
                            value={tagsInput}
                            onChange={(e) => setTagsInput(e.target.value)}
                            placeholder="用逗号分隔多个标签，如：AI, 写作, 创意"
                            className="input"
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                            描述
                        </label>
                        <input
                            type="text"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="简短描述这个提示词的用途（可选）"
                            className="input"
                        />
                    </div>

                    {/* Favorite */}
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setIsFavorite(!isFavorite)}
                            className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${isFavorite
                                ? 'border-yellow-500 bg-yellow-500/20 text-yellow-500'
                                : 'border-[var(--border-primary)] text-transparent'
                                }`}
                        >
                            ⭐
                        </button>
                        <label className="text-sm text-[var(--text-secondary)]">
                            添加到收藏
                        </label>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn btn-secondary"
                        >
                            取消
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading || !title.trim() || !content.trim()}
                            className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <span className="flex items-center gap-2">
                                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    保存中...
                                </span>
                            ) : (
                                isEditing ? '保存修改' : '创建提示词'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
