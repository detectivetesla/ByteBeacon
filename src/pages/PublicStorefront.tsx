import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { agentStoreService, AgentProduct } from '@/services/agentStore.service';
import { Store as StoreIcon, ShieldCheck, Zap, ShoppingCart, CheckCircle2, Phone, ArrowRight, RefreshCw, AlertTriangle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function PublicStorefront() {
    const { slug } = useParams<{ slug: string }>();
    const [searchParams] = useSearchParams();
    const referenceFromUrl = searchParams.get('reference');
    const { toast } = useToast();

    const [storeInfo, setStoreInfo] = useState<{ id: string; store_name: string; slug: string; description: string; phone: string; logo_url: string } | null>(null);
    const [products, setProducts] = useState<AgentProduct[]>([]);
    const [selectedNetwork, setSelectedNetwork] = useState<string>('ALL');
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Purchase Modal states
    const [selectedBundle, setSelectedBundle] = useState<AgentProduct | null>(null);
    const [customerPhone, setCustomerPhone] = useState('');
    const [isInitializing, setIsInitializing] = useState(false);

    // Verification states
    const [verifying, setVerifying] = useState(false);
    const [verificationResult, setVerificationResult] = useState<{ status: string; message: string; order_id: string } | null>(null);

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

    if (loading) {
        return (
            <div className="min-h-screen bg-[#141518] flex items-center justify-center text-[#a3e635] space-x-3 font-sans">
                <RefreshCw className="w-6 h-6 animate-spin text-[#a3e635]" />
                <span className="text-sm font-bold text-white">Loading Storefront...</span>
            </div>
        );
    }

    if (errorMsg) {
        return (
            <div className="min-h-screen bg-[#141518] flex items-center justify-center p-4 font-sans text-white">
                <div className="bg-[#202227] p-8 rounded-3xl border border-white/10 max-w-md w-full text-center space-y-4 shadow-2xl">
                    <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto" />
                    <h2 className="text-xl font-bold">Store Unavailable</h2>
                    <p className="text-xs text-slate-400 leading-relaxed">{errorMsg}</p>
                </div>
            </div>
        );
    }

    const filteredProducts = products.filter(p => selectedNetwork === 'ALL' || p.network === selectedNetwork);

    return (
        <div className="min-h-screen bg-[#141518] text-white font-sans selection:bg-[#a3e635] selection:text-black">
            {/* Top Store Header */}
            <header className="bg-[#202227] border-b border-white/5 py-8 px-4 sm:px-6 shadow-xl relative overflow-hidden">
                <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-4 text-center sm:text-left">
                        {storeInfo?.logo_url ? (
                            <img src={storeInfo.logo_url} alt={storeInfo.store_name} className="w-16 h-16 rounded-2xl object-cover border border-white/10" />
                        ) : (
                            <div className="w-16 h-16 rounded-2xl bg-[#a3e635]/10 border border-[#a3e635]/30 flex items-center justify-center text-[#a3e635]">
                                <StoreIcon className="w-8 h-8" />
                            </div>
                        )}
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">{storeInfo?.store_name}</h1>
                            <p className="text-xs text-slate-400 mt-1 max-w-md">{storeInfo?.description || 'Affordable data bundles in Ghana'}</p>
                            {storeInfo?.phone && (
                                <p className="text-[11px] text-[#a3e635] font-bold mt-1 flex items-center gap-1 justify-center sm:justify-start">
                                    <Phone className="w-3 h-3" /> Support: {storeInfo.phone}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="px-4 py-2 rounded-xl bg-[#18191c] border border-white/5 text-[11px] text-slate-400 flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-[#a3e635]" />
                        <span>Powered by ByteBeacon Telecom Network</span>
                    </div>
                </div>
            </header>

            {/* Payment Verification Overlay Result */}
            {verifying && (
                <div className="max-w-5xl mx-auto my-6 p-6 bg-[#202227] rounded-2xl border border-white/10 text-center space-y-3">
                    <RefreshCw className="w-8 h-8 animate-spin text-[#a3e635] mx-auto" />
                    <p className="font-bold text-sm text-white">Verifying payment & placing order...</p>
                </div>
            )}

            {verificationResult && (
                <div className="max-w-5xl mx-auto my-6 p-6 bg-[#202227] rounded-2xl border border-[#a3e635]/30 text-center space-y-3 shadow-2xl">
                    <CheckCircle2 className="w-10 h-10 text-[#a3e635] mx-auto" />
                    <h3 className="text-lg font-bold text-white">Order Processed!</h3>
                    <p className="text-xs text-slate-300">{verificationResult.message}</p>
                    <p className="text-[10px] text-slate-500 font-mono">Order ID: {verificationResult.order_id}</p>
                </div>
            )}

            {/* Main Catalogue Section */}
            <main className="max-w-5xl mx-auto py-8 px-4 sm:px-6 space-y-8">
                {/* Network Chips */}
                <div className="flex items-center justify-center gap-2 overflow-x-auto pb-2">
                    {['ALL', 'MTN', 'TELECEL', 'AIRTELTIGO'].map(net => (
                        <button
                            key={net}
                            onClick={() => setSelectedNetwork(net)}
                            className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all uppercase ${
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
                                        GHS {bundle.agent_price_ghc.toFixed(2)}
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
            </main>

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
                                    <span className="text-[#a3e635] font-extrabold text-sm">GHS {selectedBundle.agent_price_ghc.toFixed(2)}</span>
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
