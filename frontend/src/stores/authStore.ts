import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, AuthToken } from '../types';
import { authApi } from '../api/client';

// Token 存储管理
const tokenStorage = {
    get: () => localStorage.getItem('access_token') || sessionStorage.getItem('access_token'),
    set: (token: string, remember: boolean) => {
        if (remember) {
            localStorage.setItem('access_token', token);
            sessionStorage.removeItem('access_token');
        } else {
            sessionStorage.setItem('access_token', token);
            localStorage.removeItem('access_token');
        }
    },
    remove: () => {
        localStorage.removeItem('access_token');
        sessionStorage.removeItem('access_token');
    }
};

interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;

    // Actions
    login: (identifier: string, password: string, rememberMe?: boolean) => Promise<void>;
    register: (email: string, username: string, password: string, securityQuestion: string, securityAnswer: string) => Promise<void>;
    logout: () => void;
    clearError: () => void;
    checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,

            login: async (identifier: string, password: string, rememberMe: boolean = true) => {
                set({ isLoading: true, error: null });
                try {
                    const response: AuthToken = await authApi.login({ identifier, password });
                    tokenStorage.set(response.access_token, rememberMe);
                    set({
                        user: response.user,
                        token: response.access_token,
                        isAuthenticated: true,
                        isLoading: false,
                    });
                } catch (error: any) {
                    const message = error.response?.data?.detail || '登录失败，请重试';
                    set({ error: message, isLoading: false });
                    throw error;
                }
            },

            register: async (email: string, username: string, password: string, securityQuestion: string, securityAnswer: string) => {
                set({ isLoading: true, error: null });
                try {
                    const response: AuthToken = await authApi.register({
                        email,
                        username,
                        password,
                        security_question: securityQuestion,
                        security_answer: securityAnswer
                    });
                    tokenStorage.set(response.access_token, true);  // 注册后默认记住用户
                    set({
                        user: response.user,
                        token: response.access_token,
                        isAuthenticated: true,
                        isLoading: false,
                    });
                } catch (error: any) {
                    const message = error.response?.data?.detail || '注册失败，请重试';
                    set({ error: message, isLoading: false });
                    throw error;
                }
            },

            logout: () => {
                tokenStorage.remove();
                set({
                    user: null,
                    token: null,
                    isAuthenticated: false,
                    error: null,
                });
            },

            clearError: () => {
                set({ error: null });
            },

            checkAuth: async () => {
                const token = tokenStorage.get();
                if (!token) {
                    set({ isAuthenticated: false, user: null, token: null });
                    return;
                }

                try {
                    const user = await authApi.getProfile();
                    set({ user, token, isAuthenticated: true });
                } catch {
                    tokenStorage.remove();
                    set({ isAuthenticated: false, user: null, token: null });
                }
            },
        }),
        {
            name: 'auth-storage',
            partialize: (state) => ({
                user: state.user,
                token: state.token,
                isAuthenticated: state.isAuthenticated
            }),
        }
    )
);
