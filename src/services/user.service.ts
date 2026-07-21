import { api } from './api';

export interface UserMessage {
    id: string;
    senderId: string;
    senderName: string;
    recipientId?: string;
    recipientName?: string;
    subject: string;
    body: string;
    isRead: boolean;
    createdAt: string;
    isOutgoing?: boolean;
}

export interface UserNotification {
    id: string;
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    isRead: boolean;
    createdAt: string;
}

export interface AgentApplication {
    hasApplication: boolean;
    id?: string;
    status?: 'processing' | 'approved' | 'rejected';
    businessName?: string;
    reason?: string;
    adminNotes?: string;
    createdAt?: string;
    updatedAt?: string;
}

export const userService = {
    // Agent Application
    applyForAgent: async (data: { businessName?: string; reason: string; experience?: string }): Promise<{ message: string; id: string }> => {
        return api.post('/users/apply-agent', data);
    },

    getAgentApplication: async (): Promise<AgentApplication> => {
        return api.get('/users/agent-application');
    },

    // Messages
    getMessages: async (): Promise<UserMessage[]> => {
        return api.get('/users/messages');
    },

    markMessageRead: async (id: string): Promise<{ message: string }> => {
        return api.put(`/users/messages/${id}/read`, {});
    },

    deleteMessage: async (id: string): Promise<{ message: string }> => {
        return api.delete(`/users/messages/${id}`);
    },

    sendMessage: async (data: { subject: string; body: string }): Promise<{ message: string; id: string }> => {
        return api.post('/users/messages', data);
    },

    // Notifications
    getNotifications: async (): Promise<UserNotification[]> => {
        return api.get('/users/notifications');
    },

    markNotificationRead: async (id: string): Promise<{ message: string }> => {
        return api.put(`/users/notifications/${id}/read`, {});
    },

    markAllNotificationsRead: async (): Promise<{ message: string }> => {
        return api.put('/users/notifications/mark-all-read', {});
    },

    deleteNotification: async (id: string): Promise<{ message: string }> => {
        return api.delete(`/users/notifications/${id}`);
    },

    clearAllNotifications: async (): Promise<{ message: string }> => {
        return api.delete('/users/notifications');
    },

    // API Key Management
    getApiKey: async (): Promise<{ apiKey: string; createdAt: string }> => {
        return api.get('/users/api-key');
    },

    regenerateApiKey: async (): Promise<{ message: string; apiKey: string; createdAt: string }> => {
        return api.post('/users/api-key/regenerate');
    },

    getApiKeys: async (): Promise<{ success: boolean; apiKeys: any[] }> => {
        return api.get('/users/api-keys');
    },

    createApiKey: async (name: string): Promise<{ success: boolean; message: string; apiKey: any }> => {
        return api.post('/users/api-keys', { name });
    },

    deleteApiKey: async (id: string): Promise<{ success: boolean; message: string }> => {
        return api.delete(`/users/api-keys/${id}`);
    },

    // Partner Console Settings & Logs
    getPartnerProfile: async (): Promise<any> => {
        return api.get('/users/partner-profile');
    },

    updatePartnerSettings: async (settings: { webhook_url: string; ip_whitelist: string }): Promise<any> => {
        return api.put('/users/partner-profile', settings);
    },

    getPartnerLogs: async (): Promise<any> => {
        return api.get('/users/partner-logs');
    },

    // Activity Logs
    getActivityLogs: async (): Promise<UserActivityLog[]> => {
        return api.get('/users/activity');
    },
};

export interface UserActivityLog {
    id: string;
    action: string;
    description: string;
    metadata?: any;
    ip_address?: string;
    created_at: string;
}

export default userService;
