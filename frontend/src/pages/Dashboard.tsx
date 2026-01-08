import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { usePromptStore } from '../stores/promptStore';
import Sidebar from '../components/layout/Sidebar';
import PromptCard from '../components/shared/PromptCard';
import PromptModal from '../components/shared/PromptModal';
import PromptViewModal from '../components/shared/PromptViewModal';
import VersionHistoryModal from '../components/shared/VersionHistoryModal';
import VersionCompareModal from '../components/shared/VersionCompareModal';
import Toast from '../components/ui/Toast';
import type { Prompt } from '../types';

type ViewMode = 'card' | 'list';

/**
 * Dashboard - 主应用界面
 * 类似 Notion/Obsidian 的 Sidebar + Main Content 布局
 * 支持卡片和列表两种视图模式
 */
export default function Dashboard() {
    const navigate = useNavigate();
    const { user, isAuthenticated, logout, checkAuth } = useAuthStore();
    const {
        prompts,
        isLoading,
        fetchPrompts,
        fetchCategories,
        searchQuery,
        setSearchQuery,
        copyPrompt,
        deletePrompt,
        selectedCategoryId,
        setPage,
        pageSize,
        totalPrompts,
        currentPage,
        // Tags
        availableTags,
        selectedTags,
        setSelectedTags,
        fetchTags
    } = usePromptStore();

    const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);

    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
    const [viewingPrompt, setViewingPrompt] = useState<Prompt | null>(null);  // 阅读弹窗
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [searchInput, setSearchInput] = useState('');

    // 版本历史弹窗状态
    const [versionHistoryPrompt, setVersionHistoryPrompt] = useState<Prompt | null>(null);
    const [compareVersions, setCompareVersions] = useState<{ prompt: Prompt; v1: number; v2: number } | null>(null);

    // 视图模式：card 或 list，网页端默认 card，移动端默认 list
    const [viewMode, setViewMode] = useState<ViewMode>(() => {
        const saved = localStorage.getItem('viewMode') as ViewMode;
        if (saved) return saved;
        return window.innerWidth < 768 ? 'list' : 'card';
    });

    // 保存视图模式到 localStorage
    useEffect(() => {
        localStorage.setItem('viewMode', viewMode);
    }, [viewMode]);

    // 检查认证状态
    useEffect(() => {
        checkAuth();
    }, [checkAuth]);

    useEffect(() => {
        if (!isAuthenticated) {
            navigate('/login');
        }
    }, [isAuthenticated, navigate]);

    // 加载数据
    useEffect(() => {
        if (isAuthenticated) {
            fetchCategories();
            fetchPrompts();
            fetchTags(); // 加载可用标签
        }
    }, [isAuthenticated, fetchCategories, fetchPrompts, fetchTags]);

    // 搜索防抖
    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchInput !== searchQuery) {
                setSearchQuery(searchInput);
                fetchPrompts({ search: searchInput });
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [searchInput, searchQuery, setSearchQuery, fetchPrompts]);

    const handleCopy = async (prompt: Prompt) => {
        try {
            await navigator.clipboard.writeText(prompt.content);
            await copyPrompt(prompt.id);
            setToast({ message: '✨ 已复制到剪贴板', type: 'success' });
        } catch {
            setToast({ message: '复制失败', type: 'error' });
        }
    };

    const handleEdit = (prompt: Prompt) => {
        setEditingPrompt(prompt);
        setIsModalOpen(true);
    };

    const handleDelete = async (prompt: Prompt) => {
        if (confirm(`确定要删除 "${prompt.title}" 吗？`)) {
            try {
                await deletePrompt(prompt.id);
                setToast({ message: '删除成功', type: 'success' });
            } catch {
                setToast({ message: '删除失败', type: 'error' });
            }
        }
    };

    const handleNewPrompt = () => {
        setEditingPrompt(null);
        setIsModalOpen(true);
    };

    const handleModalClose = () => {
        setIsModalOpen(false);
        setEditingPrompt(null);
    };

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    if (!isAuthenticated) {
        return null;
    }

    return (
        <div className="min-h-screen bg-[var(--bg-primary)] flex">
            {/* Sidebar */}
            <Sidebar
                isOpen={isSidebarOpen}
                onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
                user={user}
                onLogout={handleLogout}
            />

            {/* Main Content */}
            <main
                className={`flex-1 transition-all duration-300 overflow-x-hidden ${isSidebarOpen ? 'ml-72' : 'ml-0'
                    }`}
            >
                {/* Top Bar */}
                <header className="sticky top-0 z-20 bg-[var(--bg-primary)]/80 backdrop-blur-xl border-b border-[var(--border-secondary)]">
                    <div className="flex items-center justify-between px-6 py-4">
                        <div className="flex items-center gap-4">
                            {/* 移动端菜单按钮 */}
                            <button
                                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                                className="btn btn-ghost p-2 lg:hidden"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                </svg>
                            </button>

                            {/* 搜索框 */}
                            <div className="relative">
                                <svg
                                    className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-tertiary)] pointer-events-none"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <input
                                    type="text"
                                    value={searchInput}
                                    onChange={(e) => setSearchInput(e.target.value)}
                                    placeholder="搜索提示词..."
                                    className="input w-80 bg-[var(--bg-secondary)]"
                                    style={{ paddingLeft: '2.5rem' }}
                                />
                            </div>

                            {/* 标签筛选下拉框 */}
                            <div className="relative">
                                <button
                                    onClick={() => setIsTagDropdownOpen(!isTagDropdownOpen)}
                                    className={`btn btn-ghost px-3 py-2 flex items-center gap-2 border rounded-lg transition-all ${selectedTags.length > 0
                                        ? 'border-[var(--primary-500)] bg-[var(--primary-500)]/10 text-[var(--primary-400)]'
                                        : 'border-[var(--border-secondary)] text-[var(--text-secondary)] hover:border-[var(--border-primary)]'
                                        }`}
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                    </svg>
                                    <span className="text-sm">
                                        {selectedTags.length > 0 ? `已选 ${selectedTags.length} 个标签` : '标签筛选'}
                                    </span>
                                    <svg className={`w-4 h-4 transition-transform ${isTagDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>

                                {/* 下拉列表 */}
                                {isTagDropdownOpen && (
                                    <div
                                        className="absolute top-full left-0 mt-2 w-64 max-h-80 overflow-y-auto glass-card p-2 z-50 animate-slideDown"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {availableTags.length === 0 ? (
                                            <div className="text-sm text-[var(--text-tertiary)] text-center py-4">
                                                暂无可用标签
                                            </div>
                                        ) : (
                                            <>
                                                {/* 清空按钮 */}
                                                {selectedTags.length > 0 && (
                                                    <button
                                                        onClick={() => setSelectedTags([])}
                                                        className="w-full text-left px-3 py-2 text-xs text-[var(--text-tertiary)] hover:text-red-400 transition-colors mb-1"
                                                    >
                                                        ✕ 清除所有筛选
                                                    </button>
                                                )}
                                                {availableTags.map(tag => (
                                                    <label
                                                        key={tag}
                                                        className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--bg-glass)] cursor-pointer transition-colors"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedTags.includes(tag)}
                                                            onChange={() => {
                                                                if (selectedTags.includes(tag)) {
                                                                    setSelectedTags(selectedTags.filter(t => t !== tag));
                                                                } else {
                                                                    setSelectedTags([...selectedTags, tag]);
                                                                }
                                                            }}
                                                            className="w-4 h-4 rounded border-[var(--border-primary)] bg-[var(--bg-tertiary)] text-[var(--primary-500)]"
                                                        />
                                                        <span className="text-sm text-[var(--text-primary)]">{tag}</span>
                                                    </label>
                                                ))}
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            {/* 视图切换按钮 */}
                            <div className="flex items-center glass-card p-1 gap-1">
                                <button
                                    onClick={() => setViewMode('card')}
                                    className={`p-2 rounded-lg transition-all ${viewMode === 'card'
                                        ? 'bg-[var(--primary-500)] text-white'
                                        : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
                                        }`}
                                    title="卡片视图"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                                    </svg>
                                </button>
                                <button
                                    onClick={() => setViewMode('list')}
                                    className={`p-2 rounded-lg transition-all ${viewMode === 'list'
                                        ? 'bg-[var(--primary-500)] text-white'
                                        : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
                                        }`}
                                    title="列表视图"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                    </svg>
                                </button>
                            </div>

                            {/* New Prompt 按钮 */}
                            <button
                                onClick={handleNewPrompt}
                                className="btn btn-primary"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                <span className="hidden sm:inline">新建提示词</span>
                            </button>
                        </div>
                    </div>
                </header>

                {/* Content Area */}
                <div className="p-6">
                    {isLoading ? (
                        // 加载骨架屏
                        viewMode === 'card' ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {[...Array(8)].map((_, i) => (
                                    <div
                                        key={i}
                                        className="glass-card p-6 animate-pulse"
                                    >
                                        <div className="h-5 bg-[var(--bg-tertiary)] rounded w-3/4 mb-4" />
                                        <div className="h-4 bg-[var(--bg-tertiary)] rounded w-full mb-2" />
                                        <div className="h-4 bg-[var(--bg-tertiary)] rounded w-2/3" />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {[...Array(6)].map((_, i) => (
                                    <div
                                        key={i}
                                        className="glass-card p-4 animate-pulse flex items-center gap-4"
                                    >
                                        <div className="h-5 bg-[var(--bg-tertiary)] rounded w-48" />
                                        <div className="flex-1 h-4 bg-[var(--bg-tertiary)] rounded" />
                                        <div className="h-8 bg-[var(--bg-tertiary)] rounded w-20" />
                                    </div>
                                ))}
                            </div>
                        )
                    ) : prompts.length === 0 ? (
                        // 空状态
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="w-20 h-20 rounded-2xl bg-[var(--bg-tertiary)] flex items-center justify-center mb-6">
                                <svg className="w-10 h-10 text-[var(--text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
                                暂无提示词
                            </h3>
                            <p className="text-[var(--text-secondary)] mb-6 max-w-md">
                                {searchInput
                                    ? '没有找到匹配的提示词，试试其他关键词'
                                    : '点击右上角按钮创建你的第一个提示词吧'}
                            </p>
                            {!searchInput && (
                                <button onClick={handleNewPrompt} className="btn btn-primary">
                                    创建提示词
                                </button>
                            )}
                        </div>
                    ) : (
                        // 提示词列表/网格
                        viewMode === 'card' ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {prompts.map((prompt, index) => (
                                    <PromptCard
                                        key={prompt.id}
                                        prompt={prompt}
                                        viewMode="card"
                                        onClick={() => setViewingPrompt(prompt)}
                                        onCopy={() => handleCopy(prompt)}
                                        onEdit={() => handleEdit(prompt)}
                                        onDelete={() => handleDelete(prompt)}
                                        onViewHistory={() => setVersionHistoryPrompt(prompt)}
                                        style={{ animationDelay: `${index * 50}ms` }}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {prompts.map((prompt, index) => (
                                    <PromptCard
                                        key={prompt.id}
                                        prompt={prompt}
                                        viewMode="list"
                                        onClick={() => setViewingPrompt(prompt)}
                                        onCopy={() => handleCopy(prompt)}
                                        onEdit={() => handleEdit(prompt)}
                                        onDelete={() => handleDelete(prompt)}
                                        onViewHistory={() => setVersionHistoryPrompt(prompt)}
                                        style={{ animationDelay: `${index * 30}ms` }}
                                    />
                                ))}
                            </div>
                        )
                    )}
                </div>

                {/* 分页组件 */}
                {
                    totalPrompts > pageSize && (
                        <div className="flex justify-center items-center gap-2 mt-8 pb-8 animate-fadeIn">
                            <button
                                onClick={() => setPage(currentPage - 1)}
                                disabled={currentPage === 1}
                                className="btn btn-ghost p-2 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[var(--bg-secondary)] transition-all"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>

                            <div className="flex items-center gap-1">
                                {Array.from({ length: Math.ceil(totalPrompts / pageSize) }, (_, i) => i + 1)
                                    .filter(page => {
                                        // 简单的智能分页显示逻辑：显示首尾页、当前页及其前后页
                                        return page === 1 ||
                                            page === Math.ceil(totalPrompts / pageSize) ||
                                            Math.abs(page - currentPage) <= 1;
                                    })
                                    .map((page, index, array) => {
                                        // 如果页码不连续，显示省略号
                                        const showEllipsis = index > 0 && page - array[index - 1] > 1;
                                        return (
                                            <div key={page} className="flex items-center">
                                                {showEllipsis && <span className="mx-2 text-[var(--text-tertiary)]">...</span>}
                                                <button
                                                    onClick={() => setPage(page)}
                                                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${currentPage === page
                                                        ? 'bg-[var(--primary-500)] text-white shadow-lg shadow-[var(--primary-500)]/20'
                                                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]'
                                                        }`}
                                                >
                                                    {page}
                                                </button>
                                            </div>
                                        );
                                    })}
                            </div>

                            <button
                                onClick={() => setPage(currentPage + 1)}
                                disabled={currentPage >= Math.ceil(totalPrompts / pageSize)}
                                className="btn btn-ghost p-2 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[var(--bg-secondary)] transition-all"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        </div>
                    )
                }
            </main >

            {/* Prompt Modal */}
            {
                isModalOpen && (
                    <PromptModal
                        prompt={editingPrompt}
                        defaultCategoryId={editingPrompt ? undefined : selectedCategoryId}
                        onClose={handleModalClose}
                        onSuccess={() => {
                            handleModalClose();
                            fetchPrompts();
                            setToast({ message: editingPrompt ? '更新成功' : '创建成功', type: 'success' });
                        }}
                    />
                )
            }

            {/* Toast */}
            {
                toast && (
                    <Toast
                        message={toast.message}
                        type={toast.type}
                        onClose={() => setToast(null)}
                    />
                )
            }

            {/* Prompt View Modal */}
            {
                viewingPrompt && (
                    <PromptViewModal
                        prompt={viewingPrompt}
                        onClose={() => setViewingPrompt(null)}
                        onEdit={() => {
                            setViewingPrompt(null);
                            handleEdit(viewingPrompt);
                        }}
                        onCopy={() => {
                            handleCopy(viewingPrompt);
                        }}
                        onContentModified={async (newContent) => {
                            try {
                                // 调用后端 API 更新提示词内容
                                const { promptApi } = await import('../api/client');
                                await promptApi.update(viewingPrompt.id, { content: newContent });
                                // 刷新列表
                                fetchPrompts();
                                // 更新当前查看的提示词
                                setViewingPrompt({ ...viewingPrompt, content: newContent });
                                setToast({ message: 'AI 修改已应用', type: 'success' });
                            } catch (error) {
                                console.error('Failed to save AI modification:', error);
                                setToast({ message: '保存失败，请重试', type: 'error' });
                            }
                        }}
                    />
                )
            }

            {/* Version History Modal */}
            {
                versionHistoryPrompt && (
                    <VersionHistoryModal
                        prompt={versionHistoryPrompt}
                        onClose={() => setVersionHistoryPrompt(null)}
                        onRestore={(_updated) => {
                            setVersionHistoryPrompt(null);
                            fetchPrompts();
                            setToast({ message: '版本恢复成功', type: 'success' });
                        }}
                        onCompare={(v1, v2) => {
                            setCompareVersions({ prompt: versionHistoryPrompt, v1, v2 });
                        }}
                    />
                )
            }

            {/* Version Compare Modal */}
            {
                compareVersions && (
                    <VersionCompareModal
                        prompt={compareVersions.prompt}
                        version1={compareVersions.v1}
                        version2={compareVersions.v2}
                        onClose={() => setCompareVersions(null)}
                    />
                )
            }
        </div >
    );
}
