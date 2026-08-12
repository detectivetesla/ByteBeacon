// Domain configuration and helper functions for ByteBeacon and Agent Storefront

export const STOREFRONT_BASE_URL = (
    import.meta.env.VITE_STOREFRONT_URL || 'https://apisolutions.store'
).replace(/\/$/, '');

export const MAIN_PLATFORM_URL = (
    import.meta.env.VITE_MAIN_PLATFORM_URL || 'https://bytebeacon.online'
).replace(/\/$/, '');

/**
 * Returns the full canonical public storefront URL for a given store slug.
 * Example: https://apisolutions.store/store/mydata
 */
export const getStorefrontUrl = (slug: string): string => {
    if (!slug) return STOREFRONT_BASE_URL;
    return `${STOREFRONT_BASE_URL}/store/${slug}`;
};

/**
 * Checks if the current browser window location is on the public storefront domain (apisolutions.store).
 */
export const isStorefrontDomain = (): boolean => {
    if (typeof window === 'undefined') return false;
    const hostname = window.location.hostname.toLowerCase();
    const storefrontHostname = new URL(STOREFRONT_BASE_URL).hostname.toLowerCase();
    return hostname === storefrontHostname || hostname.endsWith(`.${storefrontHostname}`);
};

/**
 * Checks if the current browser window location is on the main platform domain (bytebeacon.online).
 */
export const isMainPlatformDomain = (): boolean => {
    if (typeof window === 'undefined') return true;
    const hostname = window.location.hostname.toLowerCase();
    return hostname.includes('bytebeacon.online') || hostname === 'localhost' || hostname === '127.0.0.1';
};
