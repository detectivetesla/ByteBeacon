import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { agentStoreService, AgentProduct, AgentOrder } from '@/services/agentStore.service';
import {
    Store as StoreIcon,
    ShieldCheck,
    Zap,
    ShoppingCart,
    CheckCircle2,
    Phone,
    ArrowRight,
    RefreshCw,
    AlertTriangle,
    Home,
    FileText,
    Info,
    Sun,
    Moon,
    MessageCircle,
    Flame,
    Menu,
    X,
    Search,
    Clock,
    Check
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { getStoreBranding, GENERIC_STORE_SVG_DATA_URI } from '@/utils/storeBranding';

// Helper for formatting WhatsApp URL safely
const formatWhatsAppUrl = (phoneStr?: string) => {
    if (!phoneStr) return null;
    const cleaned = phoneStr.replace(/\D/g, '');
    if (!cleaned) return null;
    let formatted = cleaned;
    if (cleaned.startsWith('0') && cleaned.length === 10) {
        formatted = '233' + cleaned.substring(1);
    }
    return `https://wa.me/${formatted}`;
};

// Generic professional hero description for ALL storefronts
const GENERIC_HERO_DESCRIPTION = 
    "MTN, Telecel & AirtelTigo bundles delivered to your phone within minutes. Safe, fast, and reliable.";

// Helper for Network Theme Classes (Used for Buy Data Cards)
const getNetworkTheme = (networkName?: string) => {
    const net = (networkName || '').toUpperCase();
    if (net === 'MTN') {
        return {
            bg: 'bg-amber-400 text-[#0f172a] border-amber-400 shadow-amber-400/20',
            badge: 'bg-[#0f172a] text-amber-400',
            text: 'text-[#0f172a]',
            subtext: 'text-[#0f172a]/80',
            price: 'text-[#0f172a]',
            button: 'bg-[#0f172a] text-amber-400 hover:bg-black',
            chipActive: 'bg-amber-400 text-[#0f172a] font-black border-amber-400 shadow-lg shadow-amber-400/20'
        };
    }
    if (net === 'TELECEL' || net === 'VODA') {
        return {
            bg: 'bg-red-600 text-white border-red-600 shadow-red-600/20',
            badge: 'bg-white text-red-600',
            text: 'text-white',
            subtext: 'text-white/90',
            price: 'text-white',
            button: 'bg-white text-red-600 hover:bg-slate-100',
            chipActive: 'bg-red-600 text-white font-black border-red-600 shadow-lg shadow-red-600/20'
        };
    }
    // AirtelTigo / AT
    return {
        bg: 'bg-blue-600 text-white border-blue-600 shadow-blue-600/20',
        badge: 'bg-white text-blue-600',
        text: 'text-white',
        subtext: 'text-white/90',
        price: 'text-white',
        button: 'bg-white text-blue-600 hover:bg-slate-100',
        chipActive: 'bg-blue-600 text-white font-black border-blue-600 shadow-lg shadow-blue-600/20'
    };
};

// Calculate elapsed delivery duration from order timestamp
const getDeliveryDuration = (created_at?: string, status?: string) => {
    if (!created_at) return null;
    const start = new Date(created_at).getTime();
    if (isNaN(start)) return null;
    const now = Date.now();
    const diffMs = Math.max(0, now - start);
    const diffMins = Math.floor(diffMs / 60000);
    const diffSecs = Math.floor((diffMs % 60000) / 1000);
    
    const s = (status || '').toLowerCase();
    if (s === 'completed' || s === 'delivered') {
        if (diffMins === 0) return `Delivered in ${diffSecs}s`;
        return `Delivered in ${diffMins}m ${diffSecs}s`;
    }
    if (s === 'refunded') return `Refunded`;
    if (s === 'failed') return `Failed`;
    if (diffMins === 0) return `Processing for ${diffSecs}s`;
    return `Processing for ${diffMins}m ${diffSecs}s`;
};

// Live Tracker Lifecycle Stages Component
const LiveTrackerLifecycle = ({ status, isDark }: { status: string; isDark: boolean }) => {
    const s = (status || '').toLowerCase();
    const isCompleted = s === 'completed' || s === 'delivered';
    const isMtnPending = s === 'pending_mtn_approval' || s === 'awaiting_mtn_approval';
    const isFailed = s === 'failed' || s === 'rejected';
    const isRefunded = s === 'refunded';

    if (isMtnPending) {
        return (
            <div className="space-y-3 text-xs py-1">
                <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-500 text-black flex items-center justify-center text-[10px] font-black shrink-0">✓</span>
                    <span className="font-semibold text-emerald-500">Order Recorded</span>
                </div>
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-1 text-amber-400">
                    <p className="font-bold flex items-center gap-1.5 text-xs">
                        ⚠️ Awaiting MTN Approval
                    </p>
                    <p className="text-[11px] leading-relaxed text-amber-300/90">
                        This recipient's MTN number requires one-time approval from MTN before data can be delivered. No data order has failed — fulfillment will process automatically once approved.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-2.5 text-xs py-1">
            <div className="flex items-center gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-500 text-black flex items-center justify-center text-[10px] font-black shrink-0">✓</span>
                <span className="font-semibold text-emerald-500">Order Placed</span>
            </div>
            <div className="flex items-center gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-500 text-black flex items-center justify-center text-[10px] font-black shrink-0">✓</span>
                <span className="font-semibold text-emerald-500">Queue Validation</span>
            </div>
            <div className="flex items-center gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-500 text-black flex items-center justify-center text-[10px] font-black shrink-0">✓</span>
                <span className="font-semibold text-emerald-500">Gateway Processing</span>
            </div>
            <div className="flex items-center gap-2.5">
                {isCompleted ? (
                    <span className="w-5 h-5 rounded-full bg-emerald-500 text-black flex items-center justify-center text-[10px] font-black shrink-0">✓</span>
                ) : isRefunded ? (
                    <span className="w-5 h-5 rounded-full bg-purple-500 text-white flex items-center justify-center text-[10px] font-black shrink-0">↩</span>
                ) : isFailed ? (
                    <span className="w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center text-[10px] font-black shrink-0">✕</span>
                ) : (
                    <span className="w-5 h-5 rounded-full bg-amber-400 text-black flex items-center justify-center text-[10px] font-black animate-pulse shrink-0">●</span>
                )}
                <span className={`font-bold ${
                    isCompleted ? 'text-emerald-500' : isRefunded ? 'text-purple-400' : isFailed ? 'text-rose-500' : 'text-amber-400'
                }`}>
                    {isCompleted ? 'Bundle Delivered Successfully' : isRefunded ? 'Refunded' : isFailed ? 'Order Failed' : 'Delivery Processing...'}
                </span>
            </div>
        </div>
    );
};

// ─── REUSABLE SKELETON COMPONENTS ────────────────────────────────────────────

const Sk = ({ className = '', isDark }: { className?: string; isDark: boolean }) => (
    <div className={`rounded-lg animate-pulse ${isDark ? 'bg-white/[0.07]' : 'bg-slate-200/80'} ${className}`} />
);

const SkeletonHero = ({ isDark }: { isDark: boolean }) => (
    <div role="status" aria-label="Loading hero" className={`p-6 sm:p-10 md:p-12 rounded-3xl border text-left flex flex-col items-start justify-center shadow-2xl relative overflow-hidden ${
        isDark ? 'bg-[#202227] border-white/5' : 'bg-white border-slate-200'
    }`}>
        <div className="max-w-xl space-y-5 w-full">
            <Sk isDark={isDark} className="w-32 h-6 rounded-full" />
            <div className="space-y-2">
                <Sk isDark={isDark} className="w-64 sm:w-80 h-9 sm:h-11 rounded-xl" />
                <Sk isDark={isDark} className="w-48 sm:w-64 h-9 sm:h-11 rounded-xl" />
            </div>
            <div className="space-y-2">
                <Sk isDark={isDark} className="w-full max-w-md h-4 rounded-md" />
                <Sk isDark={isDark} className="w-3/4 max-w-sm h-4 rounded-md" />
            </div>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Sk isDark={isDark} className="w-36 h-11 rounded-xl" />
                <Sk isDark={isDark} className="w-32 h-11 rounded-xl" />
            </div>
        </div>
    </div>
);

const SkeletonTracker = ({ isDark }: { isDark: boolean }) => (
    <div role="status" aria-label="Loading tracker" className={`p-5 sm:p-6 rounded-3xl border space-y-5 shadow-xl ${
        isDark ? 'bg-[#202227] border-white/10' : 'bg-white border-slate-200'
    }`}>
        <div className="flex items-center justify-between border-b pb-3 border-current/10">
            <div className="space-y-2">
                <Sk isDark={isDark} className="w-40 h-5 rounded-md" />
                <Sk isDark={isDark} className="w-64 h-3 rounded-md" />
            </div>
        </div>
        <div className={`p-5 rounded-2xl border space-y-4 ${isDark ? 'bg-[#18191c] border-white/5' : 'bg-slate-50 border-slate-200'}`}>
            <div className="space-y-2">
                <Sk isDark={isDark} className="w-28 h-3 rounded-md" />
                <Sk isDark={isDark} className="w-40 h-6 rounded-lg" />
                <Sk isDark={isDark} className="w-56 h-3 rounded-md" />
            </div>
            <div className="space-y-2.5 py-1">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="flex items-center gap-2.5">
                        <Sk isDark={isDark} className="w-5 h-5 rounded-full shrink-0" />
                        <Sk isDark={isDark} className="w-32 h-4 rounded-md" />
                    </div>
                ))}
            </div>
            <div className="flex justify-between pt-2 border-t border-current/10">
                <Sk isDark={isDark} className="w-36 h-3 rounded-md" />
                <Sk isDark={isDark} className="w-20 h-3 rounded-md" />
            </div>
        </div>
    </div>
);

