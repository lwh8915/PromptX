import { useState, useEffect } from 'react';
import { usePromptStore } from '../../stores/promptStore';
import type { User, Category } from '../../types';

interface SidebarProps {
    isOpen: boolean;
    onToggle: () => void;
    user: User | null;
    onLogout: () => void;
}

// 预置分类模板
const PRESET_TEMPLATES = [
    { id: 'ecommerce', name: '电商', icon: '🛒' },
    { id: 'novel', name: '小说', icon: '📚' },
    { id: 'programming', name: '编程', icon: '💻' },
    { id: 'ai', name: 'AI', icon: '🤖' },
    { id: 'marketing', name: '营销', icon: '📢' },
    { id: 'writing', name: '写作', icon: '✍️' },
    { id: 'design', name: '设计', icon: '🎨' },
    { id: 'education', name: '教育', icon: '🎓' },
];

/**
 * Sidebar - 侧边栏组件
 * 预置分类勾选后会自动创建为真实分类
 */
export default function Sidebar({ isOpen, onToggle, user, onLogout }: SidebarProps) {
    const {
        categories,
        selectedCategoryId,
        setSelectedCategory,
        createCategory,
        deleteCategory,
        isCategoriesLoading,
        showFavoritesOnly,
        setShowFavoritesOnly,
    } = usePromptStore();

    const [isPresetDropdownOpen, setIsPresetDropdownOpen] = useState(false);

    // 新建分类状态
    const [addingCategoryParentId, setAddingCategoryParentId] = useState<string>('');
    const [newCategoryName, setNewCategoryName] = useState('');

    // 右键菜单
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; category: Category } | null>(null);

    // 检查预置分类是否已存在（通过名称匹配）
    const isPresetCreated = (presetName: string) => {
        return categories.some(c => c.name === presetName);
    };

    // 切换预置分类（勾选=创建，取消=删除）
    const togglePreset = async (preset: typeof PRESET_TEMPLATES[0]) => {
        const existingCategory = categories.find(c => c.name === preset.name);

        if (existingCategory) {
            // 已存在，询问是否删除
            if (confirm(`确定要删除分类 "${preset.name}" 及其所有子分类吗？`)) {
                await deleteCategory(existingCategory.id);
            }
        } else {
            // 检查顶级分类是否已有同名
            if (categories.some(c => c.name === preset.name && !c.parent_id)) {
                alert(`顶级分类下已存在名为 "${preset.name}" 的分类`);
                return;
            }
            // 不存在，创建新分类
            await createCategory(preset.name);
        }
    };

    // 检查同级分类是否有同名
    const checkDuplicateName = (name: string, parentId?: string): boolean => {
        if (parentId === 'root' || !parentId) {
            // 检查顶级分类
            return categories.some(c => c.name === name);
        } else {
            // 检查某个父分类下的子分类
            const findChildren = (cats: Category[]): Category[] => {
                for (const cat of cats) {
                    if (cat.id === parentId) {
                        return cat.children;
                    }
                    const found = findChildren(cat.children);
                    if (found.length > 0 || cat.children.some(c => c.id === parentId)) {
                        return cat.children.find(c => c.id === parentId)?.children || found;
                    }
                }
                return [];
            };
            const siblings = findChildren(categories);
            return siblings.some(c => c.name === name);
        }
    };

    const handleAddCategory = async (parentId?: string) => {
        if (!newCategoryName.trim()) return;

        // 检查同级是否有同名分类
        if (checkDuplicateName(newCategoryName.trim(), parentId)) {
            alert(`同级分类下已存在名为 "${newCategoryName.trim()}" 的分类`);
            return;
        }

        try {
            const actualParentId = parentId === 'root' ? undefined : parentId;
            await createCategory(newCategoryName.trim(), actualParentId);
            setNewCategoryName('');
            setAddingCategoryParentId('');
        } catch {
            // Error handled in store
        }
    };

    const handleDeleteCategory = async (category: Category) => {
        if (confirm(`确定要删除分类 "${category.name}" 吗？`)) {
            await deleteCategory(category.id);
        }
        setContextMenu(null);
    };

    const handleContextMenu = (e: React.MouseEvent, category: Category) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY, category });
    };

    // 开始添加分类
    const startAddCategory = (parentId: string) => {
        setAddingCategoryParentId(parentId);
        setNewCategoryName('');
    };

    // 点击外部关闭菜单
    useEffect(() => {
        const handleClick = () => {
            setContextMenu(null);
            setIsPresetDropdownOpen(false);
        };
        document.addEventListener('click', handleClick);
        return () => document.removeEventListener('click', handleClick);
    }, []);

    // 渲染添加分类输入框
    const renderAddCategoryInput = (parentId: string, depth: number = 0) => {
        if (addingCategoryParentId !== parentId) return null;

        return (
            <div className="flex gap-1.5 my-2" style={{ marginLeft: `${depth * 12}px` }}>
                <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddCategory(parentId || undefined);
                        if (e.key === 'Escape') setAddingCategoryParentId('');
                    }}
                    placeholder="分类名称"
                    className="input text-sm py-1 px-2 flex-1 min-w-0"
                    autoFocus
                />
                <button
                    onClick={() => handleAddCategory(parentId || undefined)}
                    className="btn btn-primary px-2 py-1 text-xs"
                    title="确认"
                >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                </button>
                <button
                    onClick={() => setAddingCategoryParentId('')}
                    className="btn btn-ghost px-2 py-1 text-xs"
                    title="取消"
                >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
        );
    };

    // 渲染分类项（递归支持子分类）
    const renderCategoryItem = (category: Category, depth = 0) => {
        return (
            <div key={category.id}>
                <div
                    className={`group flex items-center gap-1 rounded-lg transition-all ${selectedCategoryId === category.id
                        ? 'bg-[var(--primary-500)]/10 border border-[var(--primary-500)]/30'
                        : 'hover:bg-[var(--bg-glass)]'
                        }`}
                    style={{ marginLeft: `${depth * 12}px` }}
                >
                    <button
                        onClick={() => setSelectedCategory(category.id === selectedCategoryId ? null : category.id)}
                        onContextMenu={(e) => handleContextMenu(e, category)}
                        className={`flex-1 flex items-center justify-between px-3 py-2 text-sm ${selectedCategoryId === category.id
                            ? 'text-[var(--primary-400)]'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                            }`}
                    >
                        <span className="flex items-center gap-2 truncate">
                            <span>{category.icon || '📁'}</span>
                            <span>{category.name}</span>
                        </span>
                        <span className="text-xs text-[var(--text-tertiary)]">
                            {category.prompt_count}
                        </span>
                    </button>

                    {/* 添加子分类按钮 */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            startAddCategory(category.id);
                        }}
                        className="p-1.5 mr-1 text-[var(--text-tertiary)] hover:text-[var(--primary-400)] opacity-0 group-hover:opacity-100 transition-all"
                        title="添加子分类"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                    </button>

                    {/* 删除按钮 */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCategory(category);
                        }}
                        className="p-1.5 mr-1 text-[var(--text-tertiary)] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                        title="删除分类"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* 添加子分类输入框 */}
                {renderAddCategoryInput(category.id, depth + 1)}

                {/* 渲染子分类 */}
                {category.children.map(child => renderCategoryItem(child, depth + 1))}
            </div>
        );
    };

    return (
        <>
            {/* Overlay for mobile */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-30 lg:hidden"
                    onClick={onToggle}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`fixed top-0 left-0 h-full w-72 bg-[var(--bg-secondary)] border-r border-[var(--border-secondary)] z-40 transition-transform duration-300 flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-[var(--border-secondary)]">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--primary-500)] to-[var(--accent-500)] flex items-center justify-center">
                            <span className="text-white font-bold">P</span>
                        </div>
                        <span className="font-semibold text-[var(--text-primary)]">Prompt Manager</span>
                    </div>
                    <button
                        onClick={onToggle}
                        className="btn btn-ghost p-2 lg:hidden"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* 快速添加预置分类 */}
                <div className="p-4 border-b border-[var(--border-secondary)]">
                    <label className="block text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-2">
                        快速添加分类
                    </label>
                    <div className="relative">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsPresetDropdownOpen(!isPresetDropdownOpen);
                            }}
                            className="input text-sm py-2 bg-[var(--bg-tertiary)] w-full text-left flex items-center justify-between"
                        >
                            <span className="text-[var(--text-secondary)]">
                                选择预置分类模板...
                            </span>
                            <svg
                                className={`w-4 h-4 text-[var(--text-tertiary)] transition-transform ${isPresetDropdownOpen ? 'rotate-180' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>

                        {/* 下拉多选列表 */}
                        {isPresetDropdownOpen && (
                            <div
                                className="absolute top-full left-0 right-0 mt-1 glass-card p-2 z-50 max-h-64 overflow-y-auto animate-slideDown"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {PRESET_TEMPLATES.map(preset => {
                                    const isCreated = isPresetCreated(preset.name);
                                    return (
                                        <label
                                            key={preset.id}
                                            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--bg-glass)] cursor-pointer transition-colors"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isCreated}
                                                onChange={() => togglePreset(preset)}
                                                className="w-4 h-4 rounded border-[var(--border-primary)] bg-[var(--bg-tertiary)] text-[var(--primary-500)]"
                                            />
                                            <span className="text-lg">{preset.icon}</span>
                                            <span className="text-sm text-[var(--text-primary)]">{preset.name}</span>
                                            {isCreated && (
                                                <span className="text-xs text-[var(--text-tertiary)] ml-auto">已添加</span>
                                            )}
                                        </label>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Category Tree */}
                <div className="flex-1 overflow-y-auto p-4">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
                            分类
                        </span>
                        <button
                            onClick={() => startAddCategory('root')}
                            className="text-[var(--text-tertiary)] hover:text-[var(--primary-400)] transition-colors"
                            title="新建分类"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                        </button>
                    </div>

                    {/* 全部提示词 */}
                    <button
                        onClick={() => {
                            setSelectedCategory(null);
                            setShowFavoritesOnly(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm mb-1 transition-all ${selectedCategoryId === null && !showFavoritesOnly
                            ? 'bg-[var(--primary-500)]/10 text-[var(--primary-400)] border border-[var(--primary-500)]/30'
                            : 'text-[var(--text-secondary)] hover:bg-[var(--bg-glass)] hover:text-[var(--text-primary)]'
                            }`}
                    >
                        <span className="flex items-center gap-2">
                            <span>📋</span>
                            <span>全部提示词</span>
                        </span>
                    </button>

                    {/* 我的收藏 */}
                    <button
                        onClick={() => {
                            setSelectedCategory(null);
                            setShowFavoritesOnly(true);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm mb-2 transition-all ${showFavoritesOnly
                            ? 'bg-[var(--primary-500)]/10 text-[var(--primary-400)] border border-[var(--primary-500)]/30'
                            : 'text-[var(--text-secondary)] hover:bg-[var(--bg-glass)] hover:text-[var(--text-primary)]'
                            }`}
                    >
                        <span className="flex items-center gap-2">
                            <span>⭐</span>
                            <span>我的收藏</span>
                        </span>
                    </button>

                    {/* 添加根分类输入框 */}
                    {renderAddCategoryInput('root', 0)}

                    {/* 分类列表 */}
                    {isCategoriesLoading ? (
                        <div className="space-y-2">
                            {[...Array(3)].map((_, i) => (
                                <div key={i} className="h-9 bg-[var(--bg-tertiary)] rounded-lg animate-pulse" />
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {categories.map(category => renderCategoryItem(category))}
                        </div>
                    )}
                </div>

                {/* User Profile */}
                <div className="p-4 border-t border-[var(--border-secondary)]">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--primary-500)] to-[var(--accent-500)] flex items-center justify-center text-white font-medium">
                            {user?.username?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                                {user?.username || 'User'}
                            </p>
                            <p className="text-xs text-[var(--text-tertiary)] truncate">
                                {user?.email}
                            </p>
                        </div>
                        <button
                            onClick={onLogout}
                            className="btn btn-ghost p-2 text-[var(--text-tertiary)] hover:text-red-400"
                            title="退出登录"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                        </button>
                    </div>
                </div>
            </aside>

            {/* Context Menu */}
            {contextMenu && (
                <div
                    className="fixed z-50 glass-card p-2 min-w-[140px] animate-scaleIn"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        onClick={() => handleDeleteCategory(contextMenu.category)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        删除分类
                    </button>
                </div>
            )}
        </>
    );
}
