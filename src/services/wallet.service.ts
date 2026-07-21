import { api } from './api';

export interface WalletBalance {
    balance: number;
}

export interface Deposit {
    id: string;
    amount: number;
    reference: string;
    status: 'processing' | 'completed' | 'failed';
    createdAt: string;
}

export interface FundResponse {
    message: string;
    depositId: string;
    newBalance: number;
}

export interface WalletCreditRequest {
    id: string;
    userId: string;
    fullName?: string;
    email?: string;
    phone?: string;
    amount: number;
    status: 'pending' | 'approved' | 'rejected';
    adminNotes?: string | null;
    agentNotes?: string | null;
    createdAt: string;
    updatedAt: string;
}

export const walletService = {
    // Get wallet balance
    getBalance: async (): Promise<WalletBalance> => {
        return api.get<WalletBalance>('/wallet/balance');
    },

    // Fund wallet (simulated - integrate with Paystack in production)
    fund: async (amount: number, reference?: string): Promise<FundResponse> => {
        return api.post<FundResponse>('/wallet/fund', { amount, reference });
    },

    // Get deposit history
    getDeposits: async (): Promise<Deposit[]> => {
        return api.get<Deposit[]>('/wallet/deposits');
    },

    // Create a wallet credit request (Agents)
    createCreditRequest: async (amount: number, agentNotes?: string): Promise<{ success: boolean; message: string; data: WalletCreditRequest }> => {
        return api.post<{ success: boolean; message: string; data: WalletCreditRequest }>('/wallet/credit-requests', { amount, agentNotes });
    },

    // Get my wallet credit requests (Agents)
    getMyCreditRequests: async (): Promise<{ success: boolean; data: WalletCreditRequest[] }> => {
        return api.get<{ success: boolean; data: WalletCreditRequest[] }>('/wallet/credit-requests');
    },

    // Get all wallet credit requests (Admin only)
    getAdminWalletCreditRequests: async (status?: string): Promise<WalletCreditRequest[]> => {
        const query = status ? `?status=${status}` : '';
        return api.get<WalletCreditRequest[]>(`/admin/wallet-credit-requests${query}`);
    },

    // Update wallet credit request status (Admin only)
    updateWalletCreditRequest: async (
        id: string,
        payload: { status: 'approved' | 'rejected'; adminNotes?: string }
    ): Promise<{ success: boolean; message: string }> => {
        return api.put<{ success: boolean; message: string }>(`/admin/wallet-credit-requests/${id}`, payload);
    },

    // Direct manually credit/debit/set user's wallet (Admin only)
    adminCreditUserWallet: async (
        userId: string, 
        amount: number, 
        action?: 'credit' | 'debit' | 'set', 
        notes?: string
    ): Promise<{ success: boolean; message: string; newBalance: number }> => {
        return api.post<{ success: boolean; message: string; newBalance: number }>(`/admin/users/${userId}/credit-wallet`, { amount, action, notes });
    },

    // Get system public configuration
    getSystemConfig: async (): Promise<{ paystackPublicKey: string }> => {
        return api.get<{ paystackPublicKey: string }>('/system/config');
    },
};

export default walletService;
