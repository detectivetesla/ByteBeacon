// API Configuration and Base Service
let API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Safety check: If we are on a production domain but the API URL is pointing to localhost, override it.
// This prevents connection refused errors due to misconfigured Vercel environment variables.
if (typeof window !== 'undefined' && !window.location.hostname.includes('localhost') && API_BASE_URL.includes('localhost')) {
    API_BASE_URL = '/api';
}

// Token management
const getToken = (): string | null => {
    return localStorage.getItem('auth_token');
};

const setToken = (token: string): void => {
    localStorage.setItem('auth_token', token);
};

const removeToken = (): void => {
    localStorage.removeItem('auth_token');
};

// Base fetch wrapper with auth
export const apiFetch = async <T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> => {
    const token = getToken();

    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
    });

    const data = await response.json();

    if (!response.ok) {
        const err: any = new Error(data.error || data.message || 'API request failed');
        err.data = data;
        err.status = response.status;
        err.code = data.code || null;
        throw err;
    }

    return data as T;
};

// API Methods
export const api = {
    get: <T>(endpoint: string) => apiFetch<T>(endpoint, { method: 'GET' }),

    post: <T>(endpoint: string, body?: unknown) =>
        apiFetch<T>(endpoint, {
            method: 'POST',
            body: body ? JSON.stringify(body) : undefined
        }),

    put: <T>(endpoint: string, body?: unknown) =>
        apiFetch<T>(endpoint, {
            method: 'PUT',
            body: body ? JSON.stringify(body) : undefined
        }),

    delete: <T>(endpoint: string) => apiFetch<T>(endpoint, { method: 'DELETE' }),
};

export { getToken, setToken, removeToken, API_BASE_URL };
