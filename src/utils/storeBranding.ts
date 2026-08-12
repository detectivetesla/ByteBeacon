/**
 * Storefront Branding Utility & Fallback Manager
 * Provides a single source of truth for storefront branding details
 * and neutral generic fallbacks (zero ByteBeacon branding).
 */

// Neutral generic SVG store mark icon encoded as data URI for favicon & image fallback
export const GENERIC_STORE_SVG_DATA_URI = 
    `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="%233b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><path d="M10 12h4"/></svg>`;

export const GENERIC_DEFAULT_DESCRIPTION = 
    'Buy affordable mobile data bundles with fast and reliable delivery.';

export interface StoreBrandingInput {
    store_name?: string;
    logo_url?: string | null;
    description?: string | null;
    phone?: string | null;
}

export interface StoreBranding {
    name: string;
    logoUrl: string | null;
    hasCustomLogo: boolean;
    description: string;
    phone: string | null;
    faviconUrl: string;
}

/**
 * Resolves complete storefront branding from store object
 */
export const getStoreBranding = (store?: StoreBrandingInput | null): StoreBranding => {
    const name = store?.store_name?.trim() || 'Data Store';
    const logoUrl = store?.logo_url?.trim() || null;
    const hasCustomLogo = Boolean(logoUrl && (logoUrl.startsWith('http://') || logoUrl.startsWith('https://') || logoUrl.startsWith('data:')));
    const description = store?.description?.trim() || GENERIC_DEFAULT_DESCRIPTION;
    const phone = store?.phone?.trim() || null;
    const faviconUrl = hasCustomLogo ? logoUrl! : GENERIC_STORE_SVG_DATA_URI;

    return {
        name,
        logoUrl,
        hasCustomLogo,
        description,
        phone,
        faviconUrl
    };
};

/**
 * Validates whether a logo URL is syntactically a valid HTTP/HTTPS/data image URL
 */
export const isValidLogoUrl = (url?: string | null): boolean => {
    if (!url || !url.trim()) return false;
    const trimmed = url.trim();
    if (trimmed.startsWith('data:image/')) return true;
    try {
        const parsed = new URL(trimmed);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
};
