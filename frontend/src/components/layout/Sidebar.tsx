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
        // setShowFavoritesOnly, // 不再需要直接设置
        viewFavorites,
        viewAll,
    } = usePromptStore();

    const [isPresetDropdownOpen, setIsPresetDropdownOpen] = useState(false);

    // 部署状态
    const [isDeploying, setIsDeploying] = useState(false);
    const [deployStatus, setDeployStatus] = useState<'idle' | 'building' | 'pushing' | 'success' | 'error'>('idle');

    // 新建分类状态
    const [addingCategoryParentId, setAddingCategoryParentId] = useState<string>('');
    const [newCategoryName, setNewCategoryName] = useState('');

    // 展开/收起状态 (存储展开的 category.id)
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

    // 切换分类展开状态
    const toggleCategory = (categoryId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const newExpanded = new Set(expandedCategories);
        if (newExpanded.has(categoryId)) {
            newExpanded.delete(categoryId);
        } else {
            newExpanded.add(categoryId);
        }
        setExpandedCategories(newExpanded);
    };

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
        const hasChildren = category.children && category.children.length > 0;
        const isExpanded = expandedCategories.has(category.id);

        return (
            <div key={category.id}>
                <div
                    className={`group flex items-center gap-1 rounded-lg transition-all ${selectedCategoryId === category.id
                        ? 'bg-[var(--primary-500)]/10 border border-[var(--primary-500)]/30'
                        : 'hover:bg-[var(--bg-glass)]'
                        }`}
                    style={{ marginLeft: `${depth * 12}px` }}
                // 当点击整个行时，如果只是选择分类，不应该触发展开；
                // 用户习惯可能是点击左侧箭头展开，点击文字选择。
                // 但这里为了方便，我们只用专门的按钮来展开/收起，或者点击箭头区域。
                >
                    {/* 展开/收起箭头 (仅当有子分类或 depth=0(可选) 时显示，这里只针对有子分类显示) */}
                    <button
                        onClick={(e) => toggleCategory(category.id, e)}
                        className={`p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] transition-colors ${hasChildren ? 'visible' : 'invisible'
                            }`}
                    >
                        <svg
                            className={`w-3 h-3 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>

                    <button
                        onClick={() => setSelectedCategory(category.id === selectedCategoryId ? null : category.id)}
                        onContextMenu={(e) => handleContextMenu(e, category)}
                        className={`flex-1 flex items-center justify-between py-2 text-sm ${selectedCategoryId === category.id
                            ? 'text-[var(--primary-400)]'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                            }`}
                    >
                        <span className="flex items-center gap-2 truncate">
                            <span>{category.icon || '📁'}</span>
                            <span>{category.name}</span>
                        </span>
                        <span className="text-xs text-[var(--text-tertiary)] px-2">
                            {category.prompt_count}
                        </span>
                    </button>

                    {/* 添加子分类按钮 */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            // 添加子分类时自动展开
                            if (!expandedCategories.has(category.id)) {
                                const newExpanded = new Set(expandedCategories);
                                newExpanded.add(category.id);
                                setExpandedCategories(newExpanded);
                            }
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

                {/* 添加子分类输入框 (只有展开时或者正在添加时才显示) */}
                {/* 这里的逻辑：如果正在添加子分类，应该显示输入框。输入框显示位置通常在子列表顶部。
                    如果不展开，是否显示？通常添加时应该自动展开。我在上面添加按钮里做了自动展开。
                */}
                <div className={`transition-[grid-template-rows] duration-200 grid ${isExpanded || addingCategoryParentId === category.id ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                    <div className="overflow-hidden">
                        {renderAddCategoryInput(category.id, depth + 1)}
                        {category.children.map(child => renderCategoryItem(child, depth + 1))}
                    </div>
                </div>
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
                        onClick={viewAll}
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
                        onClick={viewFavorites}
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
                    {/* 一键发布按钮 (仅在开发环境显示，这里为了演示默认显示) */}
                    {/* 一键发布按钮组 */}
                    <div className="flex gap-2 mt-3">
                        <button
                            onClick={async () => {
                                if (isDeploying) return;

                                // 获取 Webhook 配置
                                const webhookUrl = localStorage.getItem('deploy_webhook_url');
                                const webhookToken = localStorage.getItem('deploy_webhook_token');

                                if (!confirm(`确定要构建并推送新镜像到 Docker Hub 吗？\n${webhookUrl ? `并触发服务器更新 (${webhookUrl})` : '(仅推送，不触发服务器更新)'}`)) return;

                                setIsDeploying(true);
                                setDeployStatus('building');

                                try {
                                    const { deployApi } = await import('../../api/client');
                                    await deployApi.triggerDeploy(webhookUrl || undefined, webhookToken || undefined);

                                    // 后台任务已启动，显示进行中状态
                                    setDeployStatus('pushing');

                                    // 模拟等待（后台任务实际可能需要几分钟）
                                    setTimeout(() => {
                                        setDeployStatus('success');
                                        setTimeout(() => {
                                            setIsDeploying(false);
                                            setDeployStatus('idle');
                                        }, 3000);
                                    }, 2000);

                                } catch (error) {
                                    console.error('Deploy failed:', error);
                                    setDeployStatus('error');
                                    setTimeout(() => {
                                        setIsDeploying(false);
                                        setDeployStatus('idle');
                                    }, 3000);
                                }
                            }}
                            disabled={isDeploying}
                            className={`flex-1 btn text-xs flex items-center justify-center gap-2 py-2 rounded-lg transition-all ${isDeploying
                                    ? deployStatus === 'error'
                                        ? 'bg-red-500/20 border-red-500/50 text-red-400 cursor-not-allowed'
                                        : deployStatus === 'success'
                                            ? 'bg-green-500/20 border-green-500/50 text-green-400'
                                            : 'bg-blue-500/20 border-blue-500/50 text-blue-400 cursor-wait'
                                    : 'btn-ghost text-[var(--text-secondary)] hover:text-[var(--primary-400)] border border-dashed border-[var(--border-secondary)] hover:border-[var(--primary-500)]'
                                }`}
                        >
                            {isDeploying ? (
                                deployStatus === 'success' ? (
                                    <>
                                        <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        部署成功！
                                    </>
                                ) : deployStatus === 'error' ? (
                                    <>
                                        <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                        部署失败
                                    </>
                                ) : (
                                    <>
                                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        {deployStatus === 'building' ? '构建中...' : '推送中...'}
                                    </>
                                )
                            ) : (
                                <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                                    </svg>
                                    发布更新
                                </>
                            )}
                        </button>

                        <button
                            onClick={() => {
                                const currentUrl = localStorage.getItem('deploy_webhook_url') || '';
                                const currentToken = localStorage.getItem('deploy_webhook_token') || '';

                                const url = prompt(' 配置服务器 Watchtower Webhook URL (例如 http://your-server:8080/v1/update):\n(留空则仅进行 Docker Hub 推送)', currentUrl);
                                if (url === null) return;
                                localStorage.setItem('deploy_webhook_url', url);

                                if (url) {
                                    const token = prompt('配置 Watchtower Token (可选):', currentToken);
                                    if (token !== null) {
                                        localStorage.setItem('deploy_webhook_token', token);
                                    }
                                }
                                alert('✅ 配置已保存');
                            }}
                            className="btn btn-ghost px-2 text-[var(--text-tertiary)] hover:text-[var(--primary-400)] border border-dashed border-[var(--border-secondary)] hover:border-[var(--primary-500)] rounded-lg transition-all"
                            title="配置发布参数"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </button>
                    </div>
                </div>

            </aside >

            {/* Context Menu */}
            {
                contextMenu && (
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
                )
            }
        </>
    );
}
