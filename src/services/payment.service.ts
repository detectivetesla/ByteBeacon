import { api } from './api';

export interface PaymentInitResponse {
    success: boolean;
    authorization_url: string;
    reference: string;
    transaction_id: string;
}

export interface PaymentVerifyResponse {
    success: boolean;
    status: 'completed' | 'processing' | 'failed';
    message: string;
    transaction_id: string;
}

export interface PaymentStatusResponse {
    id: string;
    status: string;
    amount_ghc: number;
    recipient_phone: string;
    network: string;
    data_amount: string;
    created_at: string;
}

export interface ProcessPaymentData {
    email: string;
    amount: number;
    bundleId: string;
    recipientPhone: string;
    network: string;
    dataAmount: string;
    callbackUrl?: string;
}

export const paymentService = {
    // Initialize Paystack payment
    processPayment: async (data: ProcessPaymentData): Promise<PaymentInitResponse> => {
        return api.post<PaymentInitResponse>('/payment/process', data);
    },

    // Verify payment after Paystack callback
    verifyPayment: async (reference: string): Promise<PaymentVerifyResponse> => {
        return api.post<PaymentVerifyResponse>('/payment/verify', { reference });
    },

    // Get payment status by reference
    getPaymentStatus: async (reference: string): Promise<PaymentStatusResponse> => {
        return api.get<PaymentStatusResponse>(`/payment/status/${reference}`);
    },
};
