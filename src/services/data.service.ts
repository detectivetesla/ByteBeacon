import { api } from './api';

export interface Bundle {
    id: string;
    network: string;
    dataAmount: string;
    dataSizeGb?: number;
    priceGhc: number;
    agentPriceGhc?: number;
    agentPrice?: number | null;
    userPrice?: number;
    isActive: boolean;
    validity?: string;
    createdAt?: string;
}

export type OrderStatus =
    | 'received'
    | 'processing'
    | 'approved'
    | 'partially_approved'
    | 'rejected'
    | 'completed'
    | 'failed'
    | 'ongoing'
    | 'queued'
    | 'pending'
    | 'pending_mtn_approval';

export interface Transaction {
    id: string;
    publicId?: string;
    referenceCode?: string;
    recipientPhone: string;
    amount: number;
    status: OrderStatus;
    network: string;
    dataAmount: string;
    createdAt: string;
    updatedAt?: string;
    lastSyncedAt?: string;
    serialId?: number | string;
    balanceBefore?: number | null;
    balanceAfter?: number | null;
    source?: string;
    paid?: string;
    sourceProvider?: string;
}

export interface PurchaseData {
    bundleId: string;
    recipientPhone: string;
}

export interface PurchaseResponse {
    success: boolean;
    message: string;
    transaction: Transaction;
    error?: {
        code?: string;
        message?: string;
    };
    code?: string;
}

export const bundleService = {
    // Get all bundles from authoritative DataHouse catalog
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

    // Get user transactions with server-side pagination
    getAll: async (params?: { 
        status?: string; 
        network?: string;
        search?: string;
        page?: number;
        limit?: number; 
        offset?: number;
        sortBy?: string;
        sortOrder?: string;
    }): Promise<{ data: Transaction[]; pagination: any } | Transaction[]> => {
        const queryParams = new URLSearchParams();
        if (params?.status) queryParams.append('status', params.status);
        if (params?.network) queryParams.append('network', params.network);
        if (params?.search) queryParams.append('search', params.search);
        if (params?.page) queryParams.append('page', params.page.toString());
        if (params?.limit) queryParams.append('limit', params.limit.toString());
        if (params?.offset) queryParams.append('offset', params.offset.toString());
        if (params?.sortBy) queryParams.append('sortBy', params.sortBy);
        if (params?.sortOrder) queryParams.append('sortOrder', params.sortOrder);

        const query = queryParams.toString();
        return api.get(`/transactions${query ? `?${query}` : ''}`);
    },

    // Get single transaction
    getById: async (id: string): Promise<Transaction> => {
        return api.get<Transaction>(`/transactions/${id}`);
    },

    // Sync transaction status with DataHouse
    sync: async (id: string): Promise<{ message: string; synced: boolean; status?: OrderStatus; datahouseOrder?: any }> => {
        return api.get(`/transactions/${id}/sync`);
    },
};

export default { bundleService, transactionService };
