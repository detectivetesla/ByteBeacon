import { api, setToken, removeToken, getToken } from './api';

export interface User {
    id: string;
    email: string;
    fullName: string;
    phone?: string;
    walletBalance?: number;
    role: 'customer' | 'agent' | 'admin';
    createdAt?: string;
}

export interface AuthResponse {
    message: string;
    token: string;
    user: User;
}

export interface RegisterData {
    email: string;
    password: string;
    fullName: string;
    phone: string;
}

export interface LoginData {
    email: string;
    password: string;
}

export const authService = {
    // Register new user
    register: async (data: RegisterData): Promise<AuthResponse> => {
        const response = await api.post<AuthResponse>('/auth/register', data);
        // Removed setToken(response.token) to force manual login
        return response;
    },

    // Login user
    login: async (data: LoginData): Promise<AuthResponse> => {
        const response = await api.post<AuthResponse>('/auth/login', data);
        setToken(response.token);
        return response;
    },

    // Get current user
    getMe: async (): Promise<User> => {
        return api.get<User>('/auth/me');
    },

    // Logout
    logout: async (): Promise<void> => {
        try {
            await api.post('/auth/logout');
        } catch (error) {
            // Ignore errors on logout
        }
        removeToken();
    },

    // Request password reset - sends email with reset link
    requestPasswordReset: async (email: string): Promise<{ message: string }> => {
        return api.post('/auth/forgot-password', { email });
    },

    // Verify reset token is valid
    verifyResetToken: async (token: string): Promise<{ valid: boolean; message: string }> => {
        return api.get(`/auth/verify-reset-token/${token}`);
    },

    // Execute password reset with new password
    executePasswordReset: async (token: string, newPassword: string): Promise<{ message: string }> => {
        return api.post('/auth/reset-password', { token, newPassword });
    },

    // Check if user is authenticated
    isAuthenticated: (): boolean => {
        return !!getToken();
    },

    // Get user role
    getRole: async (): Promise<{ role: string }> => {
        return api.get('/users/role');
    },

    // Change password
    changePassword: async (currentPassword: string, newPassword: string): Promise<{ message: string }> => {
        return api.post('/auth/change-password', { currentPassword, newPassword });
    },

    // Google OAuth login
    googleLogin: async (credential: string): Promise<AuthResponse> => {
        const response = await api.post<AuthResponse>('/auth/google', { credential });
        setToken(response.token);
        return response;
    },
};

export default authService;
