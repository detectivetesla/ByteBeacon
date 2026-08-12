import { api } from './api';

export interface BulkSubmissionResponse {
    success: boolean;
    statusCode: number;
    message: string;
    data: {
        submissionId: string;
        publicId: string;
        referenceCode: string;
        status: string;
        totalRecipients: number;
        queuedRecipients: number;
        chunkSize: number;
        isDuplicate?: boolean;
    };
}

export interface BulkSubmissionStatus {
    id: string;
    publicId: string;
    referenceCode: string;
    network: string;
    dataAmount: string;
    status: string;
    source: string;
    totalRecipients: number;
    queued: number;
    processing: number;
    completed: number;
    failed: number;
    blocked: number;
    pendingMtn: number;
    unresolved: number;
    progressPercent: number;
    createdAt: string;
    startedAt?: string;
    completedAt?: string;
    lastProgressAt: string;
}

export interface BulkItem {
    id: string;
    item_index: number;
    recipient_phone: string;
    normalized_phone: string;
    network: string;
    bundle_size: string;
    status: string;
    transaction_id?: string;
    datahouse_reference?: string;
    attempt_count: number;
    error_code?: string;
    error_message?: string;
    created_at: string;
    updated_at: string;
}

export interface BulkItemsResponse {
    success: boolean;
    data: BulkItem[];
    pagination: {
        page: number;
        limit: number;
        totalItems: number;
        totalPages: number;
    };
}

/**
 * Submit bulk order asynchronously
 */
export async function submitBulkOrderApi(payload: {
    bundleId?: string;
    network: string;
    dataAmount: string;
    recipients: string[];
    idempotencyKey?: string;
    source?: string;
}): Promise<BulkSubmissionResponse> {
    return api.post<BulkSubmissionResponse>('/bulk-orders', payload);
}

/**
 * Get bulk submission status and progress
 */
export async function getBulkSubmissionStatusApi(submissionId: string): Promise<{ success: boolean; data: BulkSubmissionStatus }> {
    return api.get<{ success: boolean; data: BulkSubmissionStatus }>(`/bulk-orders/${submissionId}`);
}

/**
 * Get server-side paginated items for a bulk submission
 */
export async function getBulkSubmissionItemsApi(
    submissionId: string,
    page = 1,
    limit = 50,
    status = 'all',
    search = ''
): Promise<BulkItemsResponse> {
    const query = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        status,
        search
    }).toString();
    return api.get<BulkItemsResponse>(`/bulk-orders/${submissionId}/items?${query}`);
}

/**
 * Retry failed items in a bulk batch
 */
export async function retryBulkSubmissionApi(submissionId: string): Promise<{ success: boolean; message: string; requeuedCount: number }> {
    return api.post<{ success: boolean; message: string; requeuedCount: number }>(`/bulk-orders/${submissionId}/retry`);
}