const SkeletonNetworkCard = ({ isDark }: { isDark: boolean }) => (
    <div role="status" aria-label="Loading network" className={`p-6 rounded-3xl border shadow-xl ${
        isDark ? 'bg-[#202227] border-white/5' : 'bg-white border-slate-200'
    }`}>
        <div className="flex justify-between items-start mb-4">
            <Sk isDark={isDark} className="w-16 h-6 rounded-xl" />
            <Sk isDark={isDark} className="w-20 h-6 rounded-lg" />
        </div>
        <Sk isDark={isDark} className="w-32 h-7 rounded-lg mb-2" />
        <Sk isDark={isDark} className="w-48 h-4 rounded-md" />
        <Sk isDark={isDark} className="w-24 h-5 rounded-md mt-5" />
    </div>
);

const SkeletonPopularCard = ({ isDark }: { isDark: boolean }) => (
    <div role="status" aria-label="Loading bundle" className={`p-5 rounded-3xl border shadow-xl flex flex-col justify-between space-y-4 ${
        isDark ? 'bg-[#202227] border-white/5' : 'bg-white border-slate-200'
    }`}>
        <div className="space-y-2">
            <div className="flex justify-between items-center">
                <Sk isDark={isDark} className="w-14 h-5 rounded-lg" />
                <Sk isDark={isDark} className="w-20 h-4 rounded-md" />
            </div>
            <Sk isDark={isDark} className="w-28 h-8 rounded-lg" />
        </div>
        <div className="pt-3 border-t border-current/10 flex items-center justify-between">
            <div className="space-y-1">
                <Sk isDark={isDark} className="w-16 h-3 rounded-md" />
                <Sk isDark={isDark} className="w-20 h-6 rounded-md" />
            </div>
            <Sk isDark={isDark} className="w-24 h-9 rounded-xl" />
        </div>
    </div>
);

const SkeletonBuyDataCard = ({ isDark }: { isDark: boolean }) => (
    <div role="status" aria-label="Loading bundle" className={`p-6 rounded-3xl border shadow-xl flex flex-col justify-between space-y-4 ${
        isDark ? 'bg-[#202227] border-white/5' : 'bg-white border-slate-200'
    }`}>
        <div className="space-y-2">
            <div className="flex justify-between items-center">
                <Sk isDark={isDark} className="w-16 h-5 rounded-lg" />
                <Sk isDark={isDark} className="w-24 h-4 rounded-md" />
            </div>
            <Sk isDark={isDark} className="w-32 h-9 rounded-lg" />
        </div>
        <div className="pt-4 border-t border-current/10 flex items-center justify-between">
            <div className="space-y-1">
                <Sk isDark={isDark} className="w-16 h-3 rounded-md" />
                <Sk isDark={isDark} className="w-20 h-7 rounded-md" />
            </div>
            <Sk isDark={isDark} className="w-28 h-10 rounded-xl" />
        </div>
    </div>
);

const SkeletonInfoBlock = ({ isDark }: { isDark: boolean }) => (
    <div role="status" aria-label="Loading info" className={`p-4 rounded-2xl border space-y-2 ${
        isDark ? 'bg-[#18191c] border-white/5' : 'bg-slate-50 border-slate-200'
    }`}>
        <Sk isDark={isDark} className="w-24 h-3 rounded-md" />
        <Sk isDark={isDark} className="w-48 h-5 rounded-md" />
    </div>
);

// ─── END SKELETON COMPONENTS ─────────────────────────────────────────────────

