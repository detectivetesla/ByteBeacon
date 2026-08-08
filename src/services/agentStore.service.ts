import { api } from './api';

export interface AgentStore {
    id: string;
    store_name: string;
    slug: string;
    description: string;
    phone: string;
    logo_url: string;
    review_status: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED' | 'SUSPENDED';
    activation_status: 'UNPAID' | 'PAID' | 'REFUNDED';
    effective_status: 'PENDING_REVIEW' | 'AWAITING_ACTIVATION' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED' | 'CHANGES_REQUESTED';
    admin_notes?: string;
    is_visible: boolean;
    available_balance?: number;
    pending_balance?: number;
    total_profit_earned?: number;
    total_withdrawn?: number;
    created_at: string;
}

export interface AgentProduct {
    bundle_id: string;
    network: string;
    data_amount: string;
    base_price_ghc: number;
    agent_price_ghc: number;
    profit_ghc: number;
    is_enabled: boolean;
}

export interface AgentOrder {
    id: string;
    customer_phone: string;
    network: string;
    data_amount: string;
    base_price_ghc: number;
    selling_price_ghc: number;
    profit_ghc: number;
    paystack_reference: string;
    payment_status: string;
    fulfillment_status: string;
    created_at: string;
}

export interface WalletLedgerEntry {
    id: string;
    type: 'SALE_PROFIT' | 'WITHDRAWAL' | 'REFUND' | 'REVERSAL' | 'ADJUSTMENT';
    amount_ghc: number;
    balance_after: number;
    description: string;
    reference: string;
    created_at: string;
}

export interface AgentWithdrawal {
    id: string;
    amount_ghc: number;
    payment_method: string;
    account_number: string;
    account_name: string;
    bank_momo_provider: string;
    status: 'REQUESTED' | 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
    admin_notes?: string;
    created_at: string;
}

export interface DashboardStatsResponse {
    success: boolean;
    store: AgentStore;
    financials: {
        total_sales_ghc: number;
        total_profit_earned: number;
        available_balance: number;
        pending_balance: number;
        total_withdrawn: number;
    };
    orders: {
        total: number;
        successful: number;
        failed: number;
        pending: number;
    };
    insights: {
        best_network: string;
        best_product: string;
        best_product_count: number;
    };
    recentOrders: AgentOrder[];
}

