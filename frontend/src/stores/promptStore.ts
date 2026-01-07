import { create } from 'zustand';
import type { Prompt, Category, PromptQueryParams, PromptListResponse } from '../types';
import { promptApi, categoryApi } from '../api/client';

interface PromptState {
    // 数据
    prompts: Prompt[];
    categories: Category[];
    totalPrompts: number;
    currentPage: number;
    pageSize: number;

    // 筛选状态
    selectedCategoryId: string | null;
    searchQuery: string;
    filterTag: string | null;
    showFavoritesOnly: boolean;

    // 加载状态
    isLoading: boolean;
    isCategoriesLoading: boolean;
    error: string | null;

    // Actions
    fetchPrompts: (params?: PromptQueryParams) => Promise<void>;
    fetchCategories: () => Promise<void>;
    createPrompt: (data: Omit<Prompt, 'id' | 'user_id' | 'copy_count' | 'created_at' | 'updated_at'>) => Promise<Prompt>;
    updatePrompt: (id: string, data: Partial<Prompt>) => Promise<void>;
    deletePrompt: (id: string) => Promise<void>;
    copyPrompt: (id: string) => Promise<void>;

    // 筛选 Actions
    setSelectedCategory: (categoryId: string | null) => void;
    setSearchQuery: (query: string) => void;
    setFilterTag: (tag: string | null) => void;
    setShowFavoritesOnly: (show: boolean) => void;

    // 分类 Actions
    createCategory: (name: string, parentId?: string) => Promise<Category>;
    updateCategory: (id: string, name: string) => Promise<void>;
    deleteCategory: (id: string) => Promise<void>;

    clearError: () => void;
}

export const usePromptStore = create<PromptState>()((set, get) => ({
    prompts: [],
    categories: [],
    totalPrompts: 0,
    currentPage: 1,
    pageSize: 20,

    selectedCategoryId: null,
    searchQuery: '',
    filterTag: null,
    showFavoritesOnly: false,

    isLoading: false,
    isCategoriesLoading: false,
    error: null,

    fetchPrompts: async (params?: PromptQueryParams) => {
        set({ isLoading: true, error: null });
        try {
            const state = get();
            const queryParams: PromptQueryParams = {
                category_id: params?.category_id ?? state.selectedCategoryId ?? undefined,
                search: params?.search ?? (state.searchQuery || undefined),
                tag: params?.tag ?? state.filterTag ?? undefined,
                is_favorite: params?.is_favorite ?? (state.showFavoritesOnly ? true : undefined),
                page: params?.page ?? state.currentPage,
                page_size: params?.page_size ?? state.pageSize,
            };

            const response: PromptListResponse = await promptApi.getAll(queryParams);
            set({
                prompts: response.items,
                totalPrompts: response.total,
                currentPage: response.page,
                pageSize: response.page_size,
                isLoading: false,
            });
        } catch (error: any) {
            set({ error: error.message || '加载提示词失败', isLoading: false });
        }
    },

    fetchCategories: async () => {
        set({ isCategoriesLoading: true });
        try {
            const categories = await categoryApi.getAll();
            set({ categories, isCategoriesLoading: false });
        } catch (error: any) {
            set({ error: error.message || '加载分类失败', isCategoriesLoading: false });
        }
    },

    createPrompt: async (data) => {
        const prompt = await promptApi.create(data);
        set((state) => ({
            prompts: [prompt, ...state.prompts],
            totalPrompts: state.totalPrompts + 1,
        }));
        return prompt;
    },

    updatePrompt: async (id: string, data: Partial<Prompt>) => {
        const updated = await promptApi.update(id, data);
        set((state) => ({
            prompts: state.prompts.map((p) => (p.id === id ? updated : p)),
        }));
    },

    deletePrompt: async (id: string) => {
        await promptApi.delete(id);
        set((state) => ({
            prompts: state.prompts.filter((p) => p.id !== id),
            totalPrompts: state.totalPrompts - 1,
        }));
    },

    copyPrompt: async (id: string) => {
        const updated = await promptApi.incrementCopyCount(id);
        set((state) => ({
            prompts: state.prompts.map((p) => (p.id === id ? updated : p)),
        }));
    },

    setSelectedCategory: (categoryId: string | null) => {
        set({ selectedCategoryId: categoryId, currentPage: 1 });
        get().fetchPrompts();
    },

    setSearchQuery: (query: string) => {
        set({ searchQuery: query, currentPage: 1 });
    },

    setFilterTag: (tag: string | null) => {
        set({ filterTag: tag, currentPage: 1 });
        get().fetchPrompts();
    },

    setShowFavoritesOnly: (show: boolean) => {
        set({ showFavoritesOnly: show, currentPage: 1 });
        get().fetchPrompts();
    },

    createCategory: async (name: string, parentId?: string) => {
        const category = await categoryApi.create({ name, parent_id: parentId });
        await get().fetchCategories();
        return category;
    },

    updateCategory: async (id: string, name: string) => {
        await categoryApi.update(id, { name });
        await get().fetchCategories();
    },

    deleteCategory: async (id: string) => {
        await categoryApi.delete(id);
        if (get().selectedCategoryId === id) {
            set({ selectedCategoryId: null });
        }
        await get().fetchCategories();
    },

    clearError: () => set({ error: null }),
}));
