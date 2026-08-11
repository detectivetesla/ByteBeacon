import { api } from './api';
import type { User } from './auth.service';
import type { Bundle } from './data.service';

interface DBNotification {
    id: string;
    user_id: string | null;
    title: string;
    message: string;
    type: string;
    is_read: number;
    created_at: string;
}

export interface AdminUser extends User {
    walletBalance: number;
    phone: string;
    isActive: boolean;
}

export interface AdminTransaction {
    id: string;
    recipientPhone: string;
    amount: number;
    status: string;
    network: string;
    dataAmount: string;
    userName: string;
    userEmail: string;
    createdAt: string;
    updatedAt?: string;
    serialId?: number;
    balanceBefore?: number | null;
    balanceAfter?: number | null;
    source?: string;
    paid?: string;
    sourceProvider?: string;
}

export interface DashboardStats {
    totalUsers: number;
    todayOrders: number;
    todayRevenue: number;
    monthlyRevenue: number;
    pendingOrders: number;
    roleStats?: {
        customer: { dailyRevenue: number; monthlyRevenue: number; totalOrders: number };
        agent: { dailyRevenue: number; monthlyRevenue: number; totalOrders: number };
        superagent: { dailyRevenue: number; monthlyRevenue: number; totalOrders: number };
    };
}

export interface Notification {
    id: string;
    userId: string | null;
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    isRead: boolean;
    createdAt: string;
}

export interface BundleData {
    network: string;
    dataAmount: string;
    priceGhc: number;
    agentPriceGhc?: number;
    isActive?: boolean;
}

