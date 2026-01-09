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
