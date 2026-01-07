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
