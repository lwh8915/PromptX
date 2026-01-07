import { useState } from 'react';
import type { Prompt } from '../../types';
import AIModifyModal from './AIModifyModal';

interface PromptViewModalProps {
    prompt: Prompt;
    onClose: () => void;
    onEdit: () => void;
    onCopy: () => void;
    onContentModified?: (newContent: string) => void; // AI 修改后的回调
}

/**
 * PromptViewModal - 提示词阅读弹窗
 * 用于查看提示词的完整内容
 */
export default function PromptViewModal({ prompt, onClose, onEdit, onCopy, onContentModified }: PromptViewModalProps) {
    const [showAIModal, setShowAIModal] = useState(false);

    // ESC 键关闭
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
    };

    const handleAIModified = (newContent: string) => {
        if (onContentModified) {
            onContentModified(newContent);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onKeyDown={handleKeyDown}
            tabIndex={-1}
        >
            {/* Overlay */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="glass-card w-full max-w-3xl max-h-[85vh] overflow-hidden relative animate-scaleIn flex flex-col">
                {/* Header */}
                <div className="flex items-start justify-between p-6 border-b border-[var(--border-secondary)]">
                    <div className="flex-1 min-w-0 pr-4">
                        <div className="flex items-center gap-2 mb-2">
                            {prompt.is_favorite && (
                                <span className="text-yellow-500">⭐</span>
                            )}
                            <h2 className="text-xl font-semibold text-[var(--text-primary)] truncate">
                                {prompt.title}
                            </h2>
                        </div>

                        {/* Tags */}
                        {prompt.tags.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {prompt.tags.map((tag, index) => (
                                    <span
                                        key={index}
                                        className="px-2 py-0.5 text-xs rounded-full bg-[var(--primary-500)]/10 text-[var(--primary-400)] border border-[var(--primary-500)]/20"
                                    >
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    <button
                        onClick={onClose}
                        className="btn btn-ghost p-2 flex-shrink-0"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {/* Description */}
                    {prompt.description && (
                        <div className="mb-4 p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-secondary)]">
                            <p className="text-sm text-[var(--text-secondary)]">
                                {prompt.description}
                            </p>
                        </div>
                    )}

                    {/* Main Content */}
                    <div className="prose prose-invert max-w-none">
                        <pre className="whitespace-pre-wrap text-[var(--text-primary)] bg-[var(--bg-tertiary)] p-4 rounded-xl border border-[var(--border-secondary)] font-mono text-sm leading-relaxed">
                            {prompt.content}
                        </pre>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-4 border-t border-[var(--border-secondary)] bg-[var(--bg-secondary)]/50">
                    <div className="flex items-center gap-3 text-xs text-[var(--text-tertiary)]">
                        {prompt.category_name && (
                            <span className="flex items-center gap-1">
                                <span>📁</span>
                                {prompt.category_name}
                            </span>
                        )}
                        <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            已复制 {prompt.copy_count} 次
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowAIModal(true)}
                            className="btn btn-ghost text-purple-400 hover:text-purple-300 hover:bg-purple-500/10"
                            title="AI 智能修改"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            AI 修改
                        </button>
                        <button
                            onClick={onEdit}
                            className="btn btn-secondary"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            编辑
                        </button>
                        <button
                            onClick={onCopy}
                            className="btn btn-primary"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            复制内容
                        </button>
                    </div>
                </div>
            </div>

            {/* AI 修改弹窗 */}
            {showAIModal && (
                <AIModifyModal
                    content={prompt.content}
                    onClose={() => setShowAIModal(false)}
                    onApply={handleAIModified}
                />
            )}
        </div>
    );
}