export default function PublicStorefront() {
    const { slug } = useParams<{ slug: string }>();
    const [searchParams] = useSearchParams();
    const referenceFromUrl = searchParams.get('reference');
    const { toast } = useToast();

    // Theme state (Dark/Light with localStorage persistence)
    const [theme, setTheme] = useState<'dark' | 'light'>(() => {
        const saved = localStorage.getItem('agent_store_theme');
        if (saved === 'light' || saved === 'dark') return saved;
        return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    });

    const isDark = theme === 'dark';

    useEffect(() => {
        localStorage.setItem('agent_store_theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'dark' ? 'light' : 'dark');
    };

    // Store & Product state
    const [storeInfo, setStoreInfo] = useState<{ id: string; store_name: string; slug: string; description: string; phone: string; logo_url: string } | null>(null);
    const [products, setProducts] = useState<AgentProduct[]>([]);
    const [selectedNetwork, setSelectedNetwork] = useState<string>('ALL');
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Navigation Tab state ('home' | 'purchase' | 'track' | 'info')
    const [activeTab, setActiveTab] = useState<'home' | 'purchase' | 'track' | 'info'>('home');
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    // Purchase Modal states
    const [selectedBundle, setSelectedBundle] = useState<AgentProduct | null>(null);
    const [customerPhone, setCustomerPhone] = useState('');
    const [isInitializing, setIsInitializing] = useState(false);

    // Order Verification states
    const [verifying, setVerifying] = useState(false);
    const [verificationResult, setVerificationResult] = useState<{ status: string; message: string; order_id: string } | null>(null);

    // Live Order Tracking states
    const [homeTrackInput, setHomeTrackInput] = useState('');
    const [trackingLoading, setTrackingLoading] = useState(false);
    const [trackedOrder, setTrackedOrder] = useState<AgentOrder | null>(null);
    const [trackingError, setTrackingError] = useState<string | null>(null);

    // Recent order persisted locally for Home page tracking
    const [recentOrder, setRecentOrder] = useState<AgentOrder | null>(() => {
        try {
            const saved = localStorage.getItem(`store_last_order_${slug}`);
            return saved ? JSON.parse(saved) : null;
        } catch {
            return null;
        }
    });

    const loadStorefront = async () => {
        if (!slug) return;
        setLoading(true);
        setErrorMsg(null);
        try {
            const res = await agentStoreService.getPublicStorefront(slug);
            if (res.success) {
                setStoreInfo(res.store);
                setProducts(res.products);
            }
        } catch (err: any) {
            setErrorMsg(err.message || 'Store not found or currently inactive.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadStorefront();
    }, [slug]);

    // Dynamic White-Label Head Metadata & Favicon Management
    useEffect(() => {
        const originalTitle = document.title;
        const iconLink = document.querySelector<HTMLLinkElement>("link[rel*='icon']");
        const originalIcon = iconLink ? iconLink.href : '/logo.png';

        const branding = getStoreBranding(storeInfo);

        if (storeInfo?.store_name) {
            document.title = `${branding.name} — Data Store`;

            // Dynamic Favicon Update
            if (iconLink) {
                iconLink.href = branding.faviconUrl;
            }

            // Dynamic Meta Description & Social Graph Metadata
            const updateMetaTag = (selector: string, content: string) => {
                let tag = document.querySelector<HTMLMetaElement>(selector);
                if (!tag) {
                    tag = document.createElement('meta');
                    if (selector.startsWith('meta[name=')) {
                        tag.name = selector.replace("meta[name='", '').replace("']", '');
                    } else if (selector.startsWith('meta[property=')) {
                        tag.setAttribute('property', selector.replace("meta[property='", '').replace("']", ''));
                    }
                    document.head.appendChild(tag);
                }
                tag.content = content;
            };

            updateMetaTag("meta[name='description']", branding.description);
            updateMetaTag("meta[property='og:title']", `${branding.name} — Data Store`);
            updateMetaTag("meta[property='og:description']", branding.description);
            if (branding.hasCustomLogo) {
                updateMetaTag("meta[property='og:image']", branding.logoUrl!);
                updateMetaTag("meta[name='twitter:image']", branding.logoUrl!);
            }
            updateMetaTag("meta[name='twitter:title']", `${branding.name} — Data Store`);
            updateMetaTag("meta[name='twitter:description']", branding.description);
        }

        return () => {
            document.title = originalTitle;
            if (iconLink) {
                iconLink.href = originalIcon;
            }
        };
    }, [storeInfo]);

    // Handle payment callback verification if reference in URL
    useEffect(() => {
        if (referenceFromUrl && !verifying && !verificationResult) {
            verifyPayment(referenceFromUrl);
        }
    }, [referenceFromUrl]);

    // Real-Time Controlled Polling (every 8 seconds) for active processing order until terminal state
    const activeLiveOrder = trackedOrder || recentOrder;

    useEffect(() => {
        if (!activeLiveOrder) return;
        const s = (activeLiveOrder.fulfillment_status || '').toLowerCase();
        if (s === 'completed' || s === 'delivered' || s === 'refunded' || s === 'failed') return;

        const interval = setInterval(async () => {
            try {
                const res = await agentStoreService.trackPublicOrder(activeLiveOrder.id);
                if (res.success && res.order) {
                    setRecentOrder(res.order);
                    setTrackedOrder(res.order);
                    if (slug) localStorage.setItem(`store_last_order_${slug}`, JSON.stringify(res.order));
                }
            } catch (e) {
                // silent background polling catch
            }
        }, 8000);

        return () => clearInterval(interval);
    }, [activeLiveOrder, slug]);

    const verifyPayment = async (ref: string) => {
        setVerifying(true);
        try {
            const res = await agentStoreService.verifyCustomerPurchase(ref);
            if (res.success) {
                setVerificationResult({
                    status: res.status,
                    message: res.message,
                    order_id: res.order_id
                });
                try {
                    const orderRes = await agentStoreService.trackPublicOrder(res.order_id);
                    if (orderRes.success && orderRes.order) {
                        setRecentOrder(orderRes.order);
                        setTrackedOrder(orderRes.order);
                        if (slug) localStorage.setItem(`store_last_order_${slug}`, JSON.stringify(orderRes.order));
                    }
                } catch (e) {
                    console.error('Error fetching verified order details:', e);
                }
            }
        } catch (err: any) {
            toast({ title: 'Verification Error', description: err.message || 'Payment verification failed', variant: 'destructive' });
        } finally {
            setVerifying(false);
        }
    };

    const handleBuyClick = (bundle: AgentProduct) => {
        setSelectedBundle(bundle);
        setCustomerPhone('');
    };

    const handleProceedToPayment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedBundle || !slug) return;

        if (!customerPhone.trim() || customerPhone.length < 10) {
            toast({ title: 'Invalid Phone Number', description: 'Please enter a valid recipient phone number.', variant: 'destructive' });
            return;
        }

        setIsInitializing(true);
        try {
            const res = await agentStoreService.initializeCustomerPurchase(slug, {
                bundleId: selectedBundle.bundle_id,
                customerPhone: customerPhone.trim()
            });

            if (res.success && res.authorization_url) {
                window.location.href = res.authorization_url;
            }
        } catch (err: any) {
            toast({ title: 'Checkout Error', description: err.message || 'Failed to initialize payment', variant: 'destructive' });
        } finally {
            setIsInitializing(false);
        }
    };

    const handleTrackSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const refQuery = homeTrackInput.trim();
        if (!refQuery) return;

        setTrackingLoading(true);
        setTrackingError(null);

        try {
            const res = await agentStoreService.trackPublicOrder(refQuery);
            if (res.success && res.order) {
                setTrackedOrder(res.order);
                setRecentOrder(res.order);
                if (slug) {
                    localStorage.setItem(`store_last_order_${slug}`, JSON.stringify(res.order));
                }
            } else {
                setTrackingError('Order not found. Please check your order reference and try again.');
                setTrackedOrder(null);
            }
        } catch (err: any) {
            setTrackingError('Order not found. Please check your order reference and try again.');
            setTrackedOrder(null);
        } finally {
            setTrackingLoading(false);
        }
    };

    // Network counts calculation
    const networkCounts = useMemo(() => {
        const counts: Record<string, number> = { MTN: 0, TELECEL: 0, AIRTELTIGO: 0 };
        products.forEach(p => {
            const net = (p.network || '').toUpperCase();
            if (net === 'MTN') counts.MTN += 1;
            else if (net === 'TELECEL' || net === 'VODA') counts.TELECEL += 1;
            else if (net === 'AIRTELTIGO' || net === 'AT') counts.AIRTELTIGO += 1;
        });
        return counts;
    }, [products]);

    // Popular Bundles: Standard card appearance preserved
    const popularBundles = useMemo(() => {
        const getTop = (netKey: string, count = 3) => {
            return products
                .filter(p => {
                    const n = (p.network || '').toUpperCase();
                    if (netKey === 'MTN') return n === 'MTN';
                    if (netKey === 'TELECEL') return n === 'TELECEL' || n === 'VODA';
                    if (netKey === 'AIRTELTIGO') return n === 'AIRTELTIGO' || n === 'AT';
                    return false;
                })
                .sort((a, b) => (parseFloat(a.agent_price_ghc as any) || 0) - (parseFloat(b.agent_price_ghc as any) || 0))
                .slice(0, count);
        };

        return {
            MTN: getTop('MTN'),
            TELECEL: getTop('TELECEL'),
            AIRTELTIGO: getTop('AIRTELTIGO')
        };
    }, [products]);

    // Computed values available during both loading and loaded states
    const filteredProducts = products.filter(p => selectedNetwork === 'ALL' || p.network === selectedNetwork);
    const whatsAppUrl = formatWhatsAppUrl(storeInfo?.phone);
    const navTabs = [
        { id: 'home', label: 'Home', icon: Home },
        { id: 'purchase', label: 'Buy Data', icon: ShoppingCart },
        { id: 'track', label: 'Track Order', icon: FileText },
        { id: 'info', label: 'Info', icon: Info },
    ] as const;
    const deliveryDuration = activeLiveOrder ? getDeliveryDuration(activeLiveOrder.created_at, activeLiveOrder.fulfillment_status) : null;

    if (errorMsg) {
        return (
            <div className={`min-h-screen flex items-center justify-center p-4 font-sans ${
                isDark ? 'bg-[#141518] text-white' : 'bg-slate-50 text-slate-900'
            }`}>
                <div className={`p-8 rounded-3xl border max-w-md w-full text-center space-y-4 shadow-2xl ${
                    isDark ? 'bg-[#202227] border-white/10' : 'bg-white border-slate-200'
                }`}>
                    <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
                    <h2 className="text-xl font-bold">Store Currently Unavailable</h2>
                    <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{errorMsg}</p>
                </div>
            </div>
        );
    }


    return (
        <div className={`min-h-screen font-sans selection:bg-[#a3e635] selection:text-black flex flex-col transition-colors duration-200 overflow-x-hidden ${
            isDark ? 'bg-[#141518] text-white' : 'bg-slate-50 text-slate-900'
        }`}>
            {/* Top Store Header */}
            <header className={`border-b py-4 px-4 sm:px-6 shadow-xl sticky top-0 z-40 backdrop-blur-md ${
                isDark ? 'bg-[#202227]/95 border-white/5' : 'bg-white/95 border-slate-200'
            }`}>
                <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
                    {/* Branding */}
                    <div className="flex items-center gap-3.5">
                        {storeInfo?.logo_url ? (
                            <img
                                src={storeInfo.logo_url}
                                alt={storeInfo.store_name}
                                className={`w-11 h-11 rounded-2xl object-cover border ${
                                    isDark ? 'border-white/10' : 'border-slate-200'
                                }`}
                                onError={(e) => {
                                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                                    const fallback = e.currentTarget.parentElement?.querySelector('.header-fallback-icon');
                                    if (fallback) fallback.classList.remove('hidden');
                                }}
                            />
                        ) : null}
                        <div className={`header-fallback-icon ${storeInfo?.logo_url ? 'hidden' : ''} w-11 h-11 rounded-2xl border flex items-center justify-center ${
                            isDark ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-blue-50 border-blue-200 text-blue-600'
                        }`}>
                            <StoreIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className={`text-lg sm:text-xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>{storeInfo?.store_name}</h1>
                            <p className={`text-[11px] hidden sm:block max-w-sm truncate ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                                Instant Automated Telecommunications Data
                            </p>
                        </div>
                    </div>

                    {/* Right Controls */}
                    <div className="flex items-center gap-3">
                        {/* Desktop Navigation */}
                        <nav className="hidden md:flex items-center gap-1">
                            {navTabs.map(tab => {
                                const Icon = tab.icon;
                                const active = activeTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id as any)}
                                        className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 ${
                                            active
                                                ? 'bg-[#a3e635] text-black shadow-md shadow-[#a3e635]/20 font-black'
                                                : isDark
                                                ? 'text-slate-400 hover:text-white hover:bg-white/5'
                                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                                        }`}
                                    >
                                        <Icon className="w-3.5 h-3.5 stroke-[2.5]" />
                                        <span>{tab.label}</span>
                                    </button>
                                );
                            })}
                        </nav>

                        {/* Security Badge */}
                        <div className={`hidden lg:flex px-3 py-1.5 rounded-xl border text-[11px] items-center gap-1.5 ${
                            isDark ? 'bg-[#18191c] border-white/5 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'
                        }`}>
                            <ShieldCheck className={`w-3.5 h-3.5 ${isDark ? 'text-[#a3e635]' : 'text-emerald-600'}`} />
                            <span className="font-semibold">Instant Delivery</span>
                        </div>

                        {/* Theme Toggle */}
                        <button
                            onClick={toggleTheme}
                            aria-label="Toggle Theme"
                            className={`p-2 rounded-xl border transition-all flex items-center gap-1.5 text-xs font-bold ${
                                isDark
                                    ? 'bg-[#18191c] border-white/10 text-amber-300 hover:bg-white/10'
                                    : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                            }`}
                        >
                            {isDark ? <Sun className="w-4 h-4 stroke-[2.5]" /> : <Moon className="w-4 h-4 stroke-[2.5]" />}
                            <span className="hidden sm:inline text-[11px]">{isDark ? 'Light' : 'Dark'}</span>
                        </button>

                        {/* Mobile Hamburger Menu Icon */}
                        <button
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            aria-label="Open Navigation Menu"
                            className={`md:hidden p-2 rounded-xl border transition-all ${
                                isDark ? 'bg-[#18191c] border-white/10 text-white hover:bg-white/10' : 'bg-slate-100 border-slate-200 text-slate-800 hover:bg-slate-200'
                            }`}
                        >
                            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                        </button>
                    </div>
                </div>

                {/* Mobile Dropdown Navigation Menu */}
                {mobileMenuOpen && (
                    <div className={`md:hidden mt-3 pt-3 border-t grid grid-cols-2 gap-2 animate-in fade-in slide-in-from-top-2 duration-150 ${
                        isDark ? 'border-white/5' : 'border-slate-200'
                    }`}>
                        {navTabs.map(tab => {
                            const Icon = tab.icon;
                            const active = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => {
                                        setActiveTab(tab.id as any);
                                        setMobileMenuOpen(false);
                                    }}
                                    className={`p-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-2 ${
                                        active
                                            ? 'bg-[#a3e635] text-black shadow-md font-black'
                                            : isDark
                                            ? 'bg-[#18191c] text-slate-300 hover:bg-white/5 border border-white/5'
                                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                                    }`}
                                >
                                    <Icon className="w-4 h-4 stroke-[2.5]" />
                                    <span>{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>
                )}
            </header>

            {/* Payment Verification Banner Result */}
            {verifying && (
                <div className={`max-w-5xl mx-auto my-4 p-4 rounded-2xl border text-center space-y-2 ${
                    isDark ? 'bg-[#202227] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
                }`}>
                    <RefreshCw className="w-6 h-6 animate-spin text-[#a3e635] mx-auto" />
                    <p className="font-bold text-xs">Verifying payment & processing order...</p>
                </div>
            )}

            {verificationResult && (
                <div className={`max-w-5xl mx-auto my-4 p-6 rounded-2xl border text-center space-y-2 shadow-2xl ${
                    isDark ? 'bg-[#202227] border-[#a3e635]/30 text-white' : 'bg-emerald-50 border-emerald-300 text-slate-900'
                }`}>
                    <CheckCircle2 className="w-8 h-8 text-[#a3e635] mx-auto" />
                    <h3 className="text-base font-bold">Payment Confirmed!</h3>
                    <p className="text-xs text-slate-400">{verificationResult.message}</p>
                    <p className="text-[10px] text-slate-500 font-mono">Order ID: {verificationResult.order_id}</p>
                </div>
            )}

            {/* Main Content Area */}
            <main className="max-w-5xl mx-auto py-6 sm:py-8 px-4 sm:px-6 flex-1 w-full min-w-0 space-y-8" aria-busy={loading}>
                {/* 1. HOME TAB */}
                {activeTab === 'home' && (
                    <div className="space-y-8">
                        {/* STORE HERO BANNER — REFINED LEFT-ALIGNED COMPOSITION */}
                        {loading ? <SkeletonHero isDark={isDark} /> : (
                        <div className={`p-6 sm:p-10 md:p-12 rounded-3xl border text-left flex flex-col items-start justify-center shadow-2xl relative overflow-hidden ${
                            isDark ? 'bg-[#202227] border-white/5' : 'bg-white border-slate-200'
                        }`}>
                            <div className="max-w-xl space-y-4">
                                {/* Hero Badge */}
                                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold border ${
                                    isDark
                                        ? 'bg-[#a3e635]/10 border-[#a3e635]/30 text-[#a3e635]'
                                        : 'bg-emerald-50 border-emerald-300 text-emerald-700'
                                }`}>
                                    <Zap className="w-3.5 h-3.5 fill-current" />
                                    <span>Instant Delivery</span>
                                </div>

                                {/* Main Heading */}
                                <h2 className={`text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-[1.15] ${
                                    isDark ? 'text-white' : 'text-slate-900'
                                }`}>
                                    Buy Data Bundles
                                    <span className={`block mt-1 ${isDark ? 'text-[#a3e635]' : 'text-emerald-600'}`}>
                                        At Unbeatable Prices
                                    </span>
                                </h2>

                                {/* Generic Hero Description */}
                                <p className={`text-xs sm:text-sm md:text-base leading-relaxed max-w-lg ${
                                    isDark ? 'text-slate-300' : 'text-slate-600'
                                }`}>
                                    {GENERIC_HERO_DESCRIPTION}
                                </p>

                                {/* CTA Buttons */}
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2 w-full sm:w-auto">
                                    <button
                                        onClick={() => setActiveTab('purchase')}
                                        className="px-6 py-3.5 bg-[#a3e635] hover:bg-[#b5f73c] text-black font-extrabold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#a3e635]/20 transition-all"
                                    >
                                        <ShoppingCart className="w-4 h-4 stroke-[2.5]" />
                                        <span>Buy Data Now</span>
                                        <ArrowRight className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('track')}
                                        className={`px-6 py-3.5 font-bold rounded-xl text-xs sm:text-sm border flex items-center justify-center gap-2 transition-all ${
                                            isDark
                                                ? 'bg-[#18191c] hover:bg-[#26282e] text-slate-300 border-white/10'
                                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                                        }`}
                                    >
                                        <FileText className="w-4 h-4 stroke-[2.5]" />
                                        <span>Track Order</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                        )}

                        {/* LIVE REAL-TIME ORDER TRACKER SECTION ON HOMEPAGE */}
                        {loading ? <SkeletonTracker isDark={isDark} /> : (
                        <div className={`p-5 sm:p-6 rounded-3xl border space-y-5 shadow-xl ${
                            isDark ? 'bg-[#202227] border-white/10' : 'bg-white border-slate-200'
                        }`}>
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b pb-3 border-current/10">
                                <div>
                                    <h3 className="text-base font-black flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-[#a3e635]" />
                                        Live Order Tracker
                                    </h3>
                                    <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                                        Automated real-time tracking for your current purchase
                                    </p>
                                </div>

                                {deliveryDuration && (
                                    <span className="px-3 py-1 bg-[#a3e635]/10 text-[#a3e635] border border-[#a3e635]/20 rounded-full text-[11px] font-bold">
                                        {deliveryDuration}
                                    </span>
                                )}
                            </div>

                            {/* Active Order Details & Live Progress */}
                            {activeLiveOrder && !trackingError ? (
                                <div className={`p-5 rounded-2xl border space-y-4 text-xs ${
                                    isDark ? 'bg-[#18191c] border-white/5' : 'bg-slate-50 border-slate-200'
                                }`}>
                                    <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3 border-current/10">
                                        <div>
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                                {activeLiveOrder.network} Bundle Order
                                            </span>
                                            <h4 className="text-base font-black text-[#a3e635]">
                                                {activeLiveOrder.data_amount} {activeLiveOrder.network}
                                            </h4>
                                            <p className="text-[11px] text-slate-400 mt-0.5">
                                                Recipient: <strong className="text-current font-mono">{activeLiveOrder.customer_phone}</strong> • Price: <strong className="text-[#a3e635]">GHS {(parseFloat(activeLiveOrder.selling_price_ghc as any) || 0).toFixed(2)}</strong>
                                            </p>
                                        </div>

                                        <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                                            (activeLiveOrder.fulfillment_status || '').toLowerCase() === 'completed' ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30' :
                                            (activeLiveOrder.fulfillment_status || '').toLowerCase() === 'refunded' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                                            (activeLiveOrder.fulfillment_status || '').toLowerCase() === 'failed' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                                            'bg-amber-400/20 text-amber-500 border border-amber-400/30 animate-pulse'
                                        }`}>
                                            {(activeLiveOrder.fulfillment_status || 'PROCESSING').toUpperCase() === 'REFUNDED' ? 'REFUNDED' : (activeLiveOrder.fulfillment_status || 'PROCESSING').toUpperCase()}
                                        </span>
                                    </div>

                                    {/* Detailed Live Order Lifecycle Stages */}
                                    <LiveTrackerLifecycle status={activeLiveOrder.fulfillment_status} isDark={isDark} />

                                    <div className="pt-2 border-t border-current/10 flex flex-wrap items-center justify-between text-[11px] text-slate-400 gap-2">
                                        <span>Order Reference: <strong className="font-mono text-current">{activeLiveOrder.id}</strong></span>
                                        <span>Placed at {new Date(activeLiveOrder.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                </div>
                            ) : (
                                /* No Active Order State */
                                <div className={`p-6 rounded-2xl border text-center space-y-3 ${
                                    isDark ? 'bg-[#18191c] border-white/5' : 'bg-slate-50 border-slate-200'
                                }`}>
                                    <Clock className="w-8 h-8 mx-auto text-slate-500 opacity-60" />
                                    <div>
                                        <p className="text-xs font-bold text-slate-400">No active orders found.</p>
                                        <p className="text-[11px] text-slate-500 mt-1">When you place an order, live tracking will automatically appear here.</p>
                                    </div>
                                    <button
                                        onClick={() => setActiveTab('purchase')}
                                        className="px-5 py-2 bg-[#a3e635] hover:bg-[#b5f73c] text-black font-extrabold rounded-xl text-xs inline-flex items-center gap-1.5 transition-all shadow-md"
                                    >
                                        <ShoppingCart className="w-3.5 h-3.5" />
                                        <span>Buy Data Now</span>
                                    </button>
                                </div>
                            )}

                            {/* Manual Lookup Form for optional reference tracking */}
                            <form onSubmit={handleTrackSubmit} className="pt-2 border-t border-current/10 space-y-2">
                                <span className="text-[11px] font-semibold text-slate-400 block">Look up another order manually:</span>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                                        <input
                                            type="text"
                                            value={homeTrackInput}
                                            onChange={(e) => setHomeTrackInput(e.target.value)}
                                            placeholder="Enter Order ID or Reference (e.g. BB-123456)"
                                            className={`w-full pl-10 pr-4 py-2 border rounded-xl text-xs font-mono focus:outline-none focus:border-[#a3e635] ${
                                                isDark ? 'bg-[#18191c] border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                                            }`}
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={trackingLoading || !homeTrackInput.trim()}
                                        className="px-4 py-2 bg-[#202227] hover:bg-[#2a2b30] text-white border border-white/10 font-bold rounded-xl text-xs transition-all flex items-center gap-1 shrink-0 disabled:opacity-50"
                                    >
                                        {trackingLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Search'}
                                    </button>
                                </div>

                                {trackingError && (
                                    <div className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-2 mt-2 ${
                                        isDark ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : 'bg-rose-50 border-rose-200 text-rose-700'
                                    }`}>
                                        <div className="flex items-center gap-1.5">
                                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                                            <span>{trackingError}</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setTrackingError(null);
                                                setHomeTrackInput('');
                                            }}
                                            className="px-2.5 py-1 bg-rose-500 text-white font-bold rounded-lg text-[10px] shrink-0"
                                        >
                                            Try Again
                                        </button>
                                    </div>
                                )}
                            </form>
                        </div>
                        )}

                        {/* CHOOSE YOUR NETWORK SECTION */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-black tracking-tight">Choose Your Network</h3>
                                    <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Select a network provider to explore available data bundles</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                              {loading ? (
                                <>{[1,2,3].map(i => <SkeletonNetworkCard key={i} isDark={isDark} />)}</>
                              ) : (
                              <>
                                {/* MTN Card — Full Yellow Background */}
                                <div
                                    onClick={() => {
                                        setSelectedNetwork('MTN');
                                        setActiveTab('purchase');
                                    }}
                                    className="p-6 rounded-3xl cursor-pointer transition-all duration-300 shadow-xl group relative overflow-hidden bg-amber-400 text-[#0f172a] hover:scale-[1.02] hover:shadow-amber-400/20"
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <span className="px-3 py-1 rounded-xl text-xs font-black bg-[#0f172a] text-amber-400 shadow-md">
                                            MTN
                                        </span>
                                        <span className="text-xs font-black bg-black/10 px-2.5 py-1 rounded-lg">
                                            {networkCounts.MTN} available
                                        </span>
                                    </div>
                                    <h4 className="text-xl font-black">MTN Ghana</h4>
                                    <p className="text-xs mt-1 font-medium text-[#0f172a]/80">High-speed 4G LTE internet data bundles.</p>
                                    <div className="mt-5 flex items-center text-xs font-black text-[#0f172a] gap-1">
                                        <span>View Bundles</span>
                                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                    </div>
                                </div>

                                {/* Telecel Card — Full Red Background */}
                                <div
                                    onClick={() => {
                                        setSelectedNetwork('TELECEL');
                                        setActiveTab('purchase');
                                    }}
                                    className="p-6 rounded-3xl cursor-pointer transition-all duration-300 shadow-xl group relative overflow-hidden bg-red-600 text-white hover:scale-[1.02] hover:shadow-red-600/20"
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <span className="px-3 py-1 rounded-xl text-xs font-black bg-white text-red-600 shadow-md">
                                            Telecel
                                        </span>
                                        <span className="text-xs font-black bg-black/20 px-2.5 py-1 rounded-lg">
                                            {networkCounts.TELECEL} available
                                        </span>
                                    </div>
                                    <h4 className="text-xl font-black">Telecel Ghana</h4>
                                    <p className="text-xs mt-1 font-medium text-white/90">Fast and reliable non-expiring data packages.</p>
                                    <div className="mt-5 flex items-center text-xs font-black text-white gap-1">
                                        <span>View Bundles</span>
                                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                    </div>
                                </div>

                                {/* AirtelTigo Card — Full Blue Background */}
                                <div
                                    onClick={() => {
                                        setSelectedNetwork('AIRTELTIGO');
                                        setActiveTab('purchase');
                                    }}
                                    className="p-6 rounded-3xl cursor-pointer transition-all duration-300 shadow-xl group relative overflow-hidden bg-blue-600 text-white hover:scale-[1.02] hover:shadow-blue-600/20"
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <span className="px-3 py-1 rounded-xl text-xs font-black bg-white text-blue-600 shadow-md">
                                            AirtelTigo
                                        </span>
                                        <span className="text-xs font-black bg-black/20 px-2.5 py-1 rounded-lg">
                                            {networkCounts.AIRTELTIGO} available
                                        </span>
                                    </div>
                                    <h4 className="text-xl font-black">AT Ghana</h4>
                                    <p className="text-xs mt-1 font-medium text-white/90">Affordable and instant data bundle delivery.</p>
                                    <div className="mt-5 flex items-center text-xs font-black text-white gap-1">
                                        <span>View Bundles</span>
                                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                    </div>
                                </div>
                              </>
                              )}
                            </div>
                        </div>

                        {/* POPULAR DATA BUNDLES SECTION — PRESERVED EXISTING CARD APPEARANCE (NOT Full Network Colors) */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-black tracking-tight flex items-center gap-2">
                                        <Flame className="w-5 h-5 text-amber-500" />
                                        Popular Data Bundles
                                    </h3>
                                    <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Featured active bundles from MTN, Telecel, and AirtelTigo</p>
                                </div>
                                <button
                                    onClick={() => setActiveTab('purchase')}
                                    className="text-xs font-bold text-[#a3e635] hover:underline flex items-center gap-1"
                                >
                                    View All Bundles →
                                </button>
                            </div>

                            {/* Popular Bundles Grid with Standard Card Appearance */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                              {loading ? (
                                <>{[1,2,3].map(i => <SkeletonPopularCard key={i} isDark={isDark} />)}</>
                              ) : (
                              <>
                                {/* MTN Popular Cards */}
                                {popularBundles.MTN.map(bundle => (
                                    <div key={bundle.bundle_id} className={`p-5 rounded-3xl border shadow-xl flex flex-col justify-between space-y-4 group ${
                                        isDark ? 'bg-[#202227] border-white/5 hover:border-amber-400/40' : 'bg-white border-slate-200 hover:border-amber-400'
                                    }`}>
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center">
                                                <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase bg-amber-400 text-black">
                                                    MTN
                                                </span>
                                                <span className="text-[10px] text-slate-400 font-medium">Popular Choice</span>
                                            </div>
                                            <h4 className="text-2xl font-black group-hover:text-amber-500 transition-colors">
                                                {bundle.data_amount}
                                            </h4>
                                        </div>

                                        <div className="pt-3 border-t border-current/10 flex items-center justify-between">
                                            <div>
                                                <span className="text-[10px] text-slate-400 block">Retail Price</span>
                                                <span className="text-lg font-black text-amber-500">
                                                    GHS {(parseFloat(bundle.agent_price_ghc as any) || 0).toFixed(2)}
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => handleBuyClick(bundle)}
                                                className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-black font-extrabold rounded-xl text-xs transition-all flex items-center gap-1"
                                            >
                                                Buy Data
                                                <ArrowRight className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                {/* Telecel Popular Cards */}
                                {popularBundles.TELECEL.map(bundle => (
                                    <div key={bundle.bundle_id} className={`p-5 rounded-3xl border shadow-xl flex flex-col justify-between space-y-4 group ${
                                        isDark ? 'bg-[#202227] border-white/5 hover:border-red-500/40' : 'bg-white border-slate-200 hover:border-red-500'
                                    }`}>
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center">
                                                <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase bg-red-600 text-white">
                                                    Telecel
                                                </span>
                                                <span className="text-[10px] text-slate-400 font-medium">Popular Choice</span>
                                            </div>
                                            <h4 className="text-2xl font-black group-hover:text-red-500 transition-colors">
                                                {bundle.data_amount}
                                            </h4>
                                        </div>

                                        <div className="pt-3 border-t border-current/10 flex items-center justify-between">
                                            <div>
                                                <span className="text-[10px] text-slate-400 block">Retail Price</span>
                                                <span className="text-lg font-black text-red-500">
                                                    GHS {(parseFloat(bundle.agent_price_ghc as any) || 0).toFixed(2)}
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => handleBuyClick(bundle)}
                                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-extrabold rounded-xl text-xs transition-all flex items-center gap-1"
                                            >
                                                Buy Data
                                                <ArrowRight className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                {/* AirtelTigo Popular Cards */}
                                {popularBundles.AIRTELTIGO.map(bundle => (
                                    <div key={bundle.bundle_id} className={`p-5 rounded-3xl border shadow-xl flex flex-col justify-between space-y-4 group ${
                                        isDark ? 'bg-[#202227] border-white/5 hover:border-blue-500/40' : 'bg-white border-slate-200 hover:border-blue-500'
                                    }`}>
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center">
                                                <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase bg-blue-600 text-white">
                                                    AirtelTigo
                                                </span>
                                                <span className="text-[10px] text-slate-400 font-medium">Popular Choice</span>
                                            </div>
                                            <h4 className="text-2xl font-black group-hover:text-blue-500 transition-colors">
                                                {bundle.data_amount}
                                            </h4>
                                        </div>

                                        <div className="pt-3 border-t border-current/10 flex items-center justify-between">
                                            <div>
                                                <span className="text-[10px] text-slate-400 block">Retail Price</span>
                                                <span className="text-lg font-black text-blue-500">
                                                    GHS {(parseFloat(bundle.agent_price_ghc as any) || 0).toFixed(2)}
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => handleBuyClick(bundle)}
                                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl text-xs transition-all flex items-center gap-1"
                                            >
                                                Buy Data
                                                <ArrowRight className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                              </>
                              )}
                            </div>
                        </div>

                        {/* Store Service Highlights */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className={`p-5 rounded-2xl border space-y-2 ${
                                isDark ? 'bg-[#202227] border-white/5' : 'bg-white border-slate-200 shadow-sm'
                            }`}>
                                <Zap className="w-6 h-6 text-[#a3e635] stroke-[2.5]" />
                                <h4 className="text-xs font-bold">Instant Fulfillment</h4>
                                <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Data bundles are dispatched automatically to your recipient number.</p>
                            </div>
                            <div className={`p-5 rounded-2xl border space-y-2 ${
                                isDark ? 'bg-[#202227] border-white/5' : 'bg-white border-slate-200 shadow-sm'
                            }`}>
                                <ShieldCheck className="w-6 h-6 text-emerald-500 stroke-[2.5]" />
                                <h4 className="text-xs font-bold">Secure Checkout</h4>
                                <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Transactions are encrypted and processed securely via Paystack.</p>
                            </div>
                            <div className={`p-5 rounded-2xl border space-y-2 ${
                                isDark ? 'bg-[#202227] border-white/5' : 'bg-white border-slate-200 shadow-sm'
                            }`}>
                                <Phone className="w-6 h-6 text-sky-500 stroke-[2.5]" />
                                <h4 className="text-xs font-bold">Support Availability</h4>
                                <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Need help? Contact our store administrator directly for assistance.</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. BUY DATA TAB */}
                {activeTab === 'purchase' && (
                    <div className="space-y-6 w-full min-w-0 max-w-full">
                        {/* Network Chips with Network Branding & Responsive Touch Scroll */}
                        <div className="w-full max-w-full min-w-0 flex items-center justify-start sm:justify-center gap-2 overflow-x-auto flex-nowrap pb-2 pt-1 scrollbar-none">
                            {['ALL', 'MTN', 'TELECEL', 'AIRTELTIGO'].map(net => {
                                const isSelected = selectedNetwork === net;
                                const netTheme = getNetworkTheme(net);
                                let colorClass = isDark ? 'bg-[#202227] text-slate-400 border-white/5' : 'bg-white text-slate-600 border-slate-200';
                                
                                if (isSelected) {
                                    if (net === 'ALL') colorClass = 'bg-[#a3e635] text-black font-black border-[#a3e635] shadow-lg shadow-[#a3e635]/20';
                                    else colorClass = netTheme.chipActive;
                                }

                                return (
                                    <button
                                        key={net}
                                        onClick={() => setSelectedNetwork(net)}
                                        className={`px-4 sm:px-5 py-2.5 rounded-xl text-xs font-bold transition-all uppercase border shrink-0 whitespace-nowrap ${colorClass}`}
                                    >
                                        {net === 'ALL' ? 'All Networks' : net}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Product Grid — FULL NETWORK-SPECIFIC CARD COLORS */}
                        {loading ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                                {[1,2,3,4,5,6].map(i => <SkeletonBuyDataCard key={i} isDark={isDark} />)}
                            </div>
                        ) : filteredProducts.length === 0 ? (
                            <div className={`p-12 rounded-3xl border text-center text-xs ${
                                isDark ? 'bg-[#202227] border-white/5 text-slate-400' : 'bg-white border-slate-200 text-slate-600'
                            }`}>
                                No active data bundles found for this category.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                                {filteredProducts.map(bundle => {
                                    const netTheme = getNetworkTheme(bundle.network);
                                    return (
                                        <div
                                            key={bundle.bundle_id}
                                            className={`p-6 rounded-3xl border ${netTheme.bg} shadow-xl transition-transform hover:scale-[1.02] flex flex-col justify-between space-y-4 group`}
                                        >
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center">
                                                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase ${netTheme.badge}`}>
                                                        {bundle.network}
                                                    </span>
                                                    <span className="text-[10px] font-semibold opacity-80">Instant Delivery</span>
                                                </div>
                                                <h3 className="text-2xl font-black">
                                                    {bundle.data_amount}
                                                </h3>
                                            </div>

                                            <div className="pt-4 border-t border-current/20 flex items-center justify-between">
                                                <div>
                                                    <span className="text-[10px] opacity-80 block">Retail Price</span>
                                                    <span className="text-xl font-black">
                                                        GHS {(parseFloat(bundle.agent_price_ghc as any) || 0).toFixed(2)}
                                                    </span>
                                                </div>

                                                <button
                                                    onClick={() => handleBuyClick(bundle)}
                                                    className={`px-5 py-2.5 font-extrabold rounded-xl text-xs shadow-md transition-all flex items-center gap-1.5 ${netTheme.button}`}
                                                >
                                                    Buy Data
                                                    <ArrowRight className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* 3. TRACK ORDER TAB */}
                {activeTab === 'track' && (
                    <div className="max-w-xl mx-auto space-y-6">
                        <div className={`p-6 sm:p-8 rounded-3xl border space-y-6 shadow-xl ${
                            isDark ? 'bg-[#202227] border-white/5' : 'bg-white border-slate-200'
                        }`}>
                            <div>
                                <h2 className="text-xl font-black flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-[#a3e635] stroke-[2.5]" />
                                    Track Order Status
                                </h2>
                                <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                                    Enter your Order ID, reference, or recipient phone number to check live status.
                                </p>
                            </div>

                            <form onSubmit={handleTrackSubmit} className="space-y-4">
                                <div className="space-y-1">
                                    <label className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Order Reference ID *</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={homeTrackInput}
                                            onChange={(e) => setHomeTrackInput(e.target.value)}
                                            placeholder="e.g. BB-123456 or Paystack Ref"
                                            required
                                            className={`w-full pl-4 pr-24 py-3 border rounded-xl text-sm font-mono focus:outline-none focus:border-[#a3e635] ${
                                                isDark ? 'bg-[#18191c] border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                                            }`}
                                        />
                                        <button
                                            type="submit"
                                            disabled={trackingLoading || !homeTrackInput.trim()}
                                            className="absolute right-1.5 top-1/2 -translate-y-1/2 px-4 py-2 bg-[#a3e635] hover:bg-[#b5f73c] text-black font-extrabold rounded-lg text-xs transition-all disabled:opacity-50"
                                        >
                                            {trackingLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Track Order'}
                                        </button>
                                    </div>
                                </div>
                            </form>

                            {trackingError && (
                                <div className={`p-4 rounded-2xl border text-xs flex items-center justify-between gap-3 ${
                                    isDark ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : 'bg-rose-50 border-rose-200 text-rose-700'
                                }`}>
                                    <div className="flex items-center gap-2">
                                        <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                                        <span>{trackingError}</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setTrackingError(null);
                                            setHomeTrackInput('');
                                        }}
                                        className="px-3 py-1 bg-rose-500 text-white font-bold rounded-lg text-[11px] shrink-0"
                                    >
                                        Try Again
                                    </button>
                                </div>
                            )}

                            {trackedOrder && (
                                <div className={`p-5 rounded-2xl border space-y-4 text-xs ${
                                    isDark ? 'bg-[#18191c] border-white/10' : 'bg-slate-50 border-slate-200'
                                }`}>
                                    <div className="flex justify-between items-center border-b pb-2 border-current/10">
                                        <span className="text-slate-400">Status</span>
                                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                                            (trackedOrder.fulfillment_status || '').toLowerCase() === 'completed' ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30' :
                                            (trackedOrder.fulfillment_status || '').toLowerCase() === 'refunded' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                                            (trackedOrder.fulfillment_status || '').toLowerCase() === 'failed' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                                            'bg-amber-400/20 text-amber-500 border border-amber-400/30 animate-pulse'
                                        }`}>
                                            {(trackedOrder.fulfillment_status || 'PROCESSING').toUpperCase() === 'REFUNDED' ? 'REFUNDED' : (trackedOrder.fulfillment_status || 'PROCESSING').toUpperCase()}
                                        </span>
                                    </div>

                                    {/* Detailed Delivery Lifecycle */}
                                    <LiveTrackerLifecycle status={trackedOrder.fulfillment_status} isDark={isDark} />

                                    <div className="space-y-2 border-t pt-3 border-current/10">
                                        <div className="flex justify-between">
                                            <span className="text-slate-400">Order ID:</span>
                                            <span className="font-mono font-bold">{trackedOrder.id}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-400">Network:</span>
                                            <span className="font-bold">{trackedOrder.network}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-400">Bundle Package:</span>
                                            <span className="font-bold">{trackedOrder.data_amount}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-400">Recipient Phone:</span>
                                            <span className="font-mono">{trackedOrder.customer_phone}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-400">Amount Paid:</span>
                                            <span className="text-[#a3e635] font-extrabold">GHS {(parseFloat(trackedOrder.selling_price_ghc as any) || 0).toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-400">Date & Time:</span>
                                            <span className="text-slate-400">{new Date(trackedOrder.created_at).toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* 4. INFO TAB */}
                {activeTab === 'info' && (
                    <div className="max-w-xl mx-auto space-y-6">
                        <div className={`p-6 sm:p-8 rounded-3xl border space-y-6 shadow-xl ${
                            isDark ? 'bg-[#202227] border-white/5' : 'bg-white border-slate-200'
                        }`}>
                            <div>
                                <h2 className="text-xl font-black flex items-center gap-2">
                                    <Info className="w-5 h-5 text-[#a3e635] stroke-[2.5]" />
                                    Store Information
                                </h2>
                                <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                                    Public store identity and customer service contact details.
                                </p>
                            </div>

                            <div className="space-y-4 text-xs">
                              {loading ? (
                                <>{[1,2,3,4].map(i => <SkeletonInfoBlock key={i} isDark={isDark} />)}</>
                              ) : (
                              <>
                                <div className={`p-4 rounded-2xl border space-y-1 ${isDark ? 'bg-[#18191c] border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Store Name</span>
                                    <p className="text-sm font-black">{storeInfo?.store_name}</p>
                                </div>

                                {storeInfo?.description && (
                                    <div className={`p-4 rounded-2xl border space-y-1 ${isDark ? 'bg-[#18191c] border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">About Store Owner</span>
                                        <p className="leading-relaxed">{storeInfo.description}</p>
                                    </div>
                                )}

                                <div className={`p-4 rounded-2xl border space-y-1 ${isDark ? 'bg-[#18191c] border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Service Overview</span>
                                    <p className="leading-relaxed">{GENERIC_HERO_DESCRIPTION}</p>
                                </div>

                                {storeInfo?.phone && (
                                    <div className={`p-4 rounded-2xl border space-y-1 ${isDark ? 'bg-[#18191c] border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Customer Support Phone</span>
                                        <p className="text-sm font-bold text-[#a3e635]">{storeInfo.phone}</p>
                                    </div>
                                )}

                                <div className={`p-4 rounded-2xl border space-y-1 ${isDark ? 'bg-[#18191c] border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Fulfillment Guarantee</span>
                                    <p className="text-slate-400">All data bundles are fulfilled automatically 24/7. In the event of a network error, transactions are automatically queued for retry or refunded.</p>
                                </div>
                              </>
                              )}
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {/* Branded Store Footer */}
            <footer className={`border-t py-8 px-4 sm:px-6 text-center text-xs space-y-4 mt-auto ${
                isDark ? 'border-white/5 bg-[#18191c] text-slate-400' : 'border-slate-200 bg-white text-slate-600'
            }`}>
                <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-center sm:text-left space-y-1">
                        <p className="font-black text-sm">{storeInfo?.store_name || 'Storefront'}</p>
                        <p className="text-[11px] text-slate-400 max-w-sm">{GENERIC_HERO_DESCRIPTION}</p>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-4">
                        {whatsAppUrl && (
                            <a
                                href={whatsAppUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-black font-extrabold rounded-xl text-xs flex items-center gap-2 shadow-md transition-all"
                            >
                                <MessageCircle className="w-4 h-4 stroke-[2.5]" />
                                <span>WhatsApp Us</span>
                            </a>
                        )}
                        <button
                            onClick={() => setActiveTab('track')}
                            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                                isDark ? 'text-slate-300 hover:bg-white/5' : 'text-slate-700 hover:bg-slate-100'
                            }`}
                        >
                            Track Order
                        </button>
                        <button
                            onClick={() => setActiveTab('info')}
                            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                                isDark ? 'text-slate-300 hover:bg-white/5' : 'text-slate-700 hover:bg-slate-100'
                            }`}
                        >
                            Store Info
                        </button>
                    </div>
                </div>

                <div className="pt-4 border-t border-current/10 text-[11px] text-slate-400 flex flex-col sm:flex-row items-center justify-between max-w-5xl mx-auto gap-2">
                    <p>© {new Date().getFullYear()} {storeInfo?.store_name || 'Storefront'}. All rights reserved.</p>
                </div>
            </footer>

            {/* Purchase Modal */}
            {selectedBundle && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className={`border rounded-3xl p-6 max-w-md w-full space-y-6 shadow-2xl ${
                        isDark ? 'bg-[#202227] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
                    }`}>
                        <div className="flex justify-between items-center border-b pb-3 border-current/10">
                            <div>
                                <h3 className="font-bold text-lg">Purchase Data Package</h3>
                                <p className={`text-xs font-bold ${
                                    selectedBundle.network === 'MTN' ? 'text-amber-500' :
                                    selectedBundle.network === 'TELECEL' || selectedBundle.network === 'VODA' ? 'text-red-500' :
                                    'text-blue-500'
                                }`}>{selectedBundle.network} {selectedBundle.data_amount}</p>
                            </div>
                            <button onClick={() => setSelectedBundle(null)} className="text-slate-400 hover:text-current text-xl">✕</button>
                        </div>

                        <form onSubmit={handleProceedToPayment} className="space-y-4">
                            <div className="space-y-1">
                                <label className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Recipient Phone Number *</label>
                                <input
                                    type="tel"
                                    value={customerPhone}
                                    onChange={(e) => setCustomerPhone(e.target.value)}
                                    placeholder="e.g. 0241234567"
                                    required
                                    className={`w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:border-[#a3e635] ${
                                        isDark ? 'bg-[#18191c] border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                                    }`}
                                />
                                <p className="text-[10px] text-slate-400">Data bundle will be delivered directly to this recipient number.</p>
                            </div>

                            <div className={`p-4 rounded-2xl border space-y-2 text-xs ${
                                isDark ? 'bg-[#18191c] border-white/5' : 'bg-slate-50 border-slate-200'
                            }`}>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Package Amount:</span>
                                    <span className="font-bold">{selectedBundle.data_amount}</span>
                                </div>
                                <div className="flex justify-between border-t pt-2 border-current/10">
                                    <span className="text-slate-400">Total Price:</span>
                                    <span className="text-[#a3e635] font-extrabold text-sm">GHS {(parseFloat(selectedBundle.agent_price_ghc as any) || 0).toFixed(2)}</span>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isInitializing}
                                className="w-full py-3.5 bg-[#a3e635] hover:bg-[#b5f73c] text-black font-extrabold rounded-xl shadow-lg shadow-[#a3e635]/20 text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isInitializing ? 'Connecting Paystack...' : 'Pay via Paystack'}
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