export const agentStoreService = {
    // 1. Create store
    createStore: async (data: { store_name: string; description?: string; phone: string; logo_url?: string }) => {
        return api.post<{ success: boolean; message: string; store: AgentStore }>('/agent-store/create', data);
    },

    // 2. Get my store
    getMyStore: async () => {
        return api.get<{ success: boolean; hasStore: boolean; store: AgentStore | null; pricingRules: { min_markup_ghc: number; max_markup_ghc: number; min_withdrawal_ghc: number } }>('/agent-store/my-store');
    },

    // 3. Update store settings
    updateSettings: async (data: { store_name?: string; description?: string; phone?: string; logo_url?: string; is_visible?: boolean }) => {
        return api.put<{ success: boolean; message: string }>('/agent-store/settings', data);
    },

    // 4. Initialize GHS 100 activation payment
    initializeActivation: async (callbackUrl?: string) => {
        return api.post<{ success: boolean; authorization_url: string; reference: string; amount_ghc: number }>('/agent-store/activate/initialize', { callbackUrl });
    },

    // 5. Verify activation payment
    verifyActivation: async (reference: string) => {
        return api.post<{ success: boolean; message: string; activation_status: string; effective_status: string }>('/agent-store/activate/verify', { reference });
    },

    // 6. Get store products & custom prices
    getProducts: async () => {
        return api.get<{ success: boolean; products: AgentProduct[]; pricingRules: { min_markup_ghc: number; max_markup_ghc: number } }>('/agent-store/products');
    },

    // 7. Update store products & prices
    updateProducts: async (products: { bundle_id: string; agent_price_ghc: number; is_enabled: boolean }[]) => {
        return api.post<{ success: boolean; message: string }>('/agent-store/products/update', { products });
    },

    // 8. Get dashboard stats
    getDashboardStats: async () => {
        return api.get<DashboardStatsResponse>('/agent-store/dashboard');
    },

    // 9. Get store orders
    getOrders: async (filters?: { status?: string; network?: string; search?: string }) => {
        const query = new URLSearchParams(filters as Record<string, string>).toString();
        return api.get<{ success: boolean; orders: AgentOrder[] }>(`/agent-store/orders?${query}`);
    },

    // 10. Get transactions / ledger
    getTransactions: async () => {
        return api.get<{ success: boolean; ledger: WalletLedgerEntry[] }>('/agent-store/transactions');
    },

    // 11. Get store customers
    getCustomers: async () => {
        return api.get<{ success: boolean; customers: { customer_phone: string; total_orders: number; total_spent_ghc: number; last_purchase_at: string }[] }>('/agent-store/customers');
    },

    // 12. Get analytics
    getAnalytics: async () => {
        return api.get<{ success: boolean; dailyStats: { date: string; orders: number; sales: number; profit: number }[]; networkShare: { network: string; count: number; total_profit: number }[] }>('/agent-store/analytics');
    },

    // 13. Request withdrawal
    requestWithdrawal: async (data: { amount_ghc: number; payment_method: string; account_number: string; account_name: string; bank_momo_provider: string }) => {
        return api.post<{ success: boolean; message: string; withdrawal_id: string; new_balance: number }>('/agent-store/withdrawals', data);
    },

    // 14. Get withdrawal history
    getWithdrawalHistory: async () => {
        return api.get<{ success: boolean; withdrawals: AgentWithdrawal[] }>('/agent-store/withdrawals');
    },

    // 15. Public Storefront (No Auth)
    getPublicStorefront: async (slug: string) => {
        return api.get<{ success: boolean; store: { id: string; store_name: string; slug: string; description: string; phone: string; logo_url: string }; products: AgentProduct[] }>(`/agent-store/public/store/${slug}`);
    },

    // 16. Public Customer Purchase Initialize (No Auth)
    initializeCustomerPurchase: async (slug: string, data: { bundleId: string; customerPhone: string; callbackUrl?: string }) => {
        return api.post<{ success: boolean; authorization_url: string; reference: string; order_id: string }>(`/agent-store/public/store/${slug}/buy/initialize`, data);
    },

    // 17. Public Customer Purchase Verify (No Auth)
    verifyCustomerPurchase: async (reference: string) => {
        return api.post<{ success: boolean; status: string; message: string; order_id: string }>('/agent-store/public/store/buy/verify', { reference });
    },

    // 18. Public Order Track (No Auth)
    trackPublicOrder: async (orderId: string) => {
        return api.get<{ success: boolean; order: AgentOrder }>(`/agent-store/public/track/${orderId}`);
    },

    // =============================================
    // ADMIN SERVICE CALLS FOR AGENT STORES
    // =============================================
    adminGetAllStores: async () => {
        return api.get<(AgentStore & { owner_name: string; owner_email: string; total_orders: number })[]>('/admin/agent-stores');
    },

    adminUpdateStoreReview: async (id: string, review_status: string, admin_notes?: string) => {
        return api.put<{ message: string }>(`/admin/agent-stores/${id}/review`, { review_status, admin_notes });
    },

    adminManualActivateStore: async (id: string) => {
        return api.post<{ message: string }>(`/admin/agent-stores/${id}/activate-manual`, {});
    },

    adminGetAllWithdrawals: async () => {
        return api.get<(AgentWithdrawal & { store_name: string; agent_name: string; agent_email: string })[]>('/admin/agent-stores/withdrawals');
    },

    adminUpdateWithdrawalStatus: async (id: string, status: string, admin_notes?: string) => {
        return api.put<{ message: string }>(`/admin/agent-stores/withdrawals/${id}`, { status, admin_notes });
    },

    adminGetPricingRules: async () => {
        return api.get<{ min_markup_ghc: number; max_markup_ghc: number; min_withdrawal_ghc: number }>('/admin/agent-stores/pricing-rules');
    },

    adminUpdatePricingRules: async (rules: { min_markup_ghc?: number; max_markup_ghc?: number; min_withdrawal_ghc?: number }) => {
        return api.put<{ message: string }>('/admin/agent-stores/pricing-rules', rules);
    }
};
