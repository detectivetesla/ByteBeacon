import React, { useEffect, useState } from 'react';
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
    RotateCcw
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function PublicStorefront() {
    const { slug } = useParams<{ slug: string }>();
    const [searchParams] = useSearchParams();
    const referenceFromUrl = searchParams.get('reference');
    const { toast } = useToast();

    // Store & Product state
    const [storeInfo, setStoreInfo] = useState<{ id: string; store_name: string; slug: string; description: string; phone: string; logo_url: string } | null>(null);
    const [products, setProducts] = useState<AgentProduct[]>([]);
    const [selectedNetwork, setSelectedNetwork] = useState<string>('ALL');
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Navigation Tab state
    const [activeTab, setActiveTab] = useState<'home' | 'purchase' | 'track' | 'info'>('purchase');

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
            } else {
                setTrackingError('Order not found. Please check your Order ID or reference.');
            }
        } catch (err: any) {
            setTrackingError(err.message || 'Order not found. Please check your Order ID.');
        } finally {
            setTrackingLoading(false);
        }
    };

    const availableNetworks = Array.from(new Set(products.map(p => p.network)));

    if (loading) {
        return (
            <div className="min-h-screen bg-[#141518] text-white font-sans flex items-center justify-center p-4">
                <div className="text-center space-y-3">
                    <RefreshCw className="w-8 h-8 animate-spin text-[#a3e635] mx-auto" />
                    <p className="text-xs font-bold text-slate-300">Loading Storefront...</p>
                </div>
            </div>
        );
    }

    if (errorMsg) {
        return (
            <div className="min-h-screen bg-[#141518] flex items-center justify-center p-4 font-sans text-white">
                <div className="bg-[#202227] p-8 rounded-3xl border border-white/10 max-w-md w-full text-center space-y-4 shadow-2xl">
                    <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto" />
                    <h2 className="text-xl font-bold">Store Currently Unavailable</h2>
                    <p className="text-xs text-slate-400 leading-relaxed">{errorMsg}</p>
                </div>
            </div>
        );
    }

    const filteredProducts = products.filter(p => selectedNetwork === 'ALL' || p.network === selectedNetwork);

    return (
        <div className="min-h-screen bg-[#141518] text-white font-sans selection:bg-[#a3e635] selection:text-black flex flex-col">
            {/* Top Store Header */}
            <header className="bg-[#202227] border-b border-white/5 py-6 px-4 sm:px-6 shadow-xl relative">
                <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4 text-center sm:text-left">
                        {storeInfo?.logo_url ? (
                            <img src={storeInfo.logo_url} alt={storeInfo.store_name} className="w-14 h-14 rounded-2xl object-cover border border-white/10" />
                        ) : (
                            <div className="w-14 h-14 rounded-2xl bg-[#a3e635]/10 border border-[#a3e635]/30 flex items-center justify-center text-[#a3e635]">
                                <StoreIcon className="w-7 h-7" />
                            </div>
                        )}
                        <div>
                            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">{storeInfo?.store_name}</h1>
                            <p className="text-xs text-slate-400 max-w-md">{storeInfo?.description || 'Instant Automated Data Bundles'}</p>
                        </div>
                    </div>

                    <div className="px-3.5 py-1.5 rounded-xl bg-[#18191c] border border-white/5 text-[11px] text-slate-400 flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-[#a3e635]" />
                        <span>Instant & Secure Delivery</span>
                    </div>
                </div>

                {/* Minimalist Navigation Bar */}
                <div className="max-w-5xl mx-auto mt-6 pt-4 border-t border-white/5 flex items-center justify-center sm:justify-start gap-2 overflow-x-auto">
                    {[
                        { id: 'home', label: 'Home', icon: Home },
                        { id: 'purchase', label: 'Purchase Data', icon: ShoppingCart },
                        { id: 'track', label: 'Track Data', icon: FileText },
                        { id: 'info', label: 'Info', icon: Info },
                    ].map(tab => {
                        const Icon = tab.icon;
                        const active = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                                    active
                                        ? 'bg-[#a3e635] text-black shadow-md shadow-[#a3e635]/20 font-extrabold'
                                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                                }`}
                            >
                                <Icon className="w-3.5 h-3.5" />
                                <span>{tab.label}</span>
                            </button>
                        );
                    })}
                </div>
            </header>

            {/* Payment Verification Banner Result */}
            {verifying && (
                <div className="max-w-5xl mx-auto my-4 p-4 bg-[#202227] rounded-2xl border border-white/10 text-center space-y-2">
                    <RefreshCw className="w-6 h-6 animate-spin text-[#a3e635] mx-auto" />
                    <p className="font-bold text-xs text-white">Verifying payment & processing order...</p>
                </div>
            )}

            {verificationResult && (
                <div className="max-w-5xl mx-auto my-4 p-6 bg-[#202227] rounded-2xl border border-[#a3e635]/30 text-center space-y-2 shadow-2xl">
                    <CheckCircle2 className="w-8 h-8 text-[#a3e635] mx-auto" />
                    <h3 className="text-base font-bold text-white">Payment Confirmed!</h3>
                    <p className="text-xs text-slate-300">{verificationResult.message}</p>
                    <p className="text-[10px] text-slate-500 font-mono">Order ID: {verificationResult.order_id}</p>
                </div>
            )}

            {/* Main Content Area */}
            <main className="max-w-5xl mx-auto py-8 px-4 sm:px-6 flex-1 w-full space-y-8">
                {/* 1. HOME TAB */}
                {activeTab === 'home' && (
                    <div className="space-y-8">
                        {/* Store Banner Hero */}
                        <div className="bg-[#202227] p-8 sm:p-12 rounded-3xl border border-white/5 text-center space-y-6 shadow-2xl relative overflow-hidden">
                            <div className="w-20 h-20 rounded-3xl bg-[#a3e635]/10 border border-[#a3e635]/30 flex items-center justify-center text-[#a3e635] mx-auto">
                                <Zap className="w-10 h-10" />
                            </div>
                            <div className="space-y-2 max-w-lg mx-auto">
                                <h2 className="text-2xl sm:text-3xl font-black text-white">{storeInfo?.store_name}</h2>
                                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                                    {storeInfo?.description || 'Fast, reliable, and instant telecommunications data bundle reseller storefront.'}
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                                <button
                                    onClick={() => setActiveTab('purchase')}
                                    className="px-6 py-3.5 bg-[#a3e635] hover:bg-[#b5f73c] text-black font-extrabold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-[#a3e635]/20 transition-all"
                                >
                                    <ShoppingCart className="w-4 h-4" />
                                    <span>Browse & Purchase Data</span>
                                </button>
                                <button
                                    onClick={() => setActiveTab('track')}
                                    className="px-6 py-3.5 bg-[#18191c] hover:bg-[#26282e] text-slate-300 font-bold rounded-xl text-xs border border-white/10 flex items-center gap-2 transition-all"
                                >
                                    <FileText className="w-4 h-4 text-slate-400" />
                                    <span>Track Existing Order</span>
                                </button>
                            </div>
                        </div>

                        {/* Store Service Highlights */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="bg-[#202227] p-5 rounded-2xl border border-white/5 space-y-2">
                                <Zap className="w-6 h-6 text-[#a3e635]" />
                                <h3 className="text-xs font-bold text-white">Instant Fulfillment</h3>
                                <p className="text-[11px] text-slate-400">Data bundles are dispatched automatically to your recipient number.</p>
                            </div>
                            <div className="bg-[#202227] p-5 rounded-2xl border border-white/5 space-y-2">
                                <ShieldCheck className="w-6 h-6 text-emerald-400" />
                                <h3 className="text-xs font-bold text-white">Secure Checkout</h3>
                                <p className="text-[11px] text-slate-400">Transactions are encrypted and processed securely via Paystack.</p>
                            </div>
                            <div className="bg-[#202227] p-5 rounded-2xl border border-white/5 space-y-2">
                                <Phone className="w-6 h-6 text-sky-400" />
                                <h3 className="text-xs font-bold text-white">Support Availability</h3>
                                <p className="text-[11px] text-slate-400">Need help? Contact our store administrator directly for assistance.</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. PURCHASE DATA TAB */}
                {activeTab === 'purchase' && (
                    <div className="space-y-6">
                        {/* Network Chips */}
                        <div className="flex items-center justify-center gap-2 overflow-x-auto pb-2">
                            {['ALL', ...availableNetworks].map(net => (
                                <button
                                    key={net}
                                    onClick={() => setSelectedNetwork(net)}
                                    className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all uppercase ${
                                        selectedNetwork === net
                                            ? 'bg-[#a3e635] text-black shadow-lg shadow-[#a3e635]/20 font-extrabold'
                                            : 'bg-[#202227] text-slate-400 hover:text-white border border-white/5'
                                    }`}
                                >
                                    {net}
                                </button>
                            ))}
                        </div>

                        {/* Product Grid */}
                        {filteredProducts.length === 0 ? (
                            <div className="bg-[#202227] p-12 rounded-3xl border border-white/5 text-center text-slate-400 text-xs">
                                No active data bundles found for this category.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                                {filteredProducts.map(bundle => (
                                    <div
                                        key={bundle.bundle_id}
                                        className="bg-[#202227] p-6 rounded-3xl border border-white/5 shadow-xl hover:border-[#a3e635]/30 transition-all flex flex-col justify-between space-y-4 group"
                                    >
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center">
                                                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase ${
                                                    bundle.network === 'MTN' ? 'bg-yellow-400 text-black' :
                                                    bundle.network === 'TELECEL' ? 'bg-red-500 text-white' :
                                                    'bg-blue-500 text-white'
                                                }`}>
                                                    {bundle.network}
                                                </span>
                                                <span className="text-[10px] text-slate-400 font-mono">Instant Delivery</span>
                                            </div>
                                            <h3 className="text-2xl font-black text-white group-hover:text-[#a3e635] transition-colors">
                                                {bundle.data_amount}
                                            </h3>
                                        </div>

                                        <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                                            <div>
                                                <span className="text-[10px] text-slate-400 block">Retail Price</span>
                                                <span className="text-xl font-extrabold text-[#a3e635]">
                                                    GHS {(parseFloat(bundle.agent_price_ghc as any) || 0).toFixed(2)}
                                                </span>
                                            </div>

                                            <button
                                                onClick={() => handleBuyClick(bundle)}
                                                className="px-5 py-2.5 bg-[#a3e635] hover:bg-[#b5f73c] text-black font-bold rounded-xl text-xs shadow-md shadow-[#a3e635]/20 transition-all flex items-center gap-1.5"
                                            >
                                                Buy Now
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
                        <div className="bg-[#202227] p-6 sm:p-8 rounded-3xl border border-white/5 space-y-6 shadow-xl">
                            <div>
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-[#a3e635]" />
                                    Track Order Status
                                </h2>
                                <p className="text-xs text-slate-400 mt-1">
                                    Enter your Order ID or Paystack payment reference below to verify order delivery.
                                </p>
                            </div>

                            <form onSubmit={handleTrackOrder} className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-300">Order Reference ID *</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={trackOrderId}
                                            onChange={(e) => setTrackOrderId(e.target.value)}
                                            placeholder="e.g. ORD-102938 or Paystack Ref"
                                            required
                                            className="w-full pl-4 pr-12 py-3 bg-[#18191c] border border-white/10 rounded-xl text-white text-sm font-mono focus:outline-none focus:border-[#a3e635]"
                                        />
                                        <button
                                            type="submit"
                                            disabled={trackingLoading || !trackOrderId.trim()}
                                            className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-2 bg-[#a3e635] hover:bg-[#b5f73c] text-black font-bold rounded-lg text-xs transition-all disabled:opacity-50"
                                        >
                                            {trackingLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Track'}
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
                                <div className="p-5 bg-[#18191c] rounded-2xl border border-white/10 space-y-3 text-xs">
                                    <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                        <span className="text-slate-400">Status</span>
                                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                                            (trackedOrder.fulfillment_status || '').toLowerCase() === 'completed' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                                            (trackedOrder.fulfillment_status || '').toLowerCase() === 'refunded' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                                            (trackedOrder.fulfillment_status || '').toLowerCase() === 'failed' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                                            'bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse'
                                        }`}>
                                            {trackedOrder.fulfillment_status || 'PROCESSING'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Order ID:</span>
                                        <span className="text-white font-mono font-bold">{trackedOrder.id}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Package:</span>
                                        <span className="text-white font-bold">{trackedOrder.network} {trackedOrder.data_amount}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Recipient Phone:</span>
                                        <span className="text-white font-mono">{trackedOrder.customer_phone}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Amount Paid:</span>
                                        <span className="text-[#a3e635] font-extrabold">GHS {(parseFloat(trackedOrder.selling_price_ghc as any) || 0).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Date:</span>
                                        <span className="text-slate-400">{new Date(trackedOrder.created_at).toLocaleString()}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* 4. INFO TAB */}
                {activeTab === 'info' && (
                    <div className="max-w-xl mx-auto space-y-6">
                        <div className="bg-[#202227] p-6 sm:p-8 rounded-3xl border border-white/5 space-y-6 shadow-xl">
                            <div>
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Info className="w-5 h-5 text-[#a3e635]" />
                                    Store Information
                                </h2>
                                <p className="text-xs text-slate-400 mt-1">
                                    Public store identity and customer service contact details.
                                </p>
                            </div>

                            <div className="space-y-4 text-xs">
                                <div className="p-4 bg-[#18191c] rounded-2xl border border-white/5 space-y-1">
                                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Store Name</span>
                                    <p className="text-sm font-black text-white">{storeInfo?.store_name}</p>
                                </div>

                                <div className="p-4 bg-[#18191c] rounded-2xl border border-white/5 space-y-1">
                                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Description</span>
                                    <p className="text-slate-300 leading-relaxed">{storeInfo?.description || 'Official data reseller storefront'}</p>
                                </div>

                                {storeInfo?.phone && (
                                    <div className="p-4 bg-[#18191c] rounded-2xl border border-white/5 space-y-1">
                                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Customer Support Phone</span>
                                        <p className="text-sm font-bold text-[#a3e635]">{storeInfo.phone}</p>
                                    </div>
                                )}

                                <div className="p-4 bg-[#18191c] rounded-2xl border border-white/5 space-y-1">
                                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Fulfillment Guarantee</span>
                                    <p className="text-slate-400">All data bundles are fulfilled automatically 24/7. In the event of a network error, transactions are automatically queued for retry or refunded.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {/* Branded Store Footer */}
            <footer className="border-t border-white/5 bg-[#18191c] py-6 px-4 sm:px-6 text-center text-xs text-slate-500 space-y-2 mt-auto">
                <p className="font-semibold text-slate-400">© {new Date().getFullYear()} {storeInfo?.store_name || 'Storefront'}. All rights reserved.</p>
                <p className="text-[10px] text-slate-600">Powered by ByteBeacon</p>
            </footer>

            {/* Purchase Modal */}
            {selectedBundle && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-[#202227] border border-white/10 rounded-3xl p-6 max-w-md w-full space-y-6 shadow-2xl text-white">
                        <div className="flex justify-between items-center border-b border-white/5 pb-3">
                            <div>
                                <h3 className="font-bold text-lg">Purchase Data Package</h3>
                                <p className="text-xs text-[#a3e635] font-semibold">{selectedBundle.network} {selectedBundle.data_amount}</p>
                            </div>
                            <button onClick={() => setSelectedBundle(null)} className="text-slate-400 hover:text-white text-xl">✕</button>
                        </div>

                        <form onSubmit={handleProceedToPayment} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-300">Recipient Phone Number *</label>
                                <input
                                    type="tel"
                                    value={customerPhone}
                                    onChange={(e) => setCustomerPhone(e.target.value)}
                                    placeholder="e.g. 0241234567"
                                    required
                                    className="w-full px-4 py-3 bg-[#18191c] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-[#a3e635]"
                                />
                                <p className="text-[10px] text-slate-400">Data bundle will be delivered directly to this number.</p>
                            </div>

                            <div className="p-4 bg-[#18191c] rounded-2xl border border-white/5 space-y-2 text-xs">
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Package Amount:</span>
                                    <span className="text-white font-bold">{selectedBundle.data_amount}</span>
                                </div>
                                <div className="flex justify-between border-t border-white/5 pt-2">
                                    <span className="text-slate-400">Total Price:</span>
                                    <span className="text-[#a3e635] font-extrabold text-sm">GHS {(parseFloat(selectedBundle.agent_price_ghc as any) || 0).toFixed(2)}</span>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isInitializing}
                                className="w-full py-3.5 bg-[#a3e635] hover:bg-[#b5f73c] text-black font-bold rounded-xl shadow-lg shadow-[#a3e635]/20 text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
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
