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
    Search,
    Home,
    FileText,
    Info,
    CheckCircle,
    XCircle,
    RotateCcw,
    Sun,
    Moon,
    MessageCircle,
    Check,
    Flame
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

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

// Delivery Progress UI Component
const DeliveryProgress = ({ status, isDark }: { status: string; isDark: boolean }) => {
    const s = (status || '').toLowerCase();

    const isProcessingDone = s === 'completed' || s === 'delivered' || s === 'processing' || s === 'refunded';
    const isDeliveryDone = s === 'completed' || s === 'delivered';
    const isFailed = s === 'failed';
    const isRefunded = s === 'refunded';

    return (
        <div className="py-3 px-2">
            <div className="flex items-center justify-between relative max-w-sm mx-auto">
                {/* Connecting Line */}
                <div className={`absolute top-3.5 left-4 right-4 h-0.5 -translate-y-1/2 -z-0 ${
                    isDark ? 'bg-white/10' : 'bg-slate-200'
                }`} />

                {/* Step 1: Payment */}
                <div className="flex flex-col items-center gap-1 z-10">
                    <div className="w-7 h-7 rounded-full bg-emerald-500 text-black flex items-center justify-center font-black text-xs shadow-md">
                        ✓
                    </div>
                    <span className="text-[10px] font-bold text-emerald-500">Payment</span>
                </div>

                {/* Step 2: Processing */}
                <div className="flex flex-col items-center gap-1 z-10">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs shadow-md ${
                        isProcessingDone
                            ? 'bg-emerald-500 text-black'
                            : isFailed
                            ? 'bg-rose-500 text-white'
                            : 'bg-amber-400 text-black animate-pulse'
                    }`}>
                        {isProcessingDone ? '✓' : isFailed ? '✕' : '●'}
                    </div>
                    <span className={`text-[10px] font-bold ${
                        isProcessingDone ? 'text-emerald-500' : isFailed ? 'text-rose-500' : 'text-amber-500'
                    }`}>Processing</span>
                </div>

                {/* Step 3: Delivery */}
                <div className="flex flex-col items-center gap-1 z-10">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs shadow-md ${
                        isDeliveryDone
                            ? 'bg-emerald-500 text-black'
                            : isRefunded
                            ? 'bg-purple-500 text-white'
                            : isFailed
                            ? 'bg-rose-500 text-white'
                            : 'bg-amber-400 text-black animate-pulse'
                    }`}>
                        {isDeliveryDone ? '✓' : isRefunded ? '↩' : isFailed ? '✕' : '●'}
                    </div>
                    <span className={`text-[10px] font-bold ${
                        isDeliveryDone ? 'text-emerald-500' : isRefunded ? 'text-purple-400' : isFailed ? 'text-rose-500' : 'text-amber-500'
                    }`}>Delivery</span>
                </div>

                {/* Step 4: Delivered */}
                <div className="flex flex-col items-center gap-1 z-10">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs shadow-md ${
                        isDeliveryDone
                            ? 'bg-emerald-500 text-black'
                            : isRefunded
                            ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40'
                            : isFailed
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                            : isDark ? 'bg-[#18191c] text-slate-500 border border-white/10' : 'bg-slate-100 text-slate-400 border border-slate-300'
                    }`}>
                        {isDeliveryDone ? '✓' : isRefunded ? '↩' : isFailed ? '✕' : '○'}
                    </div>
                    <span className={`text-[10px] font-bold ${
                        isDeliveryDone ? 'text-emerald-500' : isRefunded ? 'text-purple-400' : isFailed ? 'text-rose-500' : 'text-slate-400'
                    }`}>{isRefunded ? 'Refunded' : isFailed ? 'Failed' : 'Delivered'}</span>
                </div>
            </div>
        </div>
    );
};

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

    // Purchase Modal states
    const [selectedBundle, setSelectedBundle] = useState<AgentProduct | null>(null);
    const [customerPhone, setCustomerPhone] = useState('');
    const [isInitializing, setIsInitializing] = useState(false);

    // Order Verification states
    const [verifying, setVerifying] = useState(false);
    const [verificationResult, setVerificationResult] = useState<{ status: string; message: string; order_id: string } | null>(null);

    // Order Tracking state
    const [trackOrderId, setTrackOrderId] = useState('');
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

    useEffect(() => {
        if (storeInfo?.store_name) {
            document.title = `${storeInfo.store_name} - Data Storefront`;
        }
    }, [storeInfo]);

    // Handle payment callback verification if reference in URL
    useEffect(() => {
        if (referenceFromUrl && !verifying && !verificationResult) {
            verifyPayment(referenceFromUrl);
        }
    }, [referenceFromUrl]);

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
                // Automatically fetch tracked order details to show on Home & Track tab
                try {
                    const orderRes = await agentStoreService.trackPublicOrder(res.order_id);
                    if (orderRes.success && orderRes.order) {
                        setRecentOrder(orderRes.order);
                        setTrackedOrder(orderRes.order);
                        localStorage.setItem(`store_last_order_${slug}`, JSON.stringify(orderRes.order));
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

    const handleTrackOrder = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!trackOrderId.trim()) return;

        setTrackingLoading(true);
        setTrackingError(null);
        setTrackedOrder(null);

        try {
            const res = await agentStoreService.trackPublicOrder(trackOrderId.trim());
            if (res.success && res.order) {
                setTrackedOrder(res.order);
                setRecentOrder(res.order);
                if (slug) {
                    localStorage.setItem(`store_last_order_${slug}`, JSON.stringify(res.order));
                }
            } else {
                setTrackingError('Order not found. Please check your Order ID or reference.');
            }
        } catch (err: any) {
            setTrackingError(err.message || 'Order not found. Please check your Order ID.');
        } finally {
            setTrackingLoading(false);
        }
    };

    // Calculate available networks and bundle counts from active products
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

    // Popular Bundles: exactly 3 bundles per network (max 9 total)
    const popularBundles = useMemo(() => {
        const getTop3 = (netKey: string) => {
            return products
                .filter(p => {
                    const n = (p.network || '').toUpperCase();
                    if (netKey === 'MTN') return n === 'MTN';
                    if (netKey === 'TELECEL') return n === 'TELECEL' || n === 'VODA';
                    if (netKey === 'AIRTELTIGO') return n === 'AIRTELTIGO' || n === 'AT';
                    return false;
                })
                .sort((a, b) => (parseFloat(a.agent_price_ghc as any) || 0) - (parseFloat(b.agent_price_ghc as any) || 0))
                .slice(0, 3);
        };

        return {
            MTN: getTop3('MTN'),
            TELECEL: getTop3('TELECEL'),
            AIRTELTIGO: getTop3('AIRTELTIGO')
        };
    }, [products]);

    const availableNetworks = Array.from(new Set(products.map(p => p.network)));

    if (loading) {
        return (
            <div className={`min-h-screen font-sans flex items-center justify-center p-4 ${
                isDark ? 'bg-[#141518] text-white' : 'bg-slate-50 text-slate-900'
            }`}>
                <div className="text-center space-y-3">
                    <RefreshCw className="w-8 h-8 animate-spin text-[#a3e635] mx-auto" />
                    <p className={`text-xs font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Loading Storefront...</p>
                </div>
            </div>
        );
    }

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

    const filteredProducts = products.filter(p => selectedNetwork === 'ALL' || p.network === selectedNetwork);

    const whatsAppUrl = formatWhatsAppUrl(storeInfo?.phone);

    return (
        <div className={`min-h-screen font-sans selection:bg-[#a3e635] selection:text-black flex flex-col transition-colors duration-200 ${
            isDark ? 'bg-[#141518] text-white' : 'bg-slate-50 text-slate-900'
        }`}>
            {/* Top Store Header */}
            <header className={`border-b py-5 px-4 sm:px-6 shadow-xl relative ${
                isDark ? 'bg-[#202227] border-white/5' : 'bg-white border-slate-200'
            }`}>
                <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4 text-center sm:text-left">
                        {storeInfo?.logo_url ? (
                            <img src={storeInfo.logo_url} alt={storeInfo.store_name} className={`w-14 h-14 rounded-2xl object-cover border ${
                                isDark ? 'border-white/10' : 'border-slate-200'
                            }`} />
                        ) : (
                            <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center ${
                                isDark ? 'bg-[#a3e635]/10 border-[#a3e635]/30 text-[#a3e635]' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600'
                            }`}>
                                <StoreIcon className="w-7 h-7" />
                            </div>
                        )}
                        <div>
                            <h1 className={`text-xl sm:text-2xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>{storeInfo?.store_name}</h1>
                            <p className={`text-xs max-w-md ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{storeInfo?.description || 'Instant Automated Data Bundles'}</p>
                        </div>
                    </div>

                    {/* Right side controls: Security badge + Theme Switcher */}
                    <div className="flex items-center gap-3">
                        <div className={`px-3.5 py-1.5 rounded-xl border text-[11px] flex items-center gap-2 ${
                            isDark ? 'bg-[#18191c] border-white/5 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'
                        }`}>
                            <ShieldCheck className={`w-4 h-4 ${isDark ? 'text-[#a3e635]' : 'text-emerald-600'}`} />
                            <span className="font-medium">Instant & Secure</span>
                        </div>

                        {/* Theme Switcher Toggle */}
                        <button
                            onClick={toggleTheme}
                            aria-label="Toggle Theme"
                            className={`p-2.5 rounded-xl border transition-all flex items-center gap-1.5 text-xs font-bold ${
                                isDark
                                    ? 'bg-[#18191c] border-white/10 text-amber-300 hover:bg-white/10'
                                    : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                            }`}
                        >
                            {isDark ? <Sun className="w-4 h-4 stroke-[2.5]" /> : <Moon className="w-4 h-4 stroke-[2.5]" />}
                            <span className="hidden sm:inline">{isDark ? 'Light' : 'Dark'}</span>
                        </button>
                    </div>
                </div>

                {/* Minimalist Navigation Bar */}
                <div className={`max-w-5xl mx-auto mt-5 pt-4 border-t flex items-center justify-center sm:justify-start gap-2 overflow-x-auto ${
                    isDark ? 'border-white/5' : 'border-slate-200'
                }`}>
                    {[
                        { id: 'home', label: 'Home', icon: Home },
                        { id: 'purchase', label: 'Buy Data', icon: ShoppingCart },
                        { id: 'track', label: 'Track Data', icon: FileText },
                        { id: 'info', label: 'Info', icon: Info },
                    ].map(tab => {
                        const Icon = tab.icon;
                        const active = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 ${
                                    active
                                        ? 'bg-[#a3e635] text-black shadow-md shadow-[#a3e635]/20 font-black'
                                        : isDark
                                        ? 'text-slate-400 hover:text-white hover:bg-white/5'
                                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                                }`}
                            >
                                <Icon className="w-4 h-4 stroke-[2.5]" />
                                <span>{tab.label}</span>
                            </button>
                        );
                    })}
                </div>
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
            <main className="max-w-5xl mx-auto py-8 px-4 sm:px-6 flex-1 w-full space-y-8">
                {/* 1. HOME TAB */}
                {activeTab === 'home' && (
                    <div className="space-y-8">
                        {/* Store Hero Banner */}
                        <div className={`p-8 sm:p-10 rounded-3xl border text-center space-y-5 shadow-2xl relative overflow-hidden ${
                            isDark ? 'bg-[#202227] border-white/5' : 'bg-white border-slate-200'
                        }`}>
                            <div className={`w-16 h-16 rounded-2xl border flex items-center justify-center mx-auto ${
                                isDark ? 'bg-[#a3e635]/10 border-[#a3e635]/30 text-[#a3e635]' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600'
                            }`}>
                                <Zap className="w-8 h-8 stroke-[2.5]" />
                            </div>
                            <div className="space-y-2 max-w-lg mx-auto">
                                <h2 className={`text-2xl sm:text-3xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{storeInfo?.store_name}</h2>
                                <p className={`text-xs sm:text-sm leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                                    {storeInfo?.description || 'Fast, reliable, and instant telecommunications data bundle reseller storefront.'}
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                                <button
                                    onClick={() => setActiveTab('purchase')}
                                    className="px-6 py-3.5 bg-[#a3e635] hover:bg-[#b5f73c] text-black font-extrabold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-[#a3e635]/20 transition-all"
                                >
                                    <ShoppingCart className="w-4 h-4 stroke-[2.5]" />
                                    <span>Buy Data</span>
                                </button>
                                <button
                                    onClick={() => setActiveTab('track')}
                                    className={`px-6 py-3.5 font-bold rounded-xl text-xs border flex items-center gap-2 transition-all ${
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

                        {/* Recent / Active Order & Progress Tracking on Home Page */}
                        {recentOrder && (
                            <div className={`p-6 rounded-3xl border space-y-4 shadow-xl ${
                                isDark ? 'bg-[#202227] border-white/10' : 'bg-white border-slate-200'
                            }`}>
                                <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3 border-current/10">
                                    <div>
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                            {(recentOrder.fulfillment_status || '').toLowerCase() === 'completed' ? 'Last Delivered Order' : 'Current Order'}
                                        </span>
                                        <h3 className="text-base font-black">
                                            {recentOrder.network} {recentOrder.data_amount}
                                        </h3>
                                    </div>
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                                        (recentOrder.fulfillment_status || '').toLowerCase() === 'completed' ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30' :
                                        (recentOrder.fulfillment_status || '').toLowerCase() === 'refunded' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                                        (recentOrder.fulfillment_status || '').toLowerCase() === 'failed' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                                        'bg-amber-400/20 text-amber-500 border border-amber-400/30 animate-pulse'
                                    }`}>
                                        {(recentOrder.fulfillment_status || 'PROCESSING').toUpperCase()}
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                    <div className={`p-3 rounded-2xl ${isDark ? 'bg-[#18191c]' : 'bg-slate-50'}`}>
                                        <span className="text-[10px] text-slate-400 block">Recipient</span>
                                        <span className="font-mono font-bold">{recentOrder.customer_phone}</span>
                                    </div>
                                    <div className={`p-3 rounded-2xl ${isDark ? 'bg-[#18191c]' : 'bg-slate-50'}`}>
                                        <span className="text-[10px] text-slate-400 block">Amount</span>
                                        <span className="font-bold text-[#a3e635]">GHS {(parseFloat(recentOrder.selling_price_ghc as any) || 0).toFixed(2)}</span>
                                    </div>
                                    <div className={`p-3 rounded-2xl ${isDark ? 'bg-[#18191c]' : 'bg-slate-50'}`}>
                                        <span className="text-[10px] text-slate-400 block">Order ID</span>
                                        <span className="font-mono text-[11px] truncate block">{recentOrder.id.slice(0, 12)}...</span>
                                    </div>
                                    <div className={`p-3 rounded-2xl ${isDark ? 'bg-[#18191c]' : 'bg-slate-50'}`}>
                                        <span className="text-[10px] text-slate-400 block">Date</span>
                                        <span className="text-[11px]">{new Date(recentOrder.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                </div>

                                {/* Delivery Progress Indicator */}
                                <DeliveryProgress status={recentOrder.fulfillment_status} isDark={isDark} />
                            </div>
                        )}

                        {/* SECTION 10: CHOOSE YOUR NETWORK */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-black tracking-tight">Choose Your Network</h3>
                                    <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Select a telecommunications provider to view available bundles</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                {/* MTN Card */}
                                <div
                                    onClick={() => {
                                        setSelectedNetwork('MTN');
                                        setActiveTab('purchase');
                                    }}
                                    className={`p-6 rounded-3xl border cursor-pointer transition-all duration-300 shadow-lg group relative overflow-hidden ${
                                        selectedNetwork === 'MTN'
                                            ? 'bg-amber-400/10 border-amber-400 ring-2 ring-amber-400/40'
                                            : isDark
                                            ? 'bg-[#202227] border-white/5 hover:border-amber-400/40 hover:bg-amber-400/5'
                                            : 'bg-white border-slate-200 hover:border-amber-400 hover:bg-amber-50'
                                    }`}
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <span className="px-3 py-1 rounded-xl text-xs font-black bg-amber-400 text-black shadow-md">
                                            MTN
                                        </span>
                                        <span className="text-xs font-bold text-amber-500">
                                            {networkCounts.MTN} Bundles
                                        </span>
                                    </div>
                                    <h4 className="text-xl font-extrabold group-hover:text-amber-500 transition-colors">MTN Ghana</h4>
                                    <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>High-speed 4G LTE internet data bundles.</p>
                                    <div className="mt-4 flex items-center text-xs font-bold text-amber-500 gap-1">
                                        <span>Browse MTN</span>
                                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                                    </div>
                                </div>

                                {/* Telecel Card */}
                                <div
                                    onClick={() => {
                                        setSelectedNetwork('TELECEL');
                                        setActiveTab('purchase');
                                    }}
                                    className={`p-6 rounded-3xl border cursor-pointer transition-all duration-300 shadow-lg group relative overflow-hidden ${
                                        selectedNetwork === 'TELECEL'
                                            ? 'bg-rose-500/10 border-rose-500 ring-2 ring-rose-500/40'
                                            : isDark
                                            ? 'bg-[#202227] border-white/5 hover:border-rose-500/40 hover:bg-rose-500/5'
                                            : 'bg-white border-slate-200 hover:border-rose-500 hover:bg-rose-50'
                                    }`}
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <span className="px-3 py-1 rounded-xl text-xs font-black bg-rose-500 text-white shadow-md">
                                            Telecel
                                        </span>
                                        <span className="text-xs font-bold text-rose-500">
                                            {networkCounts.TELECEL} Bundles
                                        </span>
                                    </div>
                                    <h4 className="text-xl font-extrabold group-hover:text-rose-500 transition-colors">Telecel Ghana</h4>
                                    <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Fast and reliable non-expiring data packages.</p>
                                    <div className="mt-4 flex items-center text-xs font-bold text-rose-500 gap-1">
                                        <span>Browse Telecel</span>
                                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                                    </div>
                                </div>

                                {/* AirtelTigo Card */}
                                <div
                                    onClick={() => {
                                        setSelectedNetwork('AIRTELTIGO');
                                        setActiveTab('purchase');
                                    }}
                                    className={`p-6 rounded-3xl border cursor-pointer transition-all duration-300 shadow-lg group relative overflow-hidden ${
                                        selectedNetwork === 'AIRTELTIGO'
                                            ? 'bg-blue-500/10 border-blue-500 ring-2 ring-blue-500/40'
                                            : isDark
                                            ? 'bg-[#202227] border-white/5 hover:border-blue-500/40 hover:bg-blue-500/5'
                                            : 'bg-white border-slate-200 hover:border-blue-500 hover:bg-blue-50'
                                    }`}
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <span className="px-3 py-1 rounded-xl text-xs font-black bg-blue-500 text-white shadow-md">
                                            AirtelTigo
                                        </span>
                                        <span className="text-xs font-bold text-blue-500">
                                            {networkCounts.AIRTELTIGO} Bundles
                                        </span>
                                    </div>
                                    <h4 className="text-xl font-extrabold group-hover:text-blue-500 transition-colors">AT Ghana</h4>
                                    <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Affordable and instant data bundle delivery.</p>
                                    <div className="mt-4 flex items-center text-xs font-bold text-blue-500 gap-1">
                                        <span>Browse AirtelTigo</span>
                                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* SECTION 15 & 16: POPULAR DATA BUNDLES (Exactly 3 per network) */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-black tracking-tight flex items-center gap-2">
                                        <Flame className="w-5 h-5 text-amber-500" />
                                        Popular Data Bundles
                                    </h3>
                                    <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Featured bundles from MTN, Telecel, and AirtelTigo</p>
                                </div>
                            </div>

                            {/* Popular Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                                {/* MTN Popular */}
                                {popularBundles.MTN.map(bundle => (
                                    <div key={bundle.bundle_id} className={`p-5 rounded-3xl border shadow-xl flex flex-col justify-between space-y-4 group ${
                                        isDark ? 'bg-[#202227] border-white/5 hover:border-amber-400/40' : 'bg-white border-slate-200 hover:border-amber-400'
                                    }`}>
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center">
                                                <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase bg-amber-400 text-black">
                                                    MTN
                                                </span>
                                                <span className="text-[10px] text-slate-400">Popular</span>
                                            </div>
                                            <h4 className="text-2xl font-black group-hover:text-amber-400 transition-colors">
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

                                {/* Telecel Popular */}
                                {popularBundles.TELECEL.map(bundle => (
                                    <div key={bundle.bundle_id} className={`p-5 rounded-3xl border shadow-xl flex flex-col justify-between space-y-4 group ${
                                        isDark ? 'bg-[#202227] border-white/5 hover:border-rose-500/40' : 'bg-white border-slate-200 hover:border-rose-500'
                                    }`}>
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center">
                                                <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase bg-rose-500 text-white">
                                                    Telecel
                                                </span>
                                                <span className="text-[10px] text-slate-400">Popular</span>
                                            </div>
                                            <h4 className="text-2xl font-black group-hover:text-rose-500 transition-colors">
                                                {bundle.data_amount}
                                            </h4>
                                        </div>

                                        <div className="pt-3 border-t border-current/10 flex items-center justify-between">
                                            <div>
                                                <span className="text-[10px] text-slate-400 block">Retail Price</span>
                                                <span className="text-lg font-black text-rose-500">
                                                    GHS {(parseFloat(bundle.agent_price_ghc as any) || 0).toFixed(2)}
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => handleBuyClick(bundle)}
                                                className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white font-extrabold rounded-xl text-xs transition-all flex items-center gap-1"
                                            >
                                                Buy Data
                                                <ArrowRight className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                {/* AirtelTigo Popular */}
                                {popularBundles.AIRTELTIGO.map(bundle => (
                                    <div key={bundle.bundle_id} className={`p-5 rounded-3xl border shadow-xl flex flex-col justify-between space-y-4 group ${
                                        isDark ? 'bg-[#202227] border-white/5 hover:border-blue-500/40' : 'bg-white border-slate-200 hover:border-blue-500'
                                    }`}>
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center">
                                                <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase bg-blue-500 text-white">
                                                    AirtelTigo
                                                </span>
                                                <span className="text-[10px] text-slate-400">Popular</span>
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
                                                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-extrabold rounded-xl text-xs transition-all flex items-center gap-1"
                                            >
                                                Buy Data
                                                <ArrowRight className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
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
                    <div className="space-y-6">
                        {/* Network Chips with Network Branding */}
                        <div className="flex items-center justify-center gap-2 overflow-x-auto pb-2">
                            {['ALL', 'MTN', 'TELECEL', 'AIRTELTIGO'].map(net => {
                                const isSelected = selectedNetwork === net;
                                let colorClass = isDark ? 'bg-[#202227] text-slate-400 border-white/5' : 'bg-white text-slate-600 border-slate-200';
                                
                                if (isSelected) {
                                    if (net === 'MTN') colorClass = 'bg-amber-400 text-black font-extrabold border-amber-400 shadow-lg shadow-amber-400/20';
                                    else if (net === 'TELECEL') colorClass = 'bg-rose-500 text-white font-extrabold border-rose-500 shadow-lg shadow-rose-500/20';
                                    else if (net === 'AIRTELTIGO') colorClass = 'bg-blue-500 text-white font-extrabold border-blue-500 shadow-lg shadow-blue-500/20';
                                    else colorClass = 'bg-[#a3e635] text-black font-extrabold border-[#a3e635] shadow-lg shadow-[#a3e635]/20';
                                }

                                return (
                                    <button
                                        key={net}
                                        onClick={() => setSelectedNetwork(net)}
                                        className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all uppercase border ${colorClass}`}
                                    >
                                        {net === 'ALL' ? 'All Networks' : net}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Product Grid */}
                        {filteredProducts.length === 0 ? (
                            <div className={`p-12 rounded-3xl border text-center text-xs ${
                                isDark ? 'bg-[#202227] border-white/5 text-slate-400' : 'bg-white border-slate-200 text-slate-600'
                            }`}>
                                No active data bundles found for this category.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                                {filteredProducts.map(bundle => (
                                    <div
                                        key={bundle.bundle_id}
                                        className={`p-6 rounded-3xl border shadow-xl transition-all flex flex-col justify-between space-y-4 group ${
                                            isDark ? 'bg-[#202227] border-white/5 hover:border-[#a3e635]/30' : 'bg-white border-slate-200 hover:border-emerald-400'
                                        }`}
                                    >
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center">
                                                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase ${
                                                    bundle.network === 'MTN' ? 'bg-amber-400 text-black' :
                                                    bundle.network === 'TELECEL' || bundle.network === 'VODA' ? 'bg-rose-500 text-white' :
                                                    'bg-blue-500 text-white'
                                                }`}>
                                                    {bundle.network}
                                                </span>
                                                <span className="text-[10px] text-slate-400 font-mono">Instant Delivery</span>
                                            </div>
                                            <h3 className={`text-2xl font-black transition-colors ${
                                                isDark ? 'text-white group-hover:text-[#a3e635]' : 'text-slate-900 group-hover:text-emerald-600'
                                            }`}>
                                                {bundle.data_amount}
                                            </h3>
                                        </div>

                                        <div className="pt-4 border-t border-current/10 flex items-center justify-between">
                                            <div>
                                                <span className="text-[10px] text-slate-400 block">Retail Price</span>
                                                <span className={`text-xl font-extrabold ${
                                                    isDark ? 'text-[#a3e635]' : 'text-emerald-600'
                                                }`}>
                                                    GHS {(parseFloat(bundle.agent_price_ghc as any) || 0).toFixed(2)}
                                                </span>
                                            </div>

                                            <button
                                                onClick={() => handleBuyClick(bundle)}
                                                className="px-5 py-2.5 bg-[#a3e635] hover:bg-[#b5f73c] text-black font-extrabold rounded-xl text-xs shadow-md shadow-[#a3e635]/20 transition-all flex items-center gap-1.5"
                                            >
                                                Buy Data
                                                <ArrowRight className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* 3. TRACK DATA TAB */}
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
                                    Enter your Order ID or Paystack payment reference below to verify order delivery.
                                </p>
                            </div>

                            <form onSubmit={handleTrackOrder} className="space-y-4">
                                <div className="space-y-1">
                                    <label className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Order Reference ID *</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={trackOrderId}
                                            onChange={(e) => setTrackOrderId(e.target.value)}
                                            placeholder="e.g. BB-XXXXXXXX or Paystack Ref"
                                            required
                                            className={`w-full pl-4 pr-24 py-3 border rounded-xl text-sm font-mono focus:outline-none focus:border-[#a3e635] ${
                                                isDark ? 'bg-[#18191c] border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                                            }`}
                                        />
                                        <button
                                            type="submit"
                                            disabled={trackingLoading || !trackOrderId.trim()}
                                            className="absolute right-1.5 top-1/2 -translate-y-1/2 px-4 py-2 bg-[#a3e635] hover:bg-[#b5f73c] text-black font-extrabold rounded-lg text-xs transition-all disabled:opacity-50"
                                        >
                                            {trackingLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Track Order'}
                                        </button>
                                    </div>
                                </div>
                            </form>

                            {trackingError && (
                                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-xs text-rose-400 flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 shrink-0" />
                                    <span>{trackingError}</span>
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
                                            {trackedOrder.fulfillment_status || 'PROCESSING'}
                                        </span>
                                    </div>

                                    {/* Detailed Delivery Progress */}
                                    <DeliveryProgress status={trackedOrder.fulfillment_status} isDark={isDark} />

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
                                <div className={`p-4 rounded-2xl border space-y-1 ${isDark ? 'bg-[#18191c] border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Store Name</span>
                                    <p className="text-sm font-black">{storeInfo?.store_name}</p>
                                </div>

                                <div className={`p-4 rounded-2xl border space-y-1 ${isDark ? 'bg-[#18191c] border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Description</span>
                                    <p className="leading-relaxed">{storeInfo?.description || 'Official data reseller storefront'}</p>
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
                        <p className="text-[11px] text-slate-400 max-w-sm">{storeInfo?.description || 'Instant Automated Telecommunications Data Marketplace'}</p>
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
                    <p className="text-[10px] text-slate-400 font-semibold">Powered by ByteBeacon</p>
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
                                <p className="text-xs text-[#a3e635] font-semibold">{selectedBundle.network} {selectedBundle.data_amount}</p>
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
                                <p className="text-[10px] text-slate-400">Data bundle will be delivered directly to this number.</p>
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

