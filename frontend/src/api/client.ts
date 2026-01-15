import axios, { type AxiosInstance, type AxiosError } from 'axios';
import type {
    AuthToken,
    UserLogin,
    UserRegister,
    User,
    Category,
    CategoryCreate,
    CategoryUpdate,
    Prompt,
    PromptCreate,
    PromptUpdate,
    PromptListResponse,
    PromptQueryParams,
    PromptVersion,
    PromptVersionListResponse,
    PromptCompareResponse
} from '../types';

// API 基础配置
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// 创建 axios 实例
const api: AxiosInstance = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    // FastAPI expects array params as ?tags=a&tags=b, not ?tags[0]=a&tags[1]=b
    paramsSerializer: {
        indexes: null // This makes axios serialize arrays without indexes
    }
});

// 请求拦截器 - 添加 Token
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// 响应拦截器 - 处理错误
api.interceptors.response.use(
    (response) => response,
    (error: AxiosError<{ detail: string }>) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('access_token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

// ============ 认证 API ============
export const authApi = {
    // 注册
    register: async (data: UserRegister): Promise<AuthToken> => {
        const response = await api.post<AuthToken>('/auth/register', data);
        return response.data;
    },

    // 登录
    login: async (data: UserLogin): Promise<AuthToken> => {
        const response = await api.post<AuthToken>('/auth/login', data);
        return response.data;
    },

    // 获取当前用户资料
    getProfile: async (): Promise<User> => {
        const response = await api.get<User>('/auth/profile');
        return response.data;
    },

    // 获取安全问题列表
    getSecurityQuestions: async (): Promise<{ questions: string[] }> => {
        const response = await api.get<{ questions: string[] }>('/auth/security-questions');
        return response.data;
    },

    // 发送密码重置邮件
    sendResetEmail: async (email: string): Promise<{ message: string }> => {
        const response = await api.post<{ message: string }>('/auth/forgot-password/email', { email });
        return response.data;
    },

    // 通过验证码重置密码
    resetPasswordByCode: async (email: string, code: string, new_password: string): Promise<{ message: string }> => {
        const response = await api.post<{ message: string }>('/auth/reset-password/email', { email, code, new_password });
        return response.data;
    },

    // 获取用户安全问题
    getSecurityQuestion: async (identifier: string): Promise<{ question: string; email: string }> => {
        const response = await api.post<{ question: string; email: string }>('/auth/forgot-password/question', { identifier });
        return response.data;
    },

    // 通过安全问题重置密码
    resetPasswordByQuestion: async (identifier: string, security_answer: string, new_password: string): Promise<{ message: string }> => {
        const response = await api.post<{ message: string }>('/auth/reset-password/question', { identifier, security_answer, new_password });
        return response.data;
    },
};

// ============ 分类 API ============
export const categoryApi = {
    // 获取分类列表（树形结构）
    getAll: async (): Promise<Category[]> => {
        const response = await api.get<Category[]>('/categories');
        return response.data;
    },

    // 创建分类
    create: async (data: CategoryCreate): Promise<Category> => {
        const response = await api.post<Category>('/categories', data);
        return response.data;
    },

    // 更新分类
    update: async (id: string, data: CategoryUpdate): Promise<Category> => {
        const response = await api.put<Category>(`/categories/${id}`, data);
        return response.data;
    },

    // 删除分类
    delete: async (id: string): Promise<void> => {
        await api.delete(`/categories/${id}`);
    },
};

// ============ 提示词 API ============
export const promptApi = {
    // 获取提示词列表
    getAll: async (params?: PromptQueryParams): Promise<PromptListResponse> => {
        const response = await api.get<PromptListResponse>('/prompts', { params });
        return response.data;
    },

    // 获取所有标签
    getTags: async (): Promise<string[]> => {
        const response = await api.get<string[]>('/prompts/tags');
        return response.data;
    },

    // AI 修改提示词
    aiModify: async (content: string, suggestion: string, model: string = 'default'): Promise<{ modified_content: string }> => {
        const response = await api.post<{ modified_content: string }>('/prompts/ai-modify', {
            content,
            suggestion,
            model
        });
        return response.data;
    },

    // 获取可用模型列表
    getAIModels: async (): Promise<Array<{ key: string; name: string }>> => {
        const response = await api.get<Array<{ key: string; name: string }>>('/prompts/ai-models');
        return response.data;
    },

    // 获取单个提示词
    getById: async (id: string): Promise<Prompt> => {
        const response = await api.get<Prompt>(`/prompts/${id}`);
        return response.data;
    },

    // 创建提示词
    create: async (data: PromptCreate): Promise<Prompt> => {
        const response = await api.post<Prompt>('/prompts', data);
        return response.data;
    },

    // 更新提示词
    update: async (id: string, data: PromptUpdate): Promise<Prompt> => {
        const response = await api.put<Prompt>(`/prompts/${id}`, data);
        return response.data;
    },

    // 删除提示词
    delete: async (id: string): Promise<void> => {
        await api.delete(`/prompts/${id}`);
    },

    // 增加复制次数
    incrementCopyCount: async (id: string): Promise<Prompt> => {
        const response = await api.post<Prompt>(`/prompts/${id}/copy`);
        return response.data;
    },

    // ============ 版本管理 API ============

    // 获取版本历史
    getVersions: async (id: string): Promise<PromptVersionListResponse> => {
        const response = await api.get<PromptVersionListResponse>(`/prompts/${id}/versions`);
        return response.data;
    },

    // 获取特定版本
    getVersion: async (id: string, version: number): Promise<PromptVersion> => {
        const response = await api.get<PromptVersion>(`/prompts/${id}/versions/${version}`);
        return response.data;
    },

    // 对比两个版本
    compareVersions: async (id: string, v1: number, v2: number): Promise<PromptCompareResponse> => {
        const response = await api.get<PromptCompareResponse>(`/prompts/${id}/versions/compare`, {
            params: { v1, v2 }
        });
        return response.data;
    },

    // 恢复到指定版本
    restoreVersion: async (id: string, version: number): Promise<Prompt> => {
        const response = await api.post<Prompt>(`/prompts/${id}/versions/${version}/restore`);
        return response.data;
    },
};

export default api;

// ============ 公共提示词 API ============
export interface PublicPrompt {
    id: string;
    title: string;
    content: string;
    description?: string;
    tags: string[];
    category: string;
    author_id: string;
    author_name: string;
    source_prompt_id?: string;
    status: 'pending' | 'approved' | 'rejected';
    review_note?: string;
    download_count: number;
    like_count: number;
    is_liked: boolean;
    avg_rating: number;
    review_count: number;
    created_at: string;
    updated_at: string;
}

export interface PublicPromptListResponse {
    items: PublicPrompt[];
    total: number;
    page: number;
    page_size: number;
}

export interface PublicPromptCreate {
    title: string;
    content: string;
    description?: string;
    tags: string[];
    category: string;
}

// ============ 评价系统接口 ============
export interface Review {
    id: string;
    prompt_id: string;
    user_id: string;
    user_name: string;
    rating: number;
    content: string;
    like_count: number;
    is_liked: boolean;
    author_reply?: string;
    author_reply_at?: string;
    status: string;
    created_at: string;
    updated_at: string;
}

export interface ReviewListResponse {
    items: Review[];
    total: number;
    page: number;
    page_size: number;
}

export const publicPromptApi = {
    // 获取分类列表
    getCategories: async (): Promise<string[]> => {
        const response = await api.get<string[]>('/public-prompts/categories');
        return response.data;
    },

    // 获取公共提示词列表
    getAll: async (params?: { category?: string; search?: string; sort_by?: 'latest' | 'likes' | 'downloads'; page?: number; page_size?: number }): Promise<PublicPromptListResponse> => {
        const response = await api.get<PublicPromptListResponse>('/public-prompts', { params });
        return response.data;
    },

    // 获取我的提交
    getMySubmissions: async (page: number = 1, page_size: number = 20): Promise<PublicPromptListResponse> => {
        const response = await api.get<PublicPromptListResponse>('/public-prompts/my-submissions', {
            params: { page, page_size }
        });
        return response.data;
    },

    // 获取单个公共提示词
    getById: async (id: string): Promise<PublicPrompt> => {
        const response = await api.get<PublicPrompt>(`/public-prompts/${id}`);
        return response.data;
    },

    // 直接创建公共提示词
    create: async (data: PublicPromptCreate): Promise<PublicPrompt> => {
        const response = await api.post<PublicPrompt>('/public-prompts', data);
        return response.data;
    },

    // 从个人库上传
    uploadFromPersonal: async (promptId: string): Promise<PublicPrompt> => {
        const response = await api.post<PublicPrompt>(`/public-prompts/upload/${promptId}`);
        return response.data;
    },

    // 下载到个人库
    download: async (id: string): Promise<{ message: string; prompt_id: string }> => {
        const response = await api.post<{ message: string; prompt_id: string }>(`/public-prompts/${id}/download`);
        return response.data;
    },

    // 点赞
    like: async (id: string): Promise<{ message: string; like_count: number }> => {
        const response = await api.post<{ message: string; like_count: number }>(`/public-prompts/${id}/like`);
        return response.data;
    },

    // 取消点赞
    unlike: async (id: string): Promise<{ message: string; like_count: number }> => {
        const response = await api.delete<{ message: string; like_count: number }>(`/public-prompts/${id}/like`);
        return response.data;
    },

    // 获取上传状态
    getUploadStatus: async (): Promise<{
        today_count: number;
        daily_limit: number;
        auto_approve_remaining: number;
        needs_review: boolean;
    }> => {
        const response = await api.get<{
            today_count: number;
            daily_limit: number;
            auto_approve_remaining: number;
            needs_review: boolean;
        }>('/public-prompts/my-upload-status');
        return response.data;
    },

    // ============ 管理员 API ============

    // 获取待审核列表
    getPending: async (page: number = 1, page_size: number = 20): Promise<PublicPromptListResponse> => {
        const response = await api.get<PublicPromptListResponse>('/public-prompts/admin/pending', {
            params: { page, page_size }
        });
        return response.data;
    },

    // 审核通过
    approve: async (id: string): Promise<PublicPrompt> => {
        const response = await api.post<PublicPrompt>(`/public-prompts/admin/${id}/approve`);
        return response.data;
    },

    // 审核拒绝
    reject: async (id: string, note?: string): Promise<PublicPrompt> => {
        const response = await api.post<PublicPrompt>(`/public-prompts/admin/${id}/reject`, { note });
        return response.data;
    },

    // 获取统计信息
    getStats: async (): Promise<{ pending: number; approved: number; rejected: number; total: number }> => {
        const response = await api.get<{ pending: number; approved: number; rejected: number; total: number }>('/public-prompts/admin/stats');
        return response.data;
    },

    // 获取所有提示词列表（管理员）
    getAllAdmin: async (params: { status?: string; search?: string; page?: number; page_size?: number } = {}): Promise<PublicPromptListResponse> => {
        const response = await api.get<PublicPromptListResponse>('/public-prompts/admin/all', { params });
        return response.data;
    },

    // 删除提示词（管理员）
    delete: async (id: string): Promise<{ message: string; id: string }> => {
        const response = await api.delete<{ message: string; id: string }>(`/public-prompts/admin/${id}`);
        return response.data;
    },

    // ============ 分类管理 (管理员) ============

    // 获取分类列表详情
    getAdminCategories: async (): Promise<{ id: string; name: string; sort_order: number; created_at: string }[]> => {
        const response = await api.get<{ id: string; name: string; sort_order: number; created_at: string }[]>('/public-prompts/admin/categories');
        return response.data;
    },

    // 创建分类
    createCategory: async (name: string): Promise<{ message: string; id: string; name: string }> => {
        const response = await api.post<{ message: string; id: string; name: string }>('/public-prompts/admin/categories', null, {
            params: { name }
        });
        return response.data;
    },

    // 删除分类
    deleteCategory: async (id: string): Promise<{ message: string; id: string; name: string }> => {
        const response = await api.delete<{ message: string; id: string; name: string }>(`/public-prompts/admin/categories/${id}`);
        return response.data;
    },

    // 重新排序分类
    reorderCategories: async (categoryIds: string[]): Promise<{ message: string }> => {
        const response = await api.put<{ message: string }>('/public-prompts/admin/categories/reorder', categoryIds);
        return response.data;
    },

    // ============ 评价系统 ============

    // 创建评价
    createReview: async (promptId: string, rating: number, content: string): Promise<{ message: string; review: Review }> => {
        const response = await api.post<{ message: string; review: Review }>(`/public-prompts/${promptId}/reviews`, null, {
            params: { rating, content }
        });
        return response.data;
    },

    // 获取评价列表
    getReviews: async (promptId: string, params?: { sort_by?: 'latest' | 'likes'; page?: number; page_size?: number }): Promise<ReviewListResponse> => {
        const response = await api.get<ReviewListResponse>(`/public-prompts/${promptId}/reviews`, { params });
        return response.data;
    },

    // 获取我的评价
    getMyReview: async (promptId: string): Promise<{ review: Review | null; has_downloaded: boolean; can_review: boolean }> => {
        const response = await api.get<{ review: Review | null; has_downloaded: boolean; can_review: boolean }>(`/public-prompts/${promptId}/my-review`);
        return response.data;
    },

    // 点赞评论
    likeReview: async (reviewId: string): Promise<{ message: string; like_count: number }> => {
        const response = await api.post<{ message: string; like_count: number }>(`/public-prompts/reviews/${reviewId}/like`);
        return response.data;
    },

    // 取消点赞评论
    unlikeReview: async (reviewId: string): Promise<{ message: string; like_count: number }> => {
        const response = await api.delete<{ message: string; like_count: number }>(`/public-prompts/reviews/${reviewId}/like`);
        return response.data;
    },

    // 作者回复评论
    replyToReview: async (reviewId: string, reply: string): Promise<{ message: string }> => {
        const response = await api.post<{ message: string }>(`/public-prompts/reviews/${reviewId}/reply`, null, {
            params: { reply }
        });
        return response.data;
    },

    // 举报评论
    reportReview: async (reviewId: string, reason: string): Promise<{ message: string }> => {
        const response = await api.post<{ message: string }>(`/public-prompts/reviews/${reviewId}/report`, null, {
            params: { reason }
        });
        return response.data;
    },

    // 管理员获取评论列表
    getAdminReviews: async (params?: { status?: string; page?: number; page_size?: number }): Promise<ReviewListResponse> => {
        const response = await api.get<ReviewListResponse>('/public-prompts/admin/reviews', { params });
        return response.data;
    },

    // 管理员删除评论
    deleteReview: async (reviewId: string): Promise<{ message: string; id: string }> => {
        const response = await api.delete<{ message: string; id: string }>(`/public-prompts/admin/reviews/${reviewId}`);
        return response.data;
    },

    // 管理员获取评价统计
    getReviewStats: async (): Promise<{ total_reviews: number; reported_reviews: number; pending_reports: number; overall_avg_rating: number }> => {
        const response = await api.get<{ total_reviews: number; reported_reviews: number; pending_reports: number; overall_avg_rating: number }>('/public-prompts/admin/review-stats');
        return response.data;
    }
};

// 部署 API
export const deployApi = {
    triggerDeploy: async (webhook_url?: string, webhook_token?: string): Promise<{ message: string; status: string }> => {
        const response = await api.post<{ message: string; status: string }>('/deploy', {
            webhook_url,
            webhook_token
        });
        return response.data;
    }
};

// ============ 通知系统 API ============
export interface Notification {
    id: string;
    user_id: string;
    type: 'review_reply' | 'review_like' | 'prompt_approved' | 'prompt_rejected';
    title: string;
    content: string;
    related_id?: string;
    actor_name?: string;
    is_read: boolean;
    created_at: string;
}

export interface NotificationListResponse {
    items: Notification[];
    total: number;
    unread_count: number;
}

export const notificationApi = {
    // 获取通知列表
    getAll: async (params?: { page?: number; page_size?: number; unread_only?: boolean }): Promise<NotificationListResponse> => {
        const response = await api.get<NotificationListResponse>('/notifications', { params });
        return response.data;
    },

    // 获取未读数量
    getUnreadCount: async (): Promise<{ unread_count: number }> => {
        const response = await api.get<{ unread_count: number }>('/notifications/unread-count');
        return response.data;
    },

    // 标记已读
    markAsRead: async (notificationId: string): Promise<{ message: string; id: string }> => {
        const response = await api.post<{ message: string; id: string }>(`/notifications/${notificationId}/read`);
        return response.data;
    },

    // 全部已读
    markAllAsRead: async (): Promise<{ message: string; updated_count: number }> => {
        const response = await api.post<{ message: string; updated_count: number }>('/notifications/read-all');
        return response.data;
    },

    // 删除通知
    delete: async (notificationId: string): Promise<{ message: string; id: string }> => {
        const response = await api.delete<{ message: string; id: string }>(`/notifications/${notificationId}`);
        return response.data;
    }
};


// ============ 团队 API ============

export interface Team {
    id: string;
    name: string;
    description: string | null;
    owner_id: string;
    owner_name: string;
    invite_code: string;
    member_count: number;
    my_role: 'owner' | 'admin' | 'member' | null;
    created_at: string;
}

export interface TeamMember {
    user_id: string;
    username: string;
    role: 'owner' | 'admin' | 'member';
    joined_at: string;
}

export interface TeamPrompt {
    id: string;
    prompt_id: string;
    title: string;
    content: string;
    description: string | null;
    tags: string[];
    category: string;
    shared_by: string;
    shared_by_name: string;
    shared_at: string;
    version_count: number;
    copy_count: number;
    team_category_id: string | null;
}

export interface TeamCategory {
    id: string;
    team_id: string;
    name: string;
    icon: string;
    order: number;
    created_by: string;
    created_at: string;
}

export interface TeamPromptVersion {
    id: string;
    version: number;
    title: string;
    content: string;
    description: string | null;
    tags: string[];
    modified_by: string;
    modified_by_name: string;
    modified_at: string;
    change_note: string;
}

export interface TeamPromptListResponse {
    items: TeamPrompt[];
    total: number;
    page: number;
    page_size: number;
}

export const teamsApi = {
    // 创建团队
    create: async (data: { name: string; description?: string }): Promise<Team> => {
        const response = await api.post<Team>('/teams', data);
        return response.data;
    },

    // 获取我的团队列表
    getMyTeams: async (): Promise<Team[]> => {
        const response = await api.get<Team[]>('/teams');
        return response.data;
    },

    // 获取团队详情
    getById: async (teamId: string): Promise<Team> => {
        const response = await api.get<Team>(`/teams/${teamId}`);
        return response.data;
    },

    // 更新团队信息
    update: async (teamId: string, data: { name?: string; description?: string }): Promise<Team> => {
        const response = await api.put<Team>(`/teams/${teamId}`, data);
        return response.data;
    },

    // 删除团队
    delete: async (teamId: string): Promise<{ message: string }> => {
        const response = await api.delete<{ message: string }>(`/teams/${teamId}`);
        return response.data;
    },

    // 重新生成邀请码
    regenerateInviteCode: async (teamId: string): Promise<{ invite_code: string }> => {
        const response = await api.post<{ invite_code: string }>(`/teams/${teamId}/regenerate-code`);
        return response.data;
    },

    // 通过邀请码加入团队
    join: async (inviteCode: string): Promise<{ message: string; team_id: string; team_name: string }> => {
        const response = await api.post<{ message: string; team_id: string; team_name: string }>('/teams/join', { invite_code: inviteCode });
        return response.data;
    },

    // 获取团队成员列表
    getMembers: async (teamId: string): Promise<TeamMember[]> => {
        const response = await api.get<TeamMember[]>(`/teams/${teamId}/members`);
        return response.data;
    },

    // 更新成员角色
    updateMemberRole: async (teamId: string, userId: string, role: 'admin' | 'member'): Promise<{ message: string }> => {
        const response = await api.put<{ message: string }>(`/teams/${teamId}/members/${userId}`, { role });
        return response.data;
    },

    // 移除成员
    removeMember: async (teamId: string, userId: string): Promise<{ message: string }> => {
        const response = await api.delete<{ message: string }>(`/teams/${teamId}/members/${userId}`);
        return response.data;
    },

    // 退出团队
    leave: async (teamId: string): Promise<{ message: string }> => {
        const response = await api.delete<{ message: string }>(`/teams/${teamId}/leave`);
        return response.data;
    },

    // 共享提示词到团队
    sharePrompt: async (teamId: string, promptId: string): Promise<{ message: string }> => {
        const response = await api.post<{ message: string }>(`/teams/${teamId}/prompts`, { prompt_id: promptId });
        return response.data;
    },

    // 获取团队提示词列表
    getPrompts: async (teamId: string, params?: { search?: string; category?: string; page?: number; page_size?: number }): Promise<TeamPromptListResponse> => {
        const response = await api.get<TeamPromptListResponse>(`/teams/${teamId}/prompts`, { params });
        return response.data;
    },

    // 取消共享提示词
    unsharePrompt: async (teamId: string, promptId: string): Promise<{ message: string }> => {
        const response = await api.delete<{ message: string }>(`/teams/${teamId}/prompts/${promptId}`);
        return response.data;
    },

    // 复制团队提示词到个人库
    copyPromptToPersonal: async (teamId: string, promptId: string): Promise<{ message: string; prompt_id: string }> => {
        const response = await api.post<{ message: string; prompt_id: string }>(`/teams/${teamId}/prompts/${promptId}/copy`);
        return response.data;
    },

    // ============ 团队分类 ============

    // 获取团队分类列表
    getCategories: async (teamId: string): Promise<TeamCategory[]> => {
        const response = await api.get<TeamCategory[]>(`/teams/${teamId}/categories`);
        return response.data;
    },

    // 创建团队分类
    createCategory: async (teamId: string, data: { name: string; icon?: string }): Promise<TeamCategory> => {
        const response = await api.post<TeamCategory>(`/teams/${teamId}/categories`, data);
        return response.data;
    },

    // 更新团队分类
    updateCategory: async (teamId: string, categoryId: string, data: { name?: string; icon?: string; order?: number }): Promise<TeamCategory> => {
        const response = await api.put<TeamCategory>(`/teams/${teamId}/categories/${categoryId}`, data);
        return response.data;
    },

    // 删除团队分类
    deleteCategory: async (teamId: string, categoryId: string): Promise<{ message: string }> => {
        const response = await api.delete<{ message: string }>(`/teams/${teamId}/categories/${categoryId}`);
        return response.data;
    },

    // 更新团队提示词分类
    updatePromptCategory: async (teamId: string, promptId: string, categoryId: string | null): Promise<{ message: string }> => {
        const response = await api.put<{ message: string }>(`/teams/${teamId}/prompts/${promptId}/category`, null, { params: { category_id: categoryId } });
        return response.data;
    },

    // ============ 团队版本管理 ============

    // 获取团队提示词版本历史
    getPromptVersions: async (teamId: string, promptId: string): Promise<TeamPromptVersion[]> => {
        const response = await api.get<TeamPromptVersion[]>(`/teams/${teamId}/prompts/${promptId}/versions`);
        return response.data;
    },

    // 恢复团队提示词到指定版本
    restorePromptVersion: async (teamId: string, promptId: string, version: number): Promise<{ message: string; new_version: number }> => {
        const response = await api.post<{ message: string; new_version: number }>(`/teams/${teamId}/prompts/${promptId}/restore/${version}`);
        return response.data;
    },

    // 更新团队提示词（创建新版本记录）
    updatePrompt: async (teamId: string, promptId: string, data: { title?: string; content?: string; description?: string; change_note?: string }): Promise<{ message: string; version: number }> => {
        const response = await api.put<{ message: string; version: number }>(`/teams/${teamId}/prompts/${promptId}`, data);
        return response.data;
    },

    // 增加团队提示词的复制计数
    incrementCopyCount: async (teamId: string, promptId: string): Promise<void> => {
        await api.post(`/teams/${teamId}/prompts/${promptId}/copy`);
    }
};
