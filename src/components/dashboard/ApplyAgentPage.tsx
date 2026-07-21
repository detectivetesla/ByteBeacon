import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserPlus, CheckCircle, Clock, Users, DollarSign, Code, Sparkles, ShieldCheck, Zap, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ApplyAgentPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [requestType, setRequestType] = useState<'agent' | 'superagent'>('agent');
    const [formData, setFormData] = useState({
        businessName: '',
        reason: '',
        experience: '',
    });
    const [walletBalance, setWalletBalance] = useState<number | null>(null);

    const AGENCY_FEE = requestType === 'superagent' ? 0.00 : 30.00;

    useEffect(() => {
        const fetchBalance = async () => {
            try {
                const response = await api.get<{ balance: number }>('/wallet/balance');
                setWalletBalance(response.balance);
            } catch (err) {
                console.error('Error fetching balance:', err);
            }
        };
        fetchBalance();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        if (walletBalance !== null && walletBalance < AGENCY_FEE) {
            toast({
                title: 'Insufficient Balance',
                description: `You need at least GHS ${AGENCY_FEE.toFixed(2)} in your wallet to apply.`,
                variant: 'destructive',
            });
            return;
        }

        setLoading(true);
        try {
            // Submit agent application via API
            const response = await api.post<{ message: string }>('/users/apply-agent', {
                businessName: formData.businessName,
                reason: formData.reason,
                experience: formData.experience,
                requestType,
            });

            toast({
                title: 'Application Submitted!',
                description: response.message || `Your ${requestType} application is being processed.`,
            });
            setSubmitted(true);
        } catch (err: any) {
            console.error('Error submitting application:', err);
            const errorMessage = err.response?.data?.error || err.message || '';

            toast({
                title: 'Application Failed',
                description: errorMessage,
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const sendAdminNotification = async () => {
        // This would typically call an Edge Function to send email
        // For now, we'll log it
        console.log('Email notification would be sent to: nomotsumartin@gmail.com');
        console.log('User requesting agentship:', user?.email);
    };

    const agentBenefits = [
        {
            icon: DollarSign,
            title: 'Discounted Prices',
            description: 'Get 10-15% off on all data bundles',
            color: 'text-emerald-500',
            bgColor: 'bg-emerald-500/10'
        },
        {
            icon: Code,
            title: 'Developer API',
            description: 'Access our API for automated purchases',
            color: 'text-blue-500',
            bgColor: 'bg-blue-500/10'
        },
        {
            icon: Users,
            title: 'Reseller Tools',
            description: 'Tools to manage your customers',
            color: 'text-amber-500',
            bgColor: 'bg-amber-500/10'
        },
    ];

    const superAgentBenefits = [
        {
            icon: Code,
            title: 'Custom API Portals',
            description: 'Deploy white-labeled portals for your downlines',
            color: 'text-purple-500',
            bgColor: 'bg-purple-500/10'
        },
        {
            icon: Sparkles,
            title: 'Balance Sharing',
            description: 'Share your main wallet balance across sub-accounts',
            color: 'text-pink-500',
            bgColor: 'bg-pink-500/10'
        },
        {
            icon: ShieldCheck,
            title: 'Dedicated SLA & Support',
            description: 'Priority queue with dedicated account manager',
            color: 'text-cyan-500',
            bgColor: 'bg-cyan-500/10'
        },
        {
            icon: Zap,
            title: 'Early Bird Beta',
            description: 'Apply for free during the pre-launch phase',
            color: 'text-amber-500',
            bgColor: 'bg-amber-500/10'
        }
    ];

    const benefits = requestType === 'superagent' ? superAgentBenefits : agentBenefits;

    if (submitted) {
        return (
            <div className="max-w-2xl mx-auto py-10">
                <Card className="border-primary/20 bg-card overflow-hidden relative shadow-lg">
                    {/* Decorative glow */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
                    <CardContent className="pt-16 pb-16 text-center relative z-10">
                        <div className="w-24 h-24 bg-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-inner transform rotate-12">
                            <CheckCircle className="w-12 h-12 text-emerald-500" />
                        </div>
                        <h2 className="text-3xl font-display font-bold text-foreground tracking-tight mb-4">
                            Application Submitted!
                        </h2>
                        <p className="text-muted-foreground mb-8 max-w-md mx-auto text-lg leading-relaxed">
                            Your <span className="text-foreground font-bold italic uppercase">{requestType}</span> application is now in our queue. Our team will review your credentials and get back to you within <span className="text-foreground font-bold italic">24-48 hours</span>.
                        </p>
                        <div className="flex items-center justify-center gap-3 py-3 px-6 bg-emerald-500/5 rounded-full border border-emerald-500/20 w-fit mx-auto animate-pulse">
                            <Clock className="w-5 h-5 text-emerald-500" />
                            <span className="text-sm font-bold text-emerald-500 tracking-wider">Estimated Review: 24-48 Hours</span>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Header & Tabs */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-border/50 pb-6">
                <div className="flex items-center gap-6">
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                        <UserPlus className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground tracking-tight">
                            Apply for Agency
                        </h1>
                        <p className="text-muted-foreground font-medium mt-1">
                            Unlock elite privileges, reseller pricing, and developer tools.
                        </p>
                    </div>
                </div>

                {/* Sliding Tab Selector */}
                <div className="flex p-1 bg-muted/60 border border-border/50 rounded-2xl max-w-sm w-full md:w-auto relative">
                    <button
                        type="button"
                        onClick={() => setRequestType('agent')}
                        className={cn(
                            "flex-1 md:flex-initial flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-bold font-display transition-all duration-300 relative text-xs uppercase tracking-wider",
                            requestType === 'agent'
                                ? "bg-primary text-primary-foreground shadow-md"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                        )}
                    >
                        <Zap className="w-3.5 h-3.5" />
                        Agent
                    </button>
                    <button
                        type="button"
                        onClick={() => setRequestType('superagent')}
                        className={cn(
                            "flex-1 md:flex-initial flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-bold font-display transition-all duration-300 relative text-xs uppercase tracking-wider pr-14",
                            requestType === 'superagent'
                                ? "bg-primary text-primary-foreground shadow-md"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                        )}
                    >
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        SuperAgent
                        <span className="absolute right-2 bg-gradient-to-r from-amber-500 to-orange-500 text-[7px] font-black text-white px-1.5 py-0.5 rounded-full border border-background shadow-lg scale-90 animate-pulse">
                            SOON
                        </span>
                    </button>
                </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
                {/* Benefits */}
                <div className="lg:col-span-1 space-y-4">
                    <h3 className="font-bold text-foreground flex items-center gap-2 tracking-tight uppercase text-xs">
                        <Sparkles className="w-4 h-4 text-emerald-500" />
                        {requestType === 'superagent' ? 'SuperAgent Benefits' : 'Agent Privileges'}
                    </h3>
                    <div className="grid grid-cols-1 gap-3">
                        {benefits.map((benefit, index) => (
                            <Card key={index} className={cn(
                                "bg-card border-border transition-all duration-300 hover:shadow-md group cursor-default",
                                benefit.color.replace('text-', 'hover:border-').replace('-500', '-500/30')
                            )}>
                                <CardContent className="p-4">
                                    <div className="flex items-start gap-4">
                                        <div className={cn(
                                            "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300",
                                            benefit.bgColor
                                        )}>
                                            <benefit.icon className={cn("w-5 h-5", benefit.color)} />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-foreground tracking-tight text-sm uppercase italic">{benefit.title}</h4>
                                            <p className="text-xs text-muted-foreground font-medium">{benefit.description}</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    <Card className="bg-emerald-500/5 border-emerald-500/20 mt-6 overflow-hidden relative">
                        {/* Status chip */}
                        <div className="absolute -right-8 -top-8 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl" />
                        <CardContent className="p-4 relative z-10">
                            <div className="flex items-center gap-2 mb-2">
                                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                                <span className="text-[10px] font-black uppercase text-emerald-500 tracking-widest">Verified Program</span>
                            </div>
                            <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                                Join our network of thousands of successful agents across Ghana.
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Application Form */}
                <Card className="lg:col-span-2 bg-card border-border overflow-hidden group shadow-lg">
                    <CardHeader className="border-b border-border/50">
                        <CardTitle className="text-lg font-display font-bold text-foreground tracking-tight flex items-center gap-2">
                            {requestType === 'superagent' ? (
                                <>
                                    <Sparkles className="w-5 h-5 text-amber-500" />
                                    SuperAgent Application
                                </>
                            ) : (
                                <>
                                    <Zap className="w-5 h-5 text-primary" />
                                    Agent Application Form
                                </>
                            )}
                        </CardTitle>
                        <CardDescription className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest">
                            {requestType === 'superagent' ? 'Submit early-bird application (Free)' : 'Secure your agent credentials below'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-6">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-4">
                                {requestType === 'superagent' && (
                                    <div className="p-4 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl text-purple-300 text-sm flex flex-col gap-2 relative overflow-hidden animate-in slide-in-from-top-2">
                                        <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full blur-xl pointer-events-none" />
                                        <div className="flex items-center gap-2 font-bold uppercase text-[10px] tracking-widest text-purple-400">
                                            <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
                                            SuperAgent Program Coming Soon
                                        </div>
                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                            The SuperAgent tier is launching soon! Apply today for GH₵ 0.00 (Early Bird Beta) to lock in your priority spot. Your request will be reviewed by the admin, and approved profiles will activate automatically on launch.
                                        </p>
                                    </div>
                                )}

                                <div className="bg-primary/10 border border-primary/20 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-6 relative overflow-hidden">
                                    <div className="flex items-center gap-4 relative z-10">
                                        <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center">
                                            <DollarSign className="w-7 h-7 text-primary" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Application Fee</p>
                                            <p className="text-3xl font-display font-bold text-foreground tracking-tight">GH₵ {AGENCY_FEE.toFixed(2)}</p>
                                        </div>
                                    </div>
                                    <div className="text-center sm:text-right bg-muted/50 p-3 px-6 rounded-2xl relative z-10 border border-border">
                                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Your Balance</p>
                                        <p className={cn(
                                            "text-lg font-display font-bold tracking-tight",
                                            walletBalance !== null && walletBalance < AGENCY_FEE ? 'text-destructive' : 'text-primary'
                                        )}>
                                            GH₵ {walletBalance?.toFixed(2) || '0.00'}
                                        </p>
                                    </div>
                                </div>

                                {walletBalance !== null && walletBalance < AGENCY_FEE && (
                                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-3 animate-in slide-in-from-top-2">
                                        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                                        <span className="font-medium">Insufficient balance to proceed. <a href="/dashboard/wallet" className="font-black underline ml-1 hover:text-red-300 transition-colors uppercase text-xs">Top up now →</a></span>
                                    </div>
                                )}
                            </div>

                            <div className="p-4 bg-muted/20 border border-border rounded-xl">
                                <p className="text-[11px] text-muted-foreground italic font-medium leading-relaxed">
                                    <span className="text-emerald-500 font-black uppercase not-italic mr-2">Note:</span>
                                    {requestType === 'superagent'
                                        ? 'The SuperAgent Early Bird application is free. No amount will be deducted from your wallet.'
                                        : 'The application fee is non-refundable and will be deducted from your wallet balance upon submission to secure your agent status.'
                                    }
                                </p>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="businessName" className="text-[11px] font-black uppercase text-muted-foreground tracking-widest">Business Name (Optional)</Label>
                                    <Input
                                        id="businessName"
                                        placeholder="Enter your business/shop name"
                                        className="bg-muted/50 border-border focus:border-emerald-500/50 py-6 transition-all duration-300"
                                        value={formData.businessName}
                                        onChange={(e) => setFormData(prev => ({ ...prev, businessName: e.target.value }))}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="reason" className="text-[11px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                                        Reason for Application <span className="text-emerald-500">*</span>
                                    </Label>
                                    <Textarea
                                        id="reason"
                                        placeholder={requestType === 'superagent'
                                            ? "Why are you interested in becoming a SuperAgent? E.g., API client base, downline network, etc."
                                            : "Why should we appoint you as an agent? Tell us your vision..."
                                        }
                                        className="bg-muted/50 border-border focus:border-emerald-500/50 min-h-[100px] transition-all duration-300"
                                        required
                                        value={formData.reason}
                                        onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="experience" className="text-[11px] font-black uppercase text-muted-foreground tracking-widest">Relevant Experience (Optional)</Label>
                                    <Textarea
                                        id="experience"
                                        placeholder="E.g., MoMo merchant, data vendor, POS operator..."
                                        className="bg-muted/50 border-border focus:border-emerald-500/50 min-h-[100px] transition-all duration-300"
                                        value={formData.experience}
                                        onChange={(e) => setFormData(prev => ({ ...prev, experience: e.target.value }))}
                                    />
                                </div>
                            </div>

                            <div className="pt-4">
                                <Button
                                    type="submit"
                                    className="w-full py-8 text-xl font-display font-bold"
                                    disabled={loading || (walletBalance !== null && walletBalance < AGENCY_FEE)}
                                >
                                    <div className="flex items-center justify-center gap-3">
                                        {loading ? (
                                            <>
                                                <Loader2 className="w-6 h-6 animate-spin" />
                                                Processing Application...
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles className="w-6 h-6 animate-pulse" />
                                                {requestType === 'superagent' ? 'Submit SuperAgent Application' : 'Secure Agency Status'}
                                            </>
                                        )}
                                    </div>
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
