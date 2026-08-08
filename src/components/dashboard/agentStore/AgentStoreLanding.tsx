import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { agentStoreService, AgentStore } from '@/services/agentStore.service';
import { Store, CheckCircle2, Clock, AlertTriangle, ArrowRight, ShieldCheck, Zap, DollarSign, ExternalLink } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface AgentStoreLandingProps {
    existingStore: AgentStore | null;
    onStoreCreated: () => void;
}

export const AgentStoreLanding: React.FC<AgentStoreLandingProps> = ({ existingStore, onStoreCreated }) => {
    const { user } = useAuth();
    const { toast } = useToast();

    const [storeName, setStoreName] = useState('');
    const [description, setDescription] = useState('');
    const [phone, setPhone] = useState(user?.phone || '');
    const [logoUrl, setLogoUrl] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [createdStore, setCreatedStore] = useState<AgentStore | null>(existingStore);
    const [isPayingNow, setIsPayingNow] = useState(false);

    const handleCreateStore = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!storeName.trim() || !phone.trim()) {
            toast({ title: 'Validation Error', description: 'Store Name and Phone Number are required.', variant: 'destructive' });
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await agentStoreService.createStore({
                store_name: storeName.trim(),
                description: description.trim(),
                phone: phone.trim(),
                logo_url: logoUrl.trim()
            });

            if (res.success && res.store) {
                setCreatedStore(res.store);
                setShowSuccessModal(true);
                toast({ title: 'Success!', description: 'Agent Store created and submitted for review.' });
                onStoreCreated();
            }
        } catch (err: any) {
            toast({ title: 'Error', description: err.message || 'Failed to create Agent Store', variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePayNow = async () => {
        setIsPayingNow(true);
        try {
            const res = await agentStoreService.initializeActivation();
            if (res.success && res.authorization_url) {
                window.location.href = res.authorization_url;
            }
        } catch (err: any) {
            toast({ title: 'Payment Error', description: err.message || 'Failed to initialize Paystack payment', variant: 'destructive' });
        } finally {
            setIsPayingNow(false);
        }
    };

    // Render Status View if user already has a pending/inactive store
    if (existingStore || createdStore) {
        const store = existingStore || createdStore!;
        const effectiveStatus = store.effective_status;

        return (
            <div className="p-6 space-y-8 bg-[#141518] min-h-screen text-white font-sans">
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#202227] p-6 rounded-2xl border border-white/5 shadow-xl">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-[#a3e635]/10 border border-[#a3e635]/30 flex items-center justify-center text-[#a3e635]">
                            <Store className="w-7 h-7" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white tracking-tight">{store.store_name}</h1>
                            <p className="text-xs text-slate-400 mt-0.5">URL: bytebeacon.online/store/{store.slug}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={`px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                            effectiveStatus === 'ACTIVE' ? 'bg-[#a3e635] text-black shadow-md shadow-[#a3e635]/20' :
                            effectiveStatus === 'AWAITING_ACTIVATION' ? 'bg-amber-400/20 text-amber-400 border border-amber-400/30' :
                            effectiveStatus === 'PENDING_REVIEW' ? 'bg-blue-400/20 text-blue-400 border border-blue-400/30' :
                            'bg-red-400/20 text-red-400 border border-red-400/30'
                        }`}>
                            {effectiveStatus.replace('_', ' ')}
                        </span>
                    </div>
                </div>

                {/* Status Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Review Status Card */}
                    <div className="bg-[#202227] p-6 rounded-2xl border border-white/5 shadow-lg flex flex-col justify-between">
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <Clock className="w-5 h-5 text-blue-400" />
                                <h3 className="font-semibold text-lg text-white">1. Administrative Review</h3>
                            </div>
                            <p className="text-sm text-slate-400 leading-relaxed">
                                Every Agent Store undergoes review by ByteBeacon administrators to maintain service quality and compliance.
                            </p>
                        </div>
                        <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
                            <span className="text-xs text-slate-400">Review Status:</span>
                            <span className="font-semibold text-sm text-blue-400 uppercase">{store.review_status}</span>
                        </div>
                    </div>

                    {/* Activation Status Card */}
                    <div className="bg-[#202227] p-6 rounded-2xl border border-white/5 shadow-lg flex flex-col justify-between">
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <Zap className="w-5 h-5 text-[#a3e635]" />
                                <h3 className="font-semibold text-lg text-white">2. Store Activation Fee</h3>
                            </div>
                            <p className="text-sm text-slate-400 leading-relaxed">
                                A one-time activation fee of <span className="text-[#a3e635] font-bold">GHS 100.00</span> is required to activate your storefront for selling data bundles.
                            </p>
                        </div>
                        <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
                            <span className="text-xs text-slate-400">Payment Status:</span>
                            <span className={`font-semibold text-sm uppercase ${store.activation_status === 'PAID' ? 'text-[#a3e635]' : 'text-amber-400'}`}>
                                {store.activation_status}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Action Box if unpaid */}
                {store.activation_status !== 'PAID' && (
                    <div className="bg-gradient-to-r from-[#202227] to-[#26282e] p-6 rounded-2xl border border-[#a3e635]/20 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-6">
                        <div className="space-y-1 text-center sm:text-left">
                            <h4 className="text-lg font-bold text-white flex items-center gap-2 justify-center sm:justify-start">
                                Complete Store Activation — GHS 100.00
                            </h4>
                            <p className="text-xs text-slate-400">Pay securely via Paystack to unlock your public storefront.</p>
                        </div>
                        <button
                            onClick={handlePayNow}
                            disabled={isPayingNow}
                            className="px-6 py-3 bg-[#a3e635] hover:bg-[#b5f73c] text-black font-bold rounded-xl transition-all shadow-lg shadow-[#a3e635]/20 flex items-center gap-2 text-sm disabled:opacity-50"
                        >
                            {isPayingNow ? 'Redirecting...' : 'Pay GHS 100.00 Now'}
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="p-6 space-y-8 bg-[#141518] min-h-screen text-white font-sans">
            {/* Header Banner */}
            <div className="bg-[#202227] p-8 rounded-3xl border border-white/5 shadow-2xl relative overflow-hidden">
                <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-[#a3e635]/10 rounded-full blur-3xl pointer-events-none" />
                <div className="max-w-2xl space-y-4">
                    <span className="px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-[#a3e635] text-black inline-block shadow-md shadow-[#a3e635]/20">
                        Commission-Free Reseller Platform
                    </span>
                    <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
                        Launch Your Own Telecommunications Data-Selling Storefront
                    </h1>
                    <p className="text-slate-400 text-sm leading-relaxed">
                        ByteBeacon powers your infrastructure. You set your retail prices, market your custom brand URL, and earn 100% of your markup profit on every data bundle sold.
                    </p>
                </div>
            </div>

            {/* Features Highlight */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-[#202227] p-6 rounded-2xl border border-white/5 space-y-3">
                    <div className="w-10 h-10 rounded-xl bg-[#a3e635]/10 flex items-center justify-center text-[#a3e635]">
                        <DollarSign className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-white text-base">Markup-Only Model</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                        No percentage deductions. You choose your retail markup price above ByteBeacon base cost and pocket the entire difference.
                    </p>
                </div>
                <div className="bg-[#202227] p-6 rounded-2xl border border-white/5 space-y-3">
                    <div className="w-10 h-10 rounded-xl bg-[#a3e635]/10 flex items-center justify-center text-[#a3e635]">
                        <ShieldCheck className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-white text-base">Automated Fulfillment</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                        Orders placed on your storefront are processed automatically by ByteBeacon's backend provider network. Zero manual effort required.
                    </p>
                </div>
                <div className="bg-[#202227] p-6 rounded-2xl border border-white/5 space-y-3">
                    <div className="w-10 h-10 rounded-xl bg-[#a3e635]/10 flex items-center justify-center text-[#a3e635]">
                        <Zap className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-white text-base">Instant Profit Ledger</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                        Earned profits are credited to your Agent Wallet instantly upon delivery and can be withdrawn directly to Mobile Money or Bank Account.
                    </p>
                </div>
            </div>

            {/* Creation Form */}
            <div className="bg-[#202227] p-8 rounded-3xl border border-white/5 shadow-2xl max-w-3xl mx-auto space-y-6">
                <div className="border-b border-white/5 pb-4">
                    <h2 className="text-xl font-bold text-white">Create Your Agent Store</h2>
                    <p className="text-xs text-slate-400 mt-1">Complete your store details to submit your reseller application.</p>
                </div>

                <form onSubmit={handleCreateStore} className="space-y-5">
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-300">Store Name *</label>
                        <input
                            type="text"
                            value={storeName}
                            onChange={(e) => setStoreName(e.target.value)}
                            placeholder="e.g. Caleb Data Hub"
                            required
                            className="w-full px-4 py-3 bg-[#18191c] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-[#a3e635]"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-300">Store Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="e.g. Fast & affordable MTN, Telecel, and AirtelTigo data bundles in Ghana."
                            rows={3}
                            className="w-full px-4 py-3 bg-[#18191c] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-[#a3e635]"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-300">Business Phone Number *</label>
                            <input
                                type="text"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="024XXXXXXX"
                                required
                                className="w-full px-4 py-3 bg-[#18191c] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-[#a3e635]"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-300">Store Logo Image URL (Optional)</label>
                            <input
                                type="url"
                                value={logoUrl}
                                onChange={(e) => setLogoUrl(e.target.value)}
                                placeholder="https://example.com/logo.png"
                                className="w-full px-4 py-3 bg-[#18191c] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-[#a3e635]"
                            />
                        </div>
                    </div>

                    <div className="p-4 bg-[#18191c] rounded-xl border border-white/5 text-xs text-slate-400 space-y-1">
                        <p className="font-semibold text-slate-200">Store Activation Requirement:</p>
                        <p>Creation is free to submit for review. Activating your storefront for customer sales requires a one-time payment of <span className="text-[#a3e635] font-bold">GHS 100.00</span> (Pay Now or Pay Later).</p>
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-3.5 bg-[#a3e635] hover:bg-[#b5f73c] text-black font-bold rounded-xl transition-all shadow-lg shadow-[#a3e635]/20 flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                    >
                        {isSubmitting ? 'Submitting Application...' : 'Create Agent Store'}
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </form>
            </div>

            {/* Post-Submit Modal */}
            {showSuccessModal && createdStore && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-[#202227] border border-white/10 rounded-3xl p-8 max-w-md w-full space-y-6 text-center shadow-2xl">
                        <div className="w-16 h-16 rounded-full bg-[#a3e635]/10 border border-[#a3e635]/30 flex items-center justify-center text-[#a3e635] mx-auto">
                            <CheckCircle2 className="w-8 h-8" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-white">Store Submitted Successfully!</h3>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                Your Agent Store <span className="text-white font-semibold">{createdStore.store_name}</span> has been submitted for administrative review.
                            </p>
                        </div>
                        <div className="p-4 bg-[#18191c] rounded-2xl border border-white/5 space-y-1 text-left text-xs">
                            <div className="flex justify-between py-1">
                                <span className="text-slate-400">Review Status:</span>
                                <span className="text-blue-400 font-semibold uppercase">Pending Review</span>
                            </div>
                            <div className="flex justify-between py-1">
                                <span className="text-slate-400">Activation Fee:</span>
                                <span className="text-[#a3e635] font-bold">GHS 100.00</span>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <button
                                onClick={handlePayNow}
                                className="w-full py-3 bg-[#a3e635] hover:bg-[#b5f73c] text-black font-bold rounded-xl transition-all shadow-md shadow-[#a3e635]/20 text-sm"
                            >
                                Pay GHS 100.00 Now
                            </button>
                            <button
                                onClick={() => setShowSuccessModal(false)}
                                className="w-full py-3 bg-[#18191c] hover:bg-white/5 text-slate-300 font-medium rounded-xl border border-white/10 transition-all text-sm"
                            >
                                Pay Later
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
