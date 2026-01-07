// API 响应类型
export interface ApiResponse<T> {
    data?: T;
    error?: string;
}

// 用户相关类型
export interface User {
    id: string;
    email: string;
    username: string;
    avatar?: string;
    created_at: string;
}

export interface UserLogin {
    identifier: string;  // 用户名或邮箱
    password: string;
}

export interface UserRegister {
    email: string;
    username: string;
    password: string;
    security_question: string;
    security_answer: string;
}

export interface AuthToken {
    access_token: string;
    token_type: string;
    user: User;
}

// 密码重置相关类型
export interface SecurityQuestionResponse {
    question: string;
    email: string;
}

// 分类相关类型
export interface Category {
    id: string;
    name: string;
    parent_id?: string;
    icon?: string;
    order: number;
    user_id: string;
    children: Category[];
    prompt_count: number;
    created_at: string;
}

export interface CategoryCreate {
    name: string;
    parent_id?: string;
    icon?: string;
    order?: number;
}

export interface CategoryUpdate {
    name?: string;
    parent_id?: string;
    icon?: string;
    order?: number;
}

// 提示词相关类型
export interface Prompt {
    id: string;
    title: string;
    content: string;
    category_id?: string;
    category_name?: string;
    tags: string[];
    description?: string;
    is_favorite: boolean;
    user_id: string;
    copy_count: number;
    created_at: string;
    updated_at: string;
}

export interface PromptCreate {
    title: string;
    content: string;
    category_id?: string;
    tags?: string[];
    description?: string;
    is_favorite?: boolean;
}

export interface PromptUpdate {
    title?: string;
    content?: string;
    category_id?: string;
    tags?: string[];
    description?: string;
    is_favorite?: boolean;
}

export interface PromptListResponse {
    items: Prompt[];
    total: number;
    page: number;
    page_size: number;
}

// 查询参数类型
export interface PromptQueryParams {
    category_id?: string;
    search?: string;
    tag?: string;
    is_favorite?: boolean;
    page?: number;
    page_size?: number;
}