export const adminService = {
    // Dashboard
    getStats: async (): Promise<DashboardStats> => {
        return api.get<DashboardStats>('/admin/stats');
    },

    getAnalytics: async (): Promise<{
        totalUsers: number;
        totalAgents: number;
        todayOrders: number;
        todayRevenue: number;
        monthlyGrowth: number;
        transactions: Array<{ status: string; amount_ghc: number; created_at: string; network: string | null }>;
        userGrowth: Array<{ created_at: string }>;
    }> => {
        return api.get('/admin/analytics');
    },

    // Users
    getUsers: async (params?: { role?: string; search?: string }): Promise<AdminUser[]> => {
        const queryParams = new URLSearchParams();
        if (params?.role) queryParams.append('role', params.role);
        if (params?.search) queryParams.append('search', params.search);

        const query = queryParams.toString();
        return api.get<AdminUser[]>(`/admin/users${query ? `?${query}` : ''}`);
    },

    changeUserRole: async (userId: string, role: string): Promise<{ message: string }> => {
        return api.put(`/admin/users/${userId}/role`, { role });
    },

    updateUser: async (id: string, data: { fullName: string; email: string; phone: string }): Promise<{ message: string }> => {
        return api.put(`/admin/users/${id}`, data);
    },

    deleteUser: async (id: string): Promise<{ message: string }> => {
        return api.delete(`/admin/users/${id}`);
    },

    createUser: async (data: { fullName: string; email: string; phone: string; password: string; role?: string }): Promise<{ message: string; id: string }> => {
        return api.post('/admin/users', data);
    },

    getUserDetails: async (userId: string): Promise<UserDetails> => {
        return api.get<UserDetails>(`/admin/users/${userId}`);
    },

    toggleUserStatus: async (userId: string, isActive: boolean): Promise<{ message: string; isActive: boolean }> => {
        return api.put(`/admin/users/${userId}/status`, { isActive });
    },

    // Transactions
    getTransactions: async (params?: { status?: string; limit?: number; offset?: number }): Promise<AdminTransaction[]> => {
        const queryParams = new URLSearchParams();
        if (params?.status) queryParams.append('status', params.status);
        if (params?.limit) queryParams.append('limit', params.limit.toString());
        if (params?.offset) queryParams.append('offset', params.offset.toString());

        const query = queryParams.toString();
        return api.get<AdminTransaction[]>(`/admin/transactions${query ? `?${query}` : ''}`);
    },


    updateTransactionStatus: async (id: string, status: string): Promise<{ message: string }> => {
        return api.put(`/admin/transactions/${id}/status`, { status });
    },

    getTransactionStats: async (): Promise<{
        totalTransactions: number;
        completedValue: number;
        completedCount: number;
        pendingCount: number;
        failedCount: number;
    }> => {
        return api.get('/admin/transactions/stats');
    },

    syncTransactionStatus: async (id: string): Promise<{ message: string; synced: boolean; newStatus?: string }> => {
        return api.get(`/transactions/${id}/sync`);
    },

    // Bundles
    getAllBundles: async (): Promise<Bundle[]> => {
        return api.get<Bundle[]>('/admin/bundles');
    },

    createBundle: async (data: BundleData): Promise<{ message: string; id: string }> => {
        return api.post('/admin/bundles', data);
    },

    updateBundle: async (id: string, data: Partial<BundleData>): Promise<{ message: string }> => {
        return api.put(`/admin/bundles/${id}`, data);
    },

    deleteBundle: async (id: string): Promise<{ message: string }> => {
        return api.delete(`/admin/bundles/${id}`);
    },

    // Notifications
    sendNotification: async (data: { userId?: string; targetGroup?: string; title: string; message: string; type?: string }): Promise<{ message: string; sentCount?: number }> => {
        return api.post('/admin/notifications', data);
    },

    getNotifications: async (): Promise<Notification[]> => {
        const data = await api.get<DBNotification[]>('/admin/notifications');
        return data.map(n => ({
            id: n.id,
            userId: n.user_id,
            title: n.title,
            message: n.message,
            type: n.type as Notification['type'], // Cast to specific Notification type
            isRead: Boolean(n.is_read),
            createdAt: n.created_at
        }));
    },

    markNotificationRead: async (id: string): Promise<{ message: string }> => {
        return api.put(`/admin/notifications/${id}/read`);
    },

    markAllNotificationsRead: async (): Promise<{ message: string }> => {
        return api.put('/admin/notifications/mark-all-read');
    },

    deleteNotification: async (id: string): Promise<{ message: string }> => {
        return api.delete(`/admin/notifications/${id}`);
    },

    clearAllNotifications: async (): Promise<{ message: string }> => {
        return api.delete('/admin/notifications');
    },

    // Emails
    sendEmail: async (data: { to: string; subject: string; body: string }): Promise<{ message: string }> => {
        return api.post('/admin/email', data);
    },

    // Messages
    sendMessage: async (data: { recipientId: string; subject: string; body: string }): Promise<{ message: string; id: string }> => {
        return api.post('/admin/messages', data);
    },

    getMessages: async (): Promise<Array<{
        id: string;
        senderId: string;
        senderName: string;
        senderEmail: string;
        recipientId: string;
        recipientName: string;
        recipientEmail: string;
        subject: string;
        body: string;
        isRead: boolean;
        createdAt: string;
    }>> => {
        return api.get('/admin/messages');
    },

    deleteMessage: async (id: string): Promise<{ message: string }> => {
        return api.delete(`/admin/messages/${id}`);
    },

    markMessageRead: async (id: string): Promise<{ message: string }> => {
        return api.put(`/admin/messages/${id}/read`);
    },

    // Agent Applications
    getAgentApplications: async (status?: string): Promise<Array<{
        id: string;
        userId: string;
        fullName: string;
        email: string;
        phone: string;
        businessName: string | null;
        reason: string;
        experience: string | null;
        status: 'processing' | 'approved' | 'rejected';
        adminNotes: string | null;
        requestType?: 'agent' | 'superagent';
        createdAt: string;
        updatedAt: string;
    }>> => {
        const query = status && status !== 'all' ? `?status=${status}` : '';
        return api.get(`/admin/agent-applications${query}`);
    },

    updateAgentApplication: async (id: string, data: { status: 'approved' | 'rejected'; adminNotes?: string }): Promise<{ message: string }> => {
        return api.put(`/admin/agent-applications/${id}`, data);
    },

    // Activity Logs
    getActivityLogs: async (params?: { userId?: string; action?: string; search?: string; startDate?: string; endDate?: string; limit?: number; offset?: number }): Promise<ActivityLog[]> => {
        const queryParams = new URLSearchParams();
        if (params?.userId) queryParams.append('userId', params.userId);
        if (params?.action) queryParams.append('action', params.action);
        if (params?.search) queryParams.append('search', params.search);
        if (params?.startDate) queryParams.append('startDate', params.startDate);
        if (params?.endDate) queryParams.append('endDate', params.endDate);
        if (params?.limit) queryParams.append('limit', params.limit.toString());
        if (params?.offset) queryParams.append('offset', params.offset.toString());

        const query = queryParams.toString();
        return api.get<ActivityLog[]>(`/admin/activity-logs${query ? `?${query}` : ''}`);
    },

    // System Settings
    getMaintenanceStatus: async (): Promise<{ maintenanceMode: boolean }> => {
        return api.get('/system/maintenance');
    },

    updateMaintenanceStatus: async (isActive: boolean): Promise<{ message: string; maintenanceMode: boolean }> => {
        return api.put('/admin/maintenance', { isActive });
    },

    // Agent Pricing
    getAgentPricing: async (agentId: string): Promise<AgentPricing[]> => {
        return api.get<AgentPricing[]>(`/admin/agents/${agentId}/pricing`);
    },

    setAgentPricing: async (agentId: string, bundleId: string, customPrice: number): Promise<{ message: string }> => {
        return api.post(`/admin/agents/${agentId}/pricing`, { bundleId, customPrice });
    },

    bulkSetAgentPricing: async (agentId: string, pricing: Array<{ bundleId: string; customPrice: number }>): Promise<{ message: string }> => {
        return api.put(`/admin/agents/${agentId}/pricing/bulk`, { pricing });
    },

    deleteAgentPricing: async (agentId: string, bundleId: string): Promise<{ message: string }> => {
        return api.delete(`/admin/agents/${agentId}/pricing/${bundleId}`);
    },

    // Partners (Reseller APIs)
    getAllPartners: async (): Promise<any[]> => {
        return api.get<any[]>('/admin/partners');
    },

    getPartnerDetails: async (id: string): Promise<any> => {
        return api.get<any>(`/admin/partners/${id}`);
    },

    createPartner: async (data: any): Promise<any> => {
        return api.post('/admin/partners', data);
    },

    updatePartner: async (id: string, data: any): Promise<any> => {
        return api.put(`/admin/partners/${id}`, data);
    },

    adjustPartnerBalance: async (id: string, data: { type: string; amount: number; description?: string }): Promise<any> => {
        return api.post(`/admin/partners/${id}/adjust-balance`, data);
    },

    // Sourcing API Settings
    getSourcingSettings: async (): Promise<SourcingSettings> => {
        return api.get<SourcingSettings>('/admin/sourcing-settings');
    },

    updateSourcingSettings: async (data: Partial<SourcingSettingsData>): Promise<{ success: boolean; message: string }> => {
        return api.put('/admin/sourcing-settings', data);
    },

    addSourcingProvider: async (data: { name: string; slug: string; base_url?: string; api_key?: string; config?: Record<string, any> }): Promise<{ success: boolean; message: string }> => {
        return api.post('/admin/sourcing-providers', data);
    },

    updateSourcingProvider: async (id: string, data: { name?: string; base_url?: string; api_key?: string; config?: Record<string, any> }): Promise<{ success: boolean; message: string }> => {
        return api.put(`/admin/sourcing-providers/${id}`, data);
    },

    deleteSourcingProvider: async (id: string): Promise<{ success: boolean; message: string }> => {
        return api.delete(`/admin/sourcing-providers/${id}`);
    },

    activateSourcingProvider: async (id: string): Promise<{ success: boolean; message: string }> => {
        return api.put(`/admin/sourcing-providers/${id}/activate`, {});
    },

    testSourcingProvider: async (id: string): Promise<{ success: boolean; message: string; balance?: number; currency?: string; error?: string }> => {
        return api.post(`/admin/sourcing-providers/${id}/test`, {});
    },

    // Reprocess Failed Orders
    reprocessTransaction: async (id: string): Promise<{ message: string; status: string; wasRefunded: boolean }> => {
        return api.post(`/admin/transactions/${id}/reprocess`, {});
    },

    massReprocessFailedTransactions: async (): Promise<{ message: string; count: number }> => {
        return api.post('/admin/transactions/reprocess-failed', {});
    },
};

