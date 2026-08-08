import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { agentStoreService, AgentStore } from '@/services/agentStore.service';
import { Store, CheckCircle2, Clock, Zap, DollarSign, ArrowRight, ShieldCheck, Sparkles, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

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
            <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-6 rounded-2xl border border-border shadow-lg">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                            <Store className="w-7 h-7" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-display font-bold text-foreground tracking-tight">{store.store_name}</h1>
                            <p className="text-xs text-muted-foreground font-medium mt-0.5">URL: bytebeacon.online/store/{store.slug}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={`px-3.5 py-1.5 rounded-full text-xs font-bold font-display uppercase tracking-wider ${
                            effectiveStatus === 'ACTIVE' ? 'bg-primary text-primary-foreground shadow-md' :
                            effectiveStatus === 'AWAITING_ACTIVATION' ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30' :
                            effectiveStatus === 'PENDING_REVIEW' ? 'bg-blue-500/20 text-blue-500 border border-blue-500/30' :
                            'bg-destructive/20 text-destructive border border-destructive/30'
                        }`}>
                            {effectiveStatus.replace('_', ' ')}
                        </span>
                    </div>
                </div>

                {/* Status Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Review Status Card */}
                    <Card className="bg-card border-border shadow-md flex flex-col justify-between">
                        <CardContent className="p-6 space-y-3">
                            <div className="flex items-center gap-3">
                                <Clock className="w-5 h-5 text-blue-500" />
                                <h3 className="font-display font-bold text-lg text-foreground">1. Administrative Review</h3>
                            </div>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                Every Agent Store undergoes review by ByteBeacon administrators to maintain service quality and compliance.
                            </p>
                            <div className="pt-4 border-t border-border/50 flex items-center justify-between">
                                <span className="text-xs text-muted-foreground font-medium">Review Status:</span>
                                <span className="font-bold text-sm text-blue-500 uppercase">{store.review_status}</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Activation Status Card */}
                    <Card className="bg-card border-border shadow-md flex flex-col justify-between">
                        <CardContent className="p-6 space-y-3">
                            <div className="flex items-center gap-3">
                                <Zap className="w-5 h-5 text-primary" />
                                <h3 className="font-display font-bold text-lg text-foreground">2. Store Activation Fee</h3>
                            </div>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                A one-time activation fee of <span className="text-primary font-bold">GHS 100.00</span> is required to activate your storefront for selling data bundles.
                            </p>
                            <div className="pt-4 border-t border-border/50 flex items-center justify-between">
                                <span className="text-xs text-muted-foreground font-medium">Payment Status:</span>
                                <span className={`font-bold text-sm uppercase ${store.activation_status === 'PAID' ? 'text-primary' : 'text-amber-500'}`}>
                                    {store.activation_status}
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Action Box if unpaid */}
                {store.activation_status !== 'PAID' && (
                    <Card className="bg-gradient-to-r from-card to-muted/40 border-primary/20 shadow-lg">
                        <CardContent className="p-6 flex flex-col sm:flex-row items-center justify-between gap-6">
                            <div className="space-y-1 text-center sm:text-left">
                                <h4 className="text-lg font-display font-bold text-foreground flex items-center gap-2 justify-center sm:justify-start">
                                    Complete Store Activation — GHS 100.00
                                </h4>
                                <p className="text-xs text-muted-foreground">Pay securely via Paystack to unlock your public storefront.</p>
                            </div>
                            <Button
                                onClick={handlePayNow}
                                disabled={isPayingNow}
                                className="px-6 py-6 font-display font-bold shadow-md flex items-center gap-2 text-sm"
                            >
                                {isPayingNow ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Redirecting...
                                    </>
                                ) : (
                                    <>
                                        Pay GHS 100.00 Now
                                        <ArrowRight className="w-4 h-4" />
                                    </>
                                )}
                            </Button>
                        </CardContent>
                    </Card>
                )}
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Header Banner */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-border/50 pb-6">
                <div className="flex items-center gap-6">
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                        <Store className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground tracking-tight">
                            Commission-Free Reseller Platform
                        </h1>
                        <p className="text-muted-foreground font-medium mt-1">
                            Launch Your Own Telecommunications Data-Selling Storefront
                        </p>
                    </div>
                </div>

                <div className="flex p-1 bg-muted/60 border border-border/50 rounded-2xl w-fit relative">
                    <div className="flex items-center gap-2 py-2.5 px-4 rounded-xl font-bold font-display bg-primary text-primary-foreground shadow-md text-xs uppercase tracking-wider">
                        <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                        Reseller Storefront
                    </div>
                </div>
            </div>

            {/* Sub-description banner */}
            <Card className="bg-card border-border overflow-hidden relative shadow-lg">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
                <CardContent className="p-6 relative z-10 space-y-2">
                    <h2 className="text-xl font-display font-bold text-foreground tracking-tight">
                        Power Your Own Data Business with ByteBeacon
                    </h2>
                    <p className="text-muted-foreground text-sm leading-relaxed font-medium">
                        ByteBeacon powers your backend infrastructure. You set your retail prices, market your custom brand URL, and earn 100% of your markup profit on every data bundle sold.
                    </p>
                </CardContent>
            </Card>

            {/* Features Highlight */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40 transition-all duration-300 shadow-md group">
                    <CardContent className="p-6 space-y-3">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
                            <DollarSign className="w-6 h-6 stroke-[2.5]" />
                        </div>
                        <h3 className="font-display font-bold text-foreground text-base">Markup-Only Model</h3>
                        <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                            No percentage deductions. You choose your retail markup price above ByteBeacon base cost and pocket the entire difference.
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-blue-500/5 border-blue-500/20 hover:border-blue-500/40 transition-all duration-300 shadow-md group">
                    <CardContent className="p-6 space-y-3">
                        <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 group-hover:scale-105 transition-transform">
                            <ShieldCheck className="w-6 h-6 stroke-[2.5]" />
                        </div>
                        <h3 className="font-display font-bold text-foreground text-base">Automated Fulfillment</h3>
                        <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                            Orders placed on your storefront are processed automatically by ByteBeacon's backend provider network. Zero manual effort required.
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-purple-500/5 border-purple-500/20 hover:border-purple-500/40 transition-all duration-300 shadow-md group">
                    <CardContent className="p-6 space-y-3">
                        <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 group-hover:scale-105 transition-transform">
                            <Zap className="w-6 h-6 stroke-[2.5]" />
                        </div>
                        <h3 className="font-display font-bold text-foreground text-base">Instant Profit Ledger</h3>
                        <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                            Earned profits are credited to your Agent Wallet instantly upon delivery and can be withdrawn directly to Mobile Money or Bank Account.
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Creation Form */}
            <Card className="bg-card border-border overflow-hidden shadow-lg">
                <CardHeader className="border-b border-border/50">
                    <CardTitle className="text-xl font-display font-bold text-foreground tracking-tight flex items-center gap-2">
                        <Store className="w-5 h-5 text-primary" />
                        Create Your Agent Store
                    </CardTitle>
                    <CardDescription className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest">
                        Complete your store details to submit your reseller application
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                    <form onSubmit={handleCreateStore} className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="storeName" className="text-[11px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-1">
                                Store Name <span className="text-primary">*</span>
                            </Label>
                            <Input
                                id="storeName"
                                type="text"
                                value={storeName}
                                onChange={(e) => setStoreName(e.target.value)}
                                placeholder="e.g. My Data Store"
                                required
                                className="bg-muted/50 border-border focus:border-primary/50 py-6 transition-all duration-300"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="description" className="text-[11px] font-black uppercase text-muted-foreground tracking-widest">
                                Store Description
                            </Label>
                            <Textarea
                                id="description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="e.g. Fast & affordable MTN, Telecel, and AirtelTigo data bundles in Ghana."
                                className="bg-muted/50 border-border focus:border-primary/50 min-h-[100px] transition-all duration-300"
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="phone" className="text-[11px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-1">
                                    Business Phone Number <span className="text-primary">*</span>
                                </Label>
                                <Input
                                    id="phone"
                                    type="text"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="024XXXXXXX"
                                    required
                                    className="bg-muted/50 border-border focus:border-primary/50 py-6 transition-all duration-300"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="logoUrl" className="text-[11px] font-black uppercase text-muted-foreground tracking-widest">
                                    Store Logo Image URL (Optional)
                                </Label>
                                <Input
                                    id="logoUrl"
                                    type="url"
                                    value={logoUrl}
                                    onChange={(e) => setLogoUrl(e.target.value)}
                                    placeholder="https://example.com/logo.png"
                                    className="bg-muted/50 border-border focus:border-primary/50 py-6 transition-all duration-300"
                                />
                            </div>
                        </div>

                        <div className="p-4 bg-muted/30 rounded-xl border border-border text-xs text-muted-foreground space-y-1 font-medium">
                            <p className="font-bold text-foreground">Store Activation Requirement:</p>
                            <p>Creation is free to submit for review. Activating your storefront for customer sales requires a one-time payment of <span className="text-primary font-bold">GHS 100.00</span> (Pay Now or Pay Later).</p>
                        </div>

                        <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full py-6 text-lg font-display font-bold flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Submitting Application...
                                </>
                            ) : (
                                <>
                                    Create Agent Store
                                    <ArrowRight className="w-5 h-5" />
                                </>
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {/* Post-Submit Modal */}
            {showSuccessModal && createdStore && (
                <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <Card className="bg-card border-border p-8 max-w-md w-full space-y-6 text-center shadow-2xl">
                        <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-primary mx-auto">
                            <CheckCircle2 className="w-8 h-8" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-xl font-display font-bold text-foreground">Store Submitted Successfully!</h3>
                            <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                                Your Agent Store <span className="text-foreground font-bold">{createdStore.store_name}</span> has been submitted for administrative review.
                            </p>
                        </div>
                        <div className="p-4 bg-muted/40 rounded-2xl border border-border space-y-1 text-left text-xs">
                            <div className="flex justify-between py-1">
                                <span className="text-muted-foreground font-medium">Review Status:</span>
                                <span className="text-blue-500 font-bold uppercase">Pending Review</span>
                            </div>
                            <div className="flex justify-between py-1">
                                <span className="text-muted-foreground font-medium">Activation Fee:</span>
                                <span className="text-primary font-bold">GHS 100.00</span>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <Button
                                onClick={handlePayNow}
                                className="w-full py-6 font-display font-bold text-sm"
                            >
                                Pay GHS 100.00 Now
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => setShowSuccessModal(false)}
                                className="w-full py-6 font-display font-bold text-sm"
                            >
                                Pay Later
                            </Button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
};

