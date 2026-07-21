import { api } from './api';

export interface Bundle {
    id: string;
    network: string;
    dataAmount: string;
    priceGhc: number;
    agentPriceGhc?: number;
    agentPrice?: number | null;
    userPrice?: number;
    isActive: boolean;
    createdAt: string;
}

export interface Transaction {
    id: string;
    recipientPhone: string;
    amount: number;
    status: 'processing' | 'completed' | 'failed' | 'ongoing' | 'queued';
    network: string;
    dataAmount: string;
    createdAt: string;
    updatedAt?: string;
}

export interface PurchaseData {
    bundleId: string;
    recipientPhone: string;
}

export interface PurchaseResponse {
    message: string;
    transaction: Transaction;
}

export const bundleService = {
    // Get all bundles
    getAll: async (): Promise<Bundle[]> => {
        return api.get<Bundle[]>('/bundles');
    },

    // Get bundles by network
    getByNetwork: async (network: string): Promise<Bundle[]> => {
        return api.get<Bundle[]>(`/bundles/network/${network}`);
    },

    // Get single bundle
    getById: async (id: string): Promise<Bundle> => {
        return api.get<Bundle>(`/bundles/${id}`);
    },
};

export const transactionService = {
    // Purchase data bundle
    purchase: async (data: PurchaseData): Promise<PurchaseResponse> => {
        return api.post<PurchaseResponse>('/transactions/purchase', data);
    },

    // Get user transactions
    getAll: async (params?: { status?: string; limit?: number }): Promise<Transaction[]> => {
        const queryParams = new URLSearchParams();
        if (params?.status) queryParams.append('status', params.status);
        if (params?.limit) queryParams.append('limit', params.limit.toString());

        const query = queryParams.toString();
        return api.get<Transaction[]>(`/transactions${query ? `?${query}` : ''}`);
    },

    // Get single transaction
    getById: async (id: string): Promise<Transaction> => {
        return api.get<Transaction>(`/transactions/${id}`);
    },

    // Sync transaction status
    sync: async (id: string): Promise<{ message: string; synced: boolean; newStatus?: string }> => {
        return api.get(`/transactions/${id}/sync`);
    },
};

export default { bundleService, transactionService };