export interface AgentPricing {
    id: string;
    bundleId: string;
    customPrice: number;
    network: string;
    dataAmount: string;
    standardPrice: number;
    defaultAgentPrice: number | null;
    createdAt: string;
    updatedAt: string;
}

export interface ActivityLog {
    id: string;
    userId: string;
    userName: string;
    userEmail: string;
    userRole?: string;
    action: string;
    description: string;
    metadata: Record<string, unknown> | null;
    ipAddress: string | null;
    createdAt: string;
}

export interface UserDetails {
    user: {
        id: string;
        fullName: string;
        email: string;
        phone: string;
        walletBalance: number;
        role: string;
        createdAt: string;
    };
    transactions: Array<{
        id: string;
        recipientPhone: string;
        amount: number;
        status: string;
        network: string;
        dataAmount: string;
        createdAt: string;
    }>;
    activityLogs: Array<{
        id: string;
        action: string;
        description: string;
        metadata: Record<string, any> | null;
        ipAddress: string | null;
        createdAt: string;
    }>;
    deposits: Array<{
        id: string;
        amount: number;
        reference: string;
        status: string;
        createdAt: string;
    }>;
    refunds?: Array<{
        id: string;
        amount: number;
        notes: string;
        createdAt: string;
    }>;
    stats: {
        totalOrders: number;
        completedOrders: number;
        failedOrders: number;
        pendingOrders: number;
        totalSpent: number;
        dailySpent?: number;
        dailyOrders?: number;
        dailyRefunds?: number;
        totalRefunds?: number;
    };
}

export interface SourcingProvider {
    id: string;
    name: string;
    slug: string;
    provider_type: 'builtin' | 'custom';
    base_url: string;
    api_key: string;
    is_active: boolean;
    config: Record<string, any>;
}

export interface SourcingSettingsData {
    active_sourcing_api: string;
    portal02_api_key: string;
    datahouse_api_key: string;
    providers: SourcingProvider[];
}

export interface SourcingSettings {
    success: boolean;
    settings: SourcingSettingsData;
}

export default adminService;
