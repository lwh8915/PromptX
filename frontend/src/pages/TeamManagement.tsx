import { useEffect, useState } from 'react';
import { teamsApi, type Team, type TeamMember, type TeamPrompt, type TeamCategory } from '../api/client';
import Toast from '../components/ui/Toast';
import PromptCard from '../components/shared/PromptCard';
import PromptViewModal from '../components/shared/PromptViewModal';
import TeamVersionHistoryModal from '../components/shared/TeamVersionHistoryModal';
import TeamPromptEditModal from '../components/shared/TeamPromptEditModal';
import type { Prompt } from '../types';

type ViewMode = 'card' | 'list';

/**
 * TeamManagement - 团队管理页面
 * 包含团队列表、创建团队、加入团队、团队详情（成员管理、共享提示词）
 */
export default function TeamManagement() {
    const [teams, setTeams] = useState<Team[]>([]);
    const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [prompts, setPrompts] = useState<TeamPrompt[]>([]);
    const [promptsTotal, setPromptsTotal] = useState(0);
    const [promptsPage, setPromptsPage] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'members' | 'prompts'>('prompts');

    // 分类相关状态
    const [categories, setCategories] = useState<TeamCategory[]>([]);
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null | undefined>(undefined);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [editingCategory, setEditingCategory] = useState<TeamCategory | null>(null);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newCategoryIcon, setNewCategoryIcon] = useState('📁');

    // 视图模式
    const [viewMode, setViewMode] = useState<ViewMode>('card');

    // Modal states
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showJoinModal, setShowJoinModal] = useState(false);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [showAdminModal, setShowAdminModal] = useState(false);
    const [adminTab, setAdminTab] = useState<'categories' | 'members' | 'settings'>('categories');

    // Prompt modals
    const [viewingPrompt, setViewingPrompt] = useState<Prompt | null>(null);
    const [editingTeamPrompt, setEditingTeamPrompt] = useState<TeamPrompt | null>(null);
    const [versionHistoryPromptId, setVersionHistoryPromptId] = useState<string | null>(null);
    const [versionHistoryPromptTitle, setVersionHistoryPromptTitle] = useState<string>('');

    // Form states
    const [newTeamName, setNewTeamName] = useState('');
    const [newTeamDesc, setNewTeamDesc] = useState('');
    const [inviteCode, setInviteCode] = useState('');
    const [editTeamName, setEditTeamName] = useState('');
    const [editTeamDesc, setEditTeamDesc] = useState('');

    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    // 加载团队列表
    const loadTeams = async () => {
        setIsLoading(true);
        try {
            const data = await teamsApi.getMyTeams();
            setTeams(data);
            if (data.length > 0 && !selectedTeam) {
                setSelectedTeam(data[0]);
            }
        } catch (error) {
            console.error('Failed to load teams:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // 加载团队成员
    const loadMembers = async (teamId: string) => {
        try {
            const data = await teamsApi.getMembers(teamId);
            setMembers(data);
        } catch (error) {
            console.error('Failed to load members:', error);
        }
    };

    // 加载团队提示词
    const loadPrompts = async (teamId: string, page = 1, categoryId?: string | null) => {
        try {
            const data = await teamsApi.getPrompts(teamId, { page, page_size: 20 });
            // 如果有分类筛选，在前端过滤
            // 分类筛选：undefined = 全部, null = 未分类, string = 指定分类
            let filteredItems = data.items;
            if (categoryId === null) {
                // null 表示"未分类"
                filteredItems = data.items.filter(p => !p.team_category_id);
            } else if (categoryId !== undefined) {
                // 具体分类ID
                filteredItems = data.items.filter(p => p.team_category_id === categoryId);
            }
            // undefined 表示"全部"，不过滤
            setPrompts(filteredItems);
            setPromptsTotal(filteredItems.length);
            setPromptsPage(page);
        } catch (error) {
            console.error('Failed to load prompts:', error);
        }
    };

    // 加载团队分类
    const loadCategories = async (teamId: string) => {
        try {
            const data = await teamsApi.getCategories(teamId);
            setCategories(data);
        } catch (error) {
            console.error('Failed to load categories:', error);
        }
    };

    useEffect(() => {
        loadTeams();
    }, []);

    useEffect(() => {
        if (selectedTeam) {
            loadMembers(selectedTeam.id);
            loadPrompts(selectedTeam.id, 1, selectedCategoryId);
            loadCategories(selectedTeam.id);
        }
    }, [selectedTeam?.id]);

    // 创建团队
    const handleCreateTeam = async () => {
        if (!newTeamName.trim()) {
            setToast({ message: '请输入团队名称', type: 'error' });
            return;
        }
        try {
            const team = await teamsApi.create({ name: newTeamName.trim(), description: newTeamDesc.trim() || undefined });
            setTeams(prev => [...prev, team]);
            setSelectedTeam(team);
            setShowCreateModal(false);
            setNewTeamName('');
            setNewTeamDesc('');
            setToast({ message: '团队创建成功', type: 'success' });
        } catch (error: any) {
            setToast({ message: error.response?.data?.detail || '创建失败', type: 'error' });
        }
    };

    // 加入团队
    const handleJoinTeam = async () => {
        if (!inviteCode.trim()) {
            setToast({ message: '请输入邀请码', type: 'error' });
            return;
        }
        try {
            const result = await teamsApi.join(inviteCode.trim());
            setToast({ message: result.message, type: 'success' });
            setShowJoinModal(false);
            setInviteCode('');
            loadTeams();
        } catch (error: any) {
            setToast({ message: error.response?.data?.detail || '加入失败', type: 'error' });
        }
    };

    // 复制邀请码
    const handleCopyInviteCode = () => {
        if (selectedTeam) {
            navigator.clipboard.writeText(selectedTeam.invite_code);
            setToast({ message: '邀请码已复制', type: 'success' });
        }
    };

    // 重新生成邀请码
    const handleRegenerateCode = async () => {
        if (!selectedTeam) return;
        try {
            const result = await teamsApi.regenerateInviteCode(selectedTeam.id);
            setSelectedTeam(prev => prev ? { ...prev, invite_code: result.invite_code } : null);
            setToast({ message: '邀请码已更新', type: 'success' });
        } catch (error: any) {
            setToast({ message: error.response?.data?.detail || '操作失败', type: 'error' });
        }
    };

    // 更新成员角色
    const handleUpdateRole = async (userId: string, role: 'admin' | 'member') => {
        if (!selectedTeam) return;
        try {
            await teamsApi.updateMemberRole(selectedTeam.id, userId, role);
            loadMembers(selectedTeam.id);
            setToast({ message: '角色已更新', type: 'success' });
        } catch (error: any) {
            setToast({ message: error.response?.data?.detail || '操作失败', type: 'error' });
        }
    };

    // 移除成员
    const handleRemoveMember = async (userId: string) => {
        if (!selectedTeam || !confirm('确定要移除该成员吗？')) return;
        try {
            await teamsApi.removeMember(selectedTeam.id, userId);
            loadMembers(selectedTeam.id);
            setToast({ message: '成员已移除', type: 'success' });
        } catch (error: any) {
            setToast({ message: error.response?.data?.detail || '操作失败', type: 'error' });
        }
    };

    // 取消共享
    const handleUnshare = async (promptId: string) => {
        if (!selectedTeam || !confirm('确定要取消共享吗？')) return;
        try {
            await teamsApi.unsharePrompt(selectedTeam.id, promptId);
            loadPrompts(selectedTeam.id, promptsPage);
            setToast({ message: '已取消共享', type: 'success' });
        } catch (error: any) {
            setToast({ message: error.response?.data?.detail || '操作失败', type: 'error' });
        }
    };

    // 退出团队
    const handleLeaveTeam = async () => {
        if (!selectedTeam || !confirm('确定要退出该团队吗？')) return;
        try {
            await teamsApi.leave(selectedTeam.id);
            setTeams(prev => prev.filter(t => t.id !== selectedTeam.id));
            setSelectedTeam(teams.length > 1 ? teams.find(t => t.id !== selectedTeam.id) || null : null);
            setToast({ message: '已退出团队', type: 'success' });
        } catch (error: any) {
            setToast({ message: error.response?.data?.detail || '操作失败', type: 'error' });
        }
    };

    // 删除团队
    const handleDeleteTeam = async () => {
        if (!selectedTeam || !confirm('确定要删除该团队吗？此操作不可恢复！')) return;
        try {
            await teamsApi.delete(selectedTeam.id);
            setTeams(prev => prev.filter(t => t.id !== selectedTeam.id));
            setSelectedTeam(null);
            setToast({ message: '团队已删除', type: 'success' });
        } catch (error: any) {
            setToast({ message: error.response?.data?.detail || '操作失败', type: 'error' });
        }
    };

    // 更新团队信息
    const handleUpdateTeamInfo = async () => {
        if (!selectedTeam || !editTeamName.trim()) {
            setToast({ message: '团队名称不能为空', type: 'error' });
            return;
        }
        try {
            const updated = await teamsApi.update(selectedTeam.id, {
                name: editTeamName.trim(),
                description: editTeamDesc.trim() || undefined
            });
            setTeams(prev => prev.map(t => t.id === selectedTeam.id ? updated : t));
            setSelectedTeam(updated);
            setToast({ message: '团队信息已更新', type: 'success' });
        } catch (error: any) {
            setToast({ message: error.response?.data?.detail || '更新失败', type: 'error' });
        }
    };

    // ============ 分类管理 ============

    // 选择分类筛选
    const handleSelectCategory = (categoryId: string | null | 'all') => {
        if (categoryId === 'all') {
            setSelectedCategoryId(null);
            if (selectedTeam) loadPrompts(selectedTeam.id, 1, undefined);
        } else {
            setSelectedCategoryId(categoryId);
            if (selectedTeam) loadPrompts(selectedTeam.id, 1, categoryId);
        }
    };

    // 创建分类
    const handleCreateCategory = async () => {
        if (!selectedTeam || !newCategoryName.trim()) return;
        try {
            await teamsApi.createCategory(selectedTeam.id, { name: newCategoryName.trim(), icon: newCategoryIcon });
            loadCategories(selectedTeam.id);
            setShowCategoryModal(false);
            setNewCategoryName('');
            setNewCategoryIcon('📁');
            setToast({ message: '分类创建成功', type: 'success' });
        } catch (error: any) {
            setToast({ message: error.response?.data?.detail || '创建失败', type: 'error' });
        }
    };

    // 更新分类
    const handleUpdateCategory = async () => {
        if (!selectedTeam || !editingCategory || !newCategoryName.trim()) return;
        try {
            await teamsApi.updateCategory(selectedTeam.id, editingCategory.id, { name: newCategoryName.trim(), icon: newCategoryIcon });
            loadCategories(selectedTeam.id);
            setEditingCategory(null);
            setShowCategoryModal(false);
            setNewCategoryName('');
            setNewCategoryIcon('📁');
            setToast({ message: '分类已更新', type: 'success' });
        } catch (error: any) {
            setToast({ message: error.response?.data?.detail || '更新失败', type: 'error' });
        }
    };

    // 删除分类
    const handleDeleteCategory = async (categoryId: string) => {
        if (!selectedTeam || !confirm('确定要删除该分类吗？该分类下的提示词将变为未分类。')) return;
        try {
            await teamsApi.deleteCategory(selectedTeam.id, categoryId);
            loadCategories(selectedTeam.id);
            if (selectedCategoryId === categoryId) {
                handleSelectCategory('all');
            }
            setToast({ message: '分类已删除', type: 'success' });
        } catch (error: any) {
            setToast({ message: error.response?.data?.detail || '删除失败', type: 'error' });
        }
    };

    // 打开编辑分类弹窗
    const openEditCategoryModal = (cat: TeamCategory) => {
        setEditingCategory(cat);
        setNewCategoryName(cat.name);
        setNewCategoryIcon(cat.icon);
        setShowCategoryModal(true);
    };

    // 打开创建分类弹窗
    const openCreateCategoryModal = () => {
        setEditingCategory(null);
        setNewCategoryName('');
        setNewCategoryIcon('📁');
        setShowCategoryModal(true);
    };

    // 转换 TeamPrompt 为 Prompt 类型
    const convertToPrompt = (tp: TeamPrompt): Prompt => ({
        id: tp.prompt_id,
        user_id: tp.shared_by,
        title: tp.title,
        content: tp.content,
        description: tp.description || '',
        tags: tp.tags,
        category_id: undefined,
        category_name: tp.category,
        is_favorite: false,
        copy_count: tp.copy_count,
        version_count: tp.version_count,
        current_version: tp.version_count,
        created_at: tp.shared_at,
        updated_at: tp.shared_at
    });

    // 复制内容到剪贴板
    const handleCopyContent = async (prompt: TeamPrompt) => {
        try {
            await navigator.clipboard.writeText(prompt.content);
            // 增加团队复制计数
            if (selectedTeam) {
                await teamsApi.incrementCopyCount(selectedTeam.id, prompt.prompt_id);
                // 更新本地状态
                setPrompts(prev => prev.map(p =>
                    p.prompt_id === prompt.prompt_id
                        ? { ...p, copy_count: p.copy_count + 1 }
                        : p
                ));
            }
            setToast({ message: '已复制到剪贴板', type: 'success' });
        } catch {
            setToast({ message: '复制失败', type: 'error' });
        }
    };

    // 编辑提示词（打开团队编辑弹窗）
    const handleEditPrompt = (prompt: TeamPrompt) => {
        setEditingTeamPrompt(prompt);
    };

    // 查看版本历史
    const handleViewHistory = (prompt: TeamPrompt) => {
        setVersionHistoryPromptId(prompt.prompt_id);
        setVersionHistoryPromptTitle(prompt.title);
    };

    // 团队编辑保存成功后刷新
    const handleTeamEditSuccess = () => {
        setEditingTeamPrompt(null);
        if (selectedTeam) {
            loadPrompts(selectedTeam.id, promptsPage);
        }
        setToast({ message: '保存成功', type: 'success' });
    };

    const totalPages = Math.ceil(promptsTotal / 20);
    const canManage = selectedTeam?.my_role === 'owner' || selectedTeam?.my_role === 'admin';

    return (
        <div className="h-full flex bg-[var(--bg-primary)]">
            {/* Toast */}
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* 左侧团队列表 */}
            <div className="w-72 border-r border-[var(--border-primary)] flex flex-col">
                <div className="p-4 border-b border-[var(--border-primary)]">
                    <div className="flex items-center gap-3 mb-3">
                        <a
                            href="/dashboard"
                            className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                            title="返回 Dashboard"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                        </a>
                        <h2 className="text-lg font-bold text-[var(--text-primary)]">我的团队</h2>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="flex-1 btn btn-primary text-sm py-2"
                        >
                            创建团队
                        </button>
                        <button
                            onClick={() => setShowJoinModal(true)}
                            className="flex-1 btn btn-secondary text-sm py-2"
                        >
                            加入团队
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2">
                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <div className="animate-spin rounded-full h-6 w-6 border-2 border-[var(--primary-500)] border-t-transparent" />
                        </div>
                    ) : teams.length === 0 ? (
                        <div className="text-center py-8 text-[var(--text-muted)]">
                            <p>暂无团队</p>
                            <p className="text-sm mt-2">创建或加入一个团队开始协作</p>
                        </div>
                    ) : (
                        teams.map(team => (
                            <button
                                key={team.id}
                                onClick={() => setSelectedTeam(team)}
                                className={`w-full text-left p-3 rounded-lg mb-2 transition-colors ${selectedTeam?.id === team.id
                                    ? 'bg-[var(--primary-500)]/20 border border-[var(--primary-500)]'
                                    : 'hover:bg-[var(--bg-tertiary)] border border-transparent'
                                    }`}
                            >
                                <div className="font-medium text-[var(--text-primary)]">{team.name}</div>
                                <div className="text-xs text-[var(--text-muted)] mt-1">
                                    {team.member_count} 位成员 ·
                                    {team.my_role === 'owner' ? ' 创建者' : team.my_role === 'admin' ? ' 管理员' : ' 成员'}
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* 右侧详情 */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {selectedTeam ? (
                    <>
                        {/* 团队头部 */}
                        <div className="p-6 border-b border-[var(--border-primary)]">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h1 className="text-2xl font-bold text-[var(--text-primary)]">{selectedTeam.name}</h1>
                                    {selectedTeam.description && (
                                        <p className="text-[var(--text-secondary)] mt-1">{selectedTeam.description}</p>
                                    )}
                                </div>
                                <div className="flex items-center gap-3">
                                    {selectedTeam.my_role === 'owner' ? (
                                        <button
                                            onClick={() => setShowAdminModal(true)}
                                            className="btn btn-primary text-sm flex items-center gap-2"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                            管理团队
                                        </button>
                                    ) : (
                                        <button
                                            onClick={handleLeaveTeam}
                                            className="btn btn-secondary text-sm"
                                        >
                                            退出团队
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b border-[var(--border-primary)] px-6">
                            <button
                                onClick={() => setActiveTab('prompts')}
                                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'prompts'
                                    ? 'border-[var(--primary-500)] text-[var(--primary-500)]'
                                    : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                    }`}
                            >
                                共享提示词 ({promptsTotal})
                            </button>
                            <button
                                onClick={() => setActiveTab('members')}
                                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'members'
                                    ? 'border-[var(--primary-500)] text-[var(--primary-500)]'
                                    : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                    }`}
                            >
                                成员管理 ({members.length})
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6">
                            {activeTab === 'prompts' ? (
                                <>
                                    {/* Categories Filter Bar */}
                                    <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
                                        <button
                                            onClick={() => handleSelectCategory('all')}
                                            className={`px-3 py-1.5 text-sm rounded-lg whitespace-nowrap transition-colors ${selectedCategoryId === null
                                                ? 'bg-[var(--primary-500)] text-white'
                                                : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'
                                                }`}
                                        >
                                            📋 全部
                                        </button>
                                        <button
                                            onClick={() => handleSelectCategory(null)}
                                            className={`px-3 py-1.5 text-sm rounded-lg whitespace-nowrap transition-colors ${selectedCategoryId === null
                                                ? ''
                                                : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'
                                                }`}
                                            style={{ display: 'none' }}
                                        >
                                            未分类
                                        </button>
                                        {categories.map(cat => (
                                            <button
                                                key={cat.id}
                                                onClick={() => handleSelectCategory(cat.id)}
                                                className={`px-3 py-1.5 text-sm rounded-lg whitespace-nowrap transition-colors ${selectedCategoryId === cat.id
                                                    ? 'bg-[var(--primary-500)] text-white'
                                                    : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'
                                                    }`}
                                            >
                                                {cat.icon} {cat.name}
                                            </button>
                                        ))}
                                    </div>

                                    {prompts.length === 0 ? (
                                        <div className="text-center py-16 text-[var(--text-muted)]">
                                            <p className="text-lg">暂无共享提示词</p>
                                            <p className="text-sm mt-2">成员可以从个人库中分享提示词到团队</p>
                                        </div>
                                    ) : (
                                        <>
                                            {/* View Mode Toggle */}
                                            <div className="flex items-center justify-between mb-4">
                                                <span className="text-sm text-[var(--text-secondary)]">
                                                    共 {promptsTotal} 个提示词
                                                </span>
                                                <div className="flex items-center gap-1 bg-[var(--bg-tertiary)] rounded-lg p-1">
                                                    <button
                                                        onClick={() => setViewMode('card')}
                                                        className={`p-2 rounded transition-colors ${viewMode === 'card'
                                                            ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)]'
                                                            : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                                                            }`}
                                                        title="卡片视图"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                                                        </svg>
                                                    </button>
                                                    <button
                                                        onClick={() => setViewMode('list')}
                                                        className={`p-2 rounded transition-colors ${viewMode === 'list'
                                                            ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)]'
                                                            : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                                                            }`}
                                                        title="列表视图"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Prompt Cards */}
                                            {viewMode === 'card' ? (
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                    {prompts.map((tp, index) => (
                                                        <PromptCard
                                                            key={tp.id}
                                                            prompt={convertToPrompt(tp)}
                                                            viewMode="card"
                                                            onClick={() => setViewingPrompt(convertToPrompt(tp))}
                                                            onCopy={() => handleCopyContent(tp)}
                                                            onEdit={() => handleEditPrompt(tp)}
                                                            onDelete={() => handleUnshare(tp.prompt_id)}
                                                            onViewHistory={() => handleViewHistory(tp)}
                                                            style={{ animationDelay: `${index * 50}ms` }}
                                                        />
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    {prompts.map((tp, index) => (
                                                        <PromptCard
                                                            key={tp.id}
                                                            prompt={convertToPrompt(tp)}
                                                            viewMode="list"
                                                            onClick={() => setViewingPrompt(convertToPrompt(tp))}
                                                            onCopy={() => handleCopyContent(tp)}
                                                            onEdit={() => handleEditPrompt(tp)}
                                                            onDelete={() => handleUnshare(tp.prompt_id)}
                                                            onViewHistory={() => handleViewHistory(tp)}
                                                            style={{ animationDelay: `${index * 30}ms` }}
                                                        />
                                                    ))}
                                                </div>
                                            )}

                                            {/* Pagination */}
                                            {totalPages > 1 && (
                                                <div className="flex justify-center gap-2 mt-6">
                                                    <button
                                                        onClick={() => loadPrompts(selectedTeam.id, promptsPage - 1)}
                                                        disabled={promptsPage === 1}
                                                        className="btn btn-secondary text-sm disabled:opacity-50"
                                                    >
                                                        上一页
                                                    </button>
                                                    <span className="px-4 py-2 text-sm text-[var(--text-secondary)]">{promptsPage}/{totalPages}</span>
                                                    <button
                                                        onClick={() => loadPrompts(selectedTeam.id, promptsPage + 1)}
                                                        disabled={promptsPage === totalPages}
                                                        className="btn btn-secondary text-sm disabled:opacity-50"
                                                    >
                                                        下一页
                                                    </button>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </>
                            ) : (
                                <div className="space-y-2">
                                    {members.map(member => (
                                        <div key={member.user_id} className="flex items-center justify-between p-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)]">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--primary-500)] to-[var(--accent-500)] flex items-center justify-center text-white font-bold">
                                                    {member.username.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="font-medium text-[var(--text-primary)]">{member.username}</div>
                                                    <div className="text-xs text-[var(--text-muted)]">
                                                        {member.role === 'owner' ? '创建者' : member.role === 'admin' ? '管理员' : '成员'}
                                                    </div>
                                                </div>
                                            </div>
                                            {selectedTeam.my_role === 'owner' && member.role !== 'owner' && (
                                                <div className="flex items-center gap-2">
                                                    <select
                                                        value={member.role}
                                                        onChange={(e) => handleUpdateRole(member.user_id, e.target.value as 'admin' | 'member')}
                                                        className="px-2 py-1 text-sm bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded text-[var(--text-primary)]"
                                                    >
                                                        <option value="member">成员</option>
                                                        <option value="admin">管理员</option>
                                                    </select>
                                                    <button
                                                        onClick={() => handleRemoveMember(member.user_id)}
                                                        className="p-2 text-red-500 hover:bg-red-500/10 rounded"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-[var(--text-muted)]">
                        <div className="text-center">
                            <p className="text-lg">选择一个团队查看详情</p>
                            <p className="text-sm mt-2">或创建/加入一个新团队</p>
                        </div>
                    </div>
                )}
            </div>

            {/* 创建团队弹窗 */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-[var(--bg-secondary)] rounded-2xl w-full max-w-md border border-[var(--border-primary)]">
                        <div className="p-6 border-b border-[var(--border-primary)]">
                            <h3 className="text-xl font-bold text-[var(--text-primary)]">创建团队</h3>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">团队名称 *</label>
                                <input
                                    type="text"
                                    value={newTeamName}
                                    onChange={(e) => setNewTeamName(e.target.value)}
                                    placeholder="输入团队名称"
                                    className="w-full px-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-500)]"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">团队简介</label>
                                <textarea
                                    value={newTeamDesc}
                                    onChange={(e) => setNewTeamDesc(e.target.value)}
                                    placeholder="简单描述这个团队"
                                    rows={3}
                                    className="w-full px-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none resize-none"
                                />
                            </div>
                        </div>
                        <div className="p-6 border-t border-[var(--border-primary)] flex gap-3">
                            <button onClick={() => setShowCreateModal(false)} className="flex-1 btn btn-secondary">取消</button>
                            <button onClick={handleCreateTeam} className="flex-1 btn btn-primary">创建</button>
                        </div>
                    </div>
                </div>
            )}

            {/* 加入团队弹窗 */}
            {showJoinModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-[var(--bg-secondary)] rounded-2xl w-full max-w-md border border-[var(--border-primary)]">
                        <div className="p-6 border-b border-[var(--border-primary)]">
                            <h3 className="text-xl font-bold text-[var(--text-primary)]">加入团队</h3>
                        </div>
                        <div className="p-6">
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">邀请码</label>
                            <input
                                type="text"
                                value={inviteCode}
                                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                                placeholder="输入邀请码 (如 ABC12345)"
                                maxLength={10}
                                className="w-full px-4 py-3 bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-500)] text-center text-lg tracking-widest"
                            />
                        </div>
                        <div className="p-6 border-t border-[var(--border-primary)] flex gap-3">
                            <button onClick={() => setShowJoinModal(false)} className="flex-1 btn btn-secondary">取消</button>
                            <button onClick={handleJoinTeam} className="flex-1 btn btn-primary">加入</button>
                        </div>
                    </div>
                </div>
            )}

            {/* 邀请成员弹窗 */}
            {showInviteModal && selectedTeam && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-[var(--bg-secondary)] rounded-2xl w-full max-w-md border border-[var(--border-primary)]">
                        <div className="p-6 border-b border-[var(--border-primary)]">
                            <h3 className="text-xl font-bold text-[var(--text-primary)]">邀请成员</h3>
                        </div>
                        <div className="p-6 text-center">
                            <p className="text-sm text-[var(--text-secondary)] mb-4">分享以下邀请码给团队成员</p>
                            <div className="bg-[var(--bg-tertiary)] rounded-xl p-6 mb-4">
                                <div className="text-3xl font-mono font-bold text-[var(--primary-500)] tracking-widest">
                                    {selectedTeam.invite_code}
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={handleCopyInviteCode}
                                    className="flex-1 btn btn-primary"
                                >
                                    复制邀请码
                                </button>
                                {canManage && (
                                    <button
                                        onClick={handleRegenerateCode}
                                        className="btn btn-secondary"
                                    >
                                        重新生成
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="p-6 border-t border-[var(--border-primary)]">
                            <button onClick={() => setShowInviteModal(false)} className="w-full btn btn-secondary">关闭</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Prompt View Modal */}
            {viewingPrompt && (
                <PromptViewModal
                    prompt={viewingPrompt}
                    onClose={() => setViewingPrompt(null)}
                    onCopy={async () => {
                        await navigator.clipboard.writeText(viewingPrompt.content);
                        setToast({ message: '已复制到剪贴板', type: 'success' });
                    }}
                />
            )}

            {/* Team Edit Prompt Modal */}
            {editingTeamPrompt && selectedTeam && (
                <TeamPromptEditModal
                    teamId={selectedTeam.id}
                    prompt={editingTeamPrompt}
                    onClose={() => setEditingTeamPrompt(null)}
                    onSuccess={handleTeamEditSuccess}
                />
            )}

            {/* Team Version History Modal */}
            {versionHistoryPromptId && selectedTeam && (
                <TeamVersionHistoryModal
                    teamId={selectedTeam.id}
                    promptId={versionHistoryPromptId}
                    promptTitle={versionHistoryPromptTitle}
                    onClose={() => {
                        setVersionHistoryPromptId(null);
                        setVersionHistoryPromptTitle('');
                    }}
                    onRestore={() => {
                        setVersionHistoryPromptId(null);
                        setVersionHistoryPromptTitle('');
                        loadPrompts(selectedTeam.id, promptsPage);
                        setToast({ message: '版本恢复成功', type: 'success' });
                    }}
                />
            )}

            {/* Category Create/Edit Modal */}
            {showCategoryModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCategoryModal(false)} />
                    <div className="glass-card w-full max-w-md relative animate-scaleIn">
                        <div className="p-6 border-b border-[var(--border-primary)]">
                            <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                                {editingCategory ? '编辑分类' : '新建分类'}
                            </h3>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm text-[var(--text-secondary)] mb-2">分类名称</label>
                                <input
                                    type="text"
                                    value={newCategoryName}
                                    onChange={(e) => setNewCategoryName(e.target.value)}
                                    placeholder="输入分类名称"
                                    className="input w-full"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-[var(--text-secondary)] mb-2">图标</label>
                                <div className="flex gap-2 flex-wrap">
                                    {['📁', '💡', '📝', '🎯', '🔧', '💻', '📊', '🎨', '📚', '⭐'].map(icon => (
                                        <button
                                            key={icon}
                                            onClick={() => setNewCategoryIcon(icon)}
                                            className={`p-2 text-xl rounded-lg transition-colors ${newCategoryIcon === icon
                                                ? 'bg-[var(--primary-500)] text-white'
                                                : 'bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)]'
                                                }`}
                                        >
                                            {icon}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="p-6 border-t border-[var(--border-primary)] flex gap-3">
                            <button
                                onClick={() => setShowCategoryModal(false)}
                                className="flex-1 btn btn-secondary"
                            >
                                取消
                            </button>
                            <button
                                onClick={editingCategory ? handleUpdateCategory : handleCreateCategory}
                                disabled={!newCategoryName.trim()}
                                className="flex-1 btn btn-primary disabled:opacity-50"
                            >
                                {editingCategory ? '保存' : '创建'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Admin Modal - 团队管理后台 */}
            {showAdminModal && selectedTeam && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAdminModal(false)} />
                    <div className="glass-card w-full max-w-3xl max-h-[85vh] relative animate-scaleIn flex flex-col">
                        {/* Header */}
                        <div className="p-6 border-b border-[var(--border-primary)] flex justify-between items-center">
                            <h3 className="text-xl font-semibold text-[var(--text-primary)]">
                                管理团队 - {selectedTeam.name}
                            </h3>
                            <button
                                onClick={() => setShowAdminModal(false)}
                                className="btn btn-ghost p-2"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b border-[var(--border-primary)] px-6">
                            <button
                                onClick={() => setAdminTab('categories')}
                                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${adminTab === 'categories'
                                    ? 'border-[var(--primary-500)] text-[var(--primary-500)]'
                                    : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                    }`}
                            >
                                📁 分类管理
                            </button>
                            <button
                                onClick={() => setAdminTab('members')}
                                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${adminTab === 'members'
                                    ? 'border-[var(--primary-500)] text-[var(--primary-500)]'
                                    : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                    }`}
                            >
                                👥 成员管理
                            </button>
                            <button
                                onClick={() => setAdminTab('settings')}
                                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${adminTab === 'settings'
                                    ? 'border-[var(--primary-500)] text-[var(--primary-500)]'
                                    : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                    }`}
                            >
                                ⚙️ 团队设置
                            </button>
                        </div>

                        {/* Tab Content */}
                        <div className="flex-1 overflow-y-auto p-6">
                            {adminTab === 'categories' && (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <p className="text-[var(--text-secondary)] text-sm">管理团队提示词分类</p>
                                        <button
                                            onClick={openCreateCategoryModal}
                                            className="btn btn-primary text-sm"
                                        >
                                            + 新建分类
                                        </button>
                                    </div>
                                    {categories.length === 0 ? (
                                        <div className="text-center py-8 text-[var(--text-muted)]">
                                            暂无分类，点击上方按钮创建
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {categories.map(cat => (
                                                <div key={cat.id} className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)]">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-xl">{cat.icon}</span>
                                                        <span className="text-[var(--text-primary)]">{cat.name}</span>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => openEditCategoryModal(cat)}
                                                            className="btn btn-ghost text-sm"
                                                        >
                                                            编辑
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteCategory(cat.id)}
                                                            className="btn btn-ghost text-sm text-red-400 hover:text-red-500"
                                                        >
                                                            删除
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {adminTab === 'members' && (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <p className="text-[var(--text-secondary)] text-sm">管理团队成员 ({members.length}人)</p>
                                        <button
                                            onClick={() => { setShowAdminModal(false); setShowInviteModal(true); }}
                                            className="btn btn-primary text-sm"
                                        >
                                            邀请成员
                                        </button>
                                    </div>
                                    <div className="space-y-2">
                                        {members.map(member => (
                                            <div key={member.user_id} className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)]">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--primary-500)] to-[var(--accent-500)] flex items-center justify-center text-white font-bold">
                                                        {member.username.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-[var(--text-primary)]">{member.username}</div>
                                                        <div className="text-xs text-[var(--text-muted)]">
                                                            {member.role === 'owner' ? '创建者' : member.role === 'admin' ? '管理员' : '成员'}
                                                        </div>
                                                    </div>
                                                </div>
                                                {member.role !== 'owner' && (
                                                    <div className="flex gap-2">
                                                        <select
                                                            value={member.role}
                                                            onChange={(e) => handleUpdateRole(member.user_id, e.target.value as 'admin' | 'member')}
                                                            className="input text-sm py-1 px-2"
                                                        >
                                                            <option value="member">成员</option>
                                                            <option value="admin">管理员</option>
                                                        </select>
                                                        <button
                                                            onClick={() => handleRemoveMember(member.user_id)}
                                                            className="btn btn-ghost text-sm text-red-400 hover:text-red-500"
                                                        >
                                                            移除
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {adminTab === 'settings' && (
                                <div className="space-y-6">
                                    {/* Team Info Editing */}
                                    <div className="p-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)]">
                                        <h4 className="font-medium text-[var(--text-primary)] mb-4">团队信息</h4>
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-sm text-[var(--text-secondary)] mb-2">团队名称</label>
                                                <input
                                                    type="text"
                                                    value={editTeamName || selectedTeam.name}
                                                    onChange={(e) => setEditTeamName(e.target.value)}
                                                    onFocus={() => !editTeamName && setEditTeamName(selectedTeam.name)}
                                                    placeholder="输入团队名称"
                                                    className="input w-full"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm text-[var(--text-secondary)] mb-2">团队描述</label>
                                                <input
                                                    type="text"
                                                    value={editTeamDesc || selectedTeam.description || ''}
                                                    onChange={(e) => setEditTeamDesc(e.target.value)}
                                                    onFocus={() => !editTeamDesc && setEditTeamDesc(selectedTeam.description || '')}
                                                    placeholder="输入团队描述（可选）"
                                                    className="input w-full"
                                                />
                                            </div>
                                            <button
                                                onClick={handleUpdateTeamInfo}
                                                disabled={!editTeamName.trim() || (editTeamName === selectedTeam.name && editTeamDesc === (selectedTeam.description || ''))}
                                                className="btn btn-primary text-sm disabled:opacity-50"
                                            >
                                                保存修改
                                            </button>
                                        </div>
                                    </div>
                                    <div className="p-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)]">
                                        <h4 className="font-medium text-[var(--text-primary)] mb-2">邀请码</h4>
                                        <div className="flex items-center gap-3">
                                            <span className="font-mono text-lg text-[var(--primary-500)]">{selectedTeam.invite_code}</span>
                                            <button
                                                onClick={handleCopyInviteCode}
                                                className="btn btn-ghost text-sm"
                                            >
                                                复制
                                            </button>
                                            <button
                                                onClick={handleRegenerateCode}
                                                className="btn btn-ghost text-sm"
                                            >
                                                重新生成
                                            </button>
                                        </div>
                                    </div>
                                    <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                                        <h4 className="font-medium text-red-400 mb-2">危险操作</h4>
                                        <p className="text-sm text-[var(--text-secondary)] mb-4">删除团队后，所有数据将无法恢复。</p>
                                        <button
                                            onClick={() => { setShowAdminModal(false); handleDeleteTeam(); }}
                                            className="btn btn-secondary text-red-500 hover:bg-red-500/20"
                                        >
                                            删除团队
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
