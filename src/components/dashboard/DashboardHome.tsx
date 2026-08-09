import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { walletService, transactionService, bundleService } from '@/services';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Wallet,
    ShoppingCart,
    Clock,
    CheckCircle,
    TrendingUp,
    TrendingDown,
    Filter,
    RefreshCw,
    FileText,
    CreditCard,
    Plus,
    ArrowRight,
    Package,
    Zap,
    AlertTriangle,
    Shield,
    Truck,
    Info,
    Check,
    X,
    Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import PortalStatusCard from './PortalStatusCard';
import { useToast } from '@/hooks/use-toast';

interface Transaction {
    id: string;
    recipient_phone: string;
    amount_ghc: number;
    status: string;
    created_at: string;
    data_bundles?: {
        network: string;
        data_amount: string;
    };
}

interface Bundle {
    id: string;
    network: string;
    dataAmount: string;
    priceGhc: number;
    agentPriceGhc?: number;
}

interface NetworkStats {
    mtn: number;
    telecel: number;
    airteltigo: number;
}

export default function DashboardHome() {
    const { user, role } = useAuth();
    const { toast } = useToast();
    const [greeting, setGreeting] = useState('');
    const [userName, setUserName] = useState('');
    const [walletBalance, setWalletBalance] = useState(0);
    const [stats, setStats] = useState({
        totalOrders: 0,
        pendingOrders: 0,
        completedOrders: 0,
    });
    const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
    const [networkStats, setNetworkStats] = useState<NetworkStats>({ mtn: 0, telecel: 0, airteltigo: 0 });
    const [topBundles, setTopBundles] = useState<Bundle[]>([]);
    const [bundlesLoading, setBundlesLoading] = useState(true);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

    useEffect(() => {
        const hour = new Date().getHours();
        if (hour < 12) {
            setGreeting('Good morning');
        } else if (hour < 17) {
            setGreeting('Good afternoon');
        } else {
            setGreeting('Good evening');
        }
    }, []);

    const fetchUserData = useCallback(async () => {
        if (!user) return;

        try {
            const data = await walletService.getBalance();
            setWalletBalance(data.balance || 0);
            const firstName = user.fullName?.split(' ')[0] || 'User';
            setUserName(firstName);
        } catch (err) {
            console.error('Error fetching user data:', err);
            setUserName(user.fullName?.split(' ')[0] || 'User');
        }
        setLoading(false);
    }, [user]);

    const fetchStats = useCallback(async () => {
        if (!user) return;

        try {
            const transactions = await transactionService.getAll();
            setStats({
                totalOrders: transactions.length,
                pendingOrders: transactions.filter(t => t.status === 'processing' || t.status === 'ongoing' || t.status === 'queued').length,
                completedOrders: transactions.filter(t => t.status === 'completed').length,
            });

            // Calculate network distribution
            if (transactions.length > 0) {
                const total = transactions.length;
                const mtn = transactions.filter(t => t.network?.toUpperCase() === 'MTN').length;
                const telecel = transactions.filter(t => t.network?.toUpperCase() === 'TELECEL').length;
                const airteltigo = transactions.filter(t => t.network?.toUpperCase() === 'AIRTELTIGO' || t.network?.toUpperCase() === 'AT').length;

                setNetworkStats({
                    mtn: Math.round((mtn / total) * 100),
                    telecel: Math.round((telecel / total) * 100),
                    airteltigo: Math.round((airteltigo / total) * 100),
                });
            }
        } catch (err) {
            console.error('Error fetching stats:', err);
        }
    }, [user]);

    const fetchRecentTransactions = useCallback(async () => {
        if (!user) return;

        try {
            const data = await transactionService.getAll();
            const recentData = data.slice(0, 5).map(tx => ({
                id: tx.id,
                recipient_phone: tx.recipientPhone,
                amount_ghc: tx.amount,
                status: tx.status,
                created_at: tx.createdAt,
                updated_at: tx.updatedAt,
                data_bundles: {
                    network: tx.network,
                    data_amount: tx.dataAmount,
                },
            }));
            setRecentTransactions(recentData);
        } catch (err) {
            console.error('Error fetching transactions:', err);
        }
    }, [user]);

    const lastOrder = recentTransactions[0];

    const getIsOutsideWorkingHours = (dateString: string) => {
        const date = new Date(dateString);
        const hours = date.getHours();
        return hours < 7 || hours >= 22;
    };

    const isQueued = lastOrder ? (
        lastOrder.status === 'queued' || 
        (['processing', 'ongoing', 'pending'].includes(lastOrder.status) && getIsOutsideWorkingHours(lastOrder.created_at))
    ) : false;

    useEffect(() => {
        if (!lastOrder) return;
        
        const calculateElapsed = () => {
            const start = new Date(lastOrder.created_at).getTime();
            const now = new Date().getTime();
            const diff = Math.max(0, Math.floor((now - start) / 1000));
            setElapsedSeconds(diff);
        };

        calculateElapsed();
        
        // Only run interval if order is in an active processing state
        const isActive = ['processing', 'ongoing', 'queued', 'pending'].includes(lastOrder.status);
        if (!isActive) return;

        const interval = setInterval(calculateElapsed, 1000);
        return () => clearInterval(interval);
    }, [lastOrder]);

    const formatElapsed = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const getDuration = () => {
        if (!lastOrder || !lastOrder.updated_at) return '';
        const start = new Date(lastOrder.created_at).getTime();
        const end = new Date(lastOrder.updated_at).getTime();
        const diffSeconds = Math.max(0, Math.floor((end - start) / 1000));
        if (diffSeconds < 60) {
            return `${diffSeconds}s`;
        }
        const mins = Math.floor(diffSeconds / 60);
        const secs = diffSeconds % 60;
        return `${mins}m ${secs}s`;
    };

    const handleSync = async (id: string) => {
        setSyncing(true);
        try {
            const res = await transactionService.sync(id);
            toast({
                title: res.synced ? "Status Synced" : "Status Checked",
                description: res.message,
                variant: "default"
            });
            // Refresh dashboard data
            await Promise.all([
                fetchUserData(),
                fetchStats(),
                fetchRecentTransactions(),
            ]);
        } catch (err: any) {
            console.error('Error syncing order status:', err);
            toast({
                title: "Sync Failed",
                description: err.error || "Failed to update order status.",
                variant: "destructive"
            });
        } finally {
            setSyncing(false);
        }
    };

    const fetchTopBundles = useCallback(async () => {
        if (role !== 'agent' && role !== 'superagent') {
            setBundlesLoading(false);
            return;
        }

        try {
            const bundles = await bundleService.getAll();
            // Get top 5 bundles sorted by popularity (price as proxy)
            const top = bundles
                .filter(b => b.isActive)
                .sort((a, b) => b.priceGhc - a.priceGhc)
                .slice(0, 5);
            setTopBundles(top);
        } catch (err) {
            console.error('Error fetching bundles:', err);
        } finally {
            setBundlesLoading(false);
        }
    }, [role]);

    useEffect(() => {
        if (user) {
            fetchUserData();
            fetchStats();
            fetchRecentTransactions();
            fetchTopBundles();
        }
    }, [user, fetchUserData, fetchStats, fetchRecentTransactions, fetchTopBundles]);

    const networks = [
        { id: 'mtn', name: 'MTN Data', color: 'bg-yellow-400', textColor: 'text-black', logo: '/mtn-logo.png', href: '/dashboard/bundles/mtn' },
        { id: 'telecel', name: 'Telecel', color: 'bg-red-500', textColor: 'text-white', logo: '/telecel-logo.png', href: '/dashboard/bundles/telecel' },
        { id: 'airteltigo', name: 'AirtelTigo', color: 'bg-blue-600', textColor: 'text-white', logo: '/airteltigo-logo.png', href: '/dashboard/bundles/airteltigo' },
    ];

    const quickActions = [
        { icon: ShoppingCart, label: 'New Order', color: 'bg-primary', href: '/dashboard/bundles/mtn' },
        { icon: TrendingUp, label: 'Reports', color: 'bg-yellow-500', href: '/dashboard/transactions' },
        { icon: CreditCard, label: 'Credit', color: 'bg-blue-500', href: '/dashboard/wallet' },
    ];

    if (loading) {
        return (
            <div className="space-y-4 md:space-y-6">
                {/* Header Skeleton */}
                <div className="flex flex-col gap-4">
                    <div className="space-y-2">
                        <Skeleton className="h-8 w-72 rounded-xl" />
                        <Skeleton className="h-4 w-56 rounded-lg" />
                    </div>
                    <div className="flex gap-2">
                        <Skeleton className="h-9 w-28 rounded-lg" />
                        <Skeleton className="h-9 w-28 rounded-lg" />
                    </div>
                </div>

                {/* Portal Status Skeleton */}
                <Skeleton className="h-20 w-full rounded-2xl" />

                {/* Stats Cards Skeleton */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                    {[0, 1, 2, 3].map(i => (
                        <Card key={i} variant="spatial" className="border-border/30">
                            <CardContent className="p-4 md:p-6">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-2">
                                        <Skeleton className="h-3 w-20 rounded" />
                                        <Skeleton className="h-8 w-24 rounded" />
                                        <Skeleton className="h-3 w-14 rounded" />
                                    </div>
                                    <Skeleton className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl" />
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Important Notices Skeleton */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                    {[0, 1, 2, 3].map(i => (
                        <div key={i} className="flex items-start gap-4 p-5 rounded-2xl border border-border/30">
                            <Skeleton className="w-10 h-10 rounded-lg flex-shrink-0" />
                            <div className="space-y-2 flex-1">
                                <Skeleton className="h-4 w-28 rounded" />
                                <Skeleton className="h-3 w-36 rounded" />
                                <Skeleton className="h-3 w-44 rounded" />
                            </div>
                        </div>
                    ))}
                </div>

                {/* Orders Overview & Recent Skeleton */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
                    <Card className="lg:col-span-2">
                        <CardHeader>
                            <Skeleton className="h-5 w-36 rounded" />
                            <Skeleton className="h-3 w-48 rounded" />
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-3 gap-3">
                                {[0, 1, 2].map(i => (
                                    <Skeleton key={i} className="h-20 rounded-xl" />
                                ))}
                            </div>
                            <Skeleton className="h-32 w-full rounded-xl" />
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <Skeleton className="h-5 w-36 rounded" />
                            <Skeleton className="h-3 w-44 rounded" />
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {[0, 1, 2, 3, 4].map(i => (
                                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-muted/20">
                                    <div className="flex items-center gap-3">
                                        <Skeleton className="w-8 h-8 rounded-lg" />
                                        <div className="space-y-1">
                                            <Skeleton className="h-4 w-24 rounded" />
                                            <Skeleton className="h-3 w-16 rounded" />
                                        </div>
                                    </div>
                                    <Skeleton className="h-4 w-16 rounded" />
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4 md:space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4">
                <div>
                    <h1 className="font-display text-xl sm:text-2xl md:text-3xl font-bold">
                        {greeting}, {userName}! 👋
                    </h1>
                    <p className="text-muted-foreground text-sm sm:text-base">
                        Welcome back to your dealer dashboard.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" className="gap-2 text-xs sm:text-sm">
                        <FileText className="w-4 h-4" />
                        <span className="hidden xs:inline">Export</span> Report
                    </Button>
                    <Link to="/dashboard/bundles/mtn">
                        <Button size="sm" className="gap-2 text-xs sm:text-sm">
                            <Plus className="w-4 h-4" />
                            New Order
                        </Button>
                    </Link>
                </div>
            </div>

            <PortalStatusCard />

            {/* Live Order Tracker */}
            {lastOrder && (
                <Card variant="spatial" className="border-primary/20 bg-gradient-to-br from-card/60 to-card/40 backdrop-blur-md shadow-lg shadow-primary/5 hover:border-primary/30 transition-all duration-300">
                    <CardContent className="p-4 md:p-6 space-y-4">
                        {/* Header / Info Row */}
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            <div>
                                <span className="text-[10px] font-bold tracking-wider uppercase bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                    Live Order Tracker
                                </span>
                                <h3 className="font-display font-bold text-base sm:text-lg mt-1 flex items-center gap-2">
                                    <span className={cn(
                                        "w-2.5 h-2.5 rounded-full",
                                        ['processing', 'ongoing', 'queued', 'pending'].includes(lastOrder.status) ? "bg-amber-500 animate-pulse" :
                                        lastOrder.status === 'completed' ? "bg-green-500" : "bg-red-500"
                                    )} />
                                    {lastOrder.data_bundles?.data_amount} {lastOrder.data_bundles?.network} Order
                                </h3>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Recipient: <span className="font-mono font-medium">{lastOrder.recipient_phone}</span> • Price: <span className="font-medium">₵{lastOrder.amount_ghc.toFixed(2)}</span>
                                </p>
                            </div>
                            
                            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                                {['processing', 'ongoing', 'queued', 'pending'].includes(lastOrder.status) && (
                                    <div className="flex items-center gap-1.5 bg-muted/60 px-3 py-1 rounded-full text-xs font-medium border border-border/40">
                                        <Clock className="w-3.5 h-3.5 text-amber-500 animate-spin" style={{ animationDuration: '3s' }} />
                                        <span>Elapsed: {formatElapsed(elapsedSeconds)}</span>
                                    </div>
                                )}
                                {lastOrder.status === 'completed' && lastOrder.updated_at && (
                                    <div className="flex items-center gap-1.5 bg-green-500/10 text-green-600 dark:text-green-400 px-3 py-1 rounded-full text-xs font-medium border border-green-500/20">
                                        <Check className="w-3.5 h-3.5" />
                                        <span>Delivered in {getDuration()}</span>
                                    </div>
                                )}
                                {lastOrder.status === 'failed' && (
                                    <div className="flex items-center gap-1.5 bg-red-500/10 text-red-600 dark:text-red-400 px-3 py-1 rounded-full text-xs font-medium border border-red-500/20">
                                        <X className="w-3.5 h-3.5" />
                                        <span>Failed</span>
                                    </div>
                                )}
                                
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => handleSync(lastOrder.id)}
                                    disabled={syncing || !['processing', 'ongoing', 'queued', 'pending'].includes(lastOrder.status)}
                                    className="gap-2 text-xs h-8 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)] hover:scale-[1.03] active:scale-[0.97]"
                                >
                                    {syncing ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <RefreshCw className="w-3.5 h-3.5" />
                                    )}
                                    Sync Status
                                </Button>
                            </div>
                        </div>

                        {/* Stepper Timeline */}
                        <div className="pt-2">
                            {/* Desktop Stepper (Horizontal) */}
                            <div className="hidden md:grid grid-cols-4 relative">
                                {/* Progress Connecting Line */}
                                <div className="absolute top-4 left-[12.5%] right-[12.5%] h-0.5 bg-muted -translate-y-1/2 z-0">
                                    <div 
                                        className="h-full bg-gradient-to-r from-green-500 via-primary to-primary transition-all duration-700 ease-in-out"
                                        style={{ 
                                            width: lastOrder.status === 'completed' ? '100%' :
                                                   lastOrder.status === 'failed' ? '100%' :
                                                   isQueued ? '33.3%' : '66.6%'
                                        }}
                                    />
                                </div>

                                {/* Step 1: Placed */}
                                <div className="flex flex-col items-center text-center z-10">
                                    <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center font-bold text-xs ring-4 ring-background shadow-md">
                                        <Check className="w-4 h-4" />
                                    </div>
                                    <p className="text-xs font-semibold mt-2">Order Placed</p>
                                    <p className="text-[10px] text-muted-foreground">{new Date(lastOrder.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                </div>

                                {/* Step 2: Queue Validation */}
                                <div className="flex flex-col items-center text-center z-10">
                                    {lastOrder.status === 'completed' || lastOrder.status === 'failed' || (!isQueued && ['processing', 'ongoing', 'pending'].includes(lastOrder.status)) ? (
                                        <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center font-bold text-xs ring-4 ring-background shadow-md">
                                            <Check className="w-4 h-4" />
                                        </div>
                                    ) : isQueued ? (
                                        <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-xs ring-4 ring-background shadow-md animate-pulse">
                                            <Clock className="w-4 h-4" />
                                        </div>
                                    ) : (
                                        <div className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center font-bold text-xs ring-4 ring-background">
                                            2
                                        </div>
                                    )}
                                    <p className="text-xs font-semibold mt-2">Queue Validation</p>
                                    <p className="text-[10px] text-muted-foreground">
                                        {isQueued ? 'Queued Offline' : 'Passed'}
                                    </p>
                                </div>

                                {/* Step 3: Gateway Processing */}
                                <div className="flex flex-col items-center text-center z-10">
                                    {lastOrder.status === 'completed' || lastOrder.status === 'failed' ? (
                                        <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center font-bold text-xs ring-4 ring-background shadow-md">
                                            <Check className="w-4 h-4" />
                                        </div>
                                    ) : !isQueued && ['processing', 'ongoing', 'pending'].includes(lastOrder.status) ? (
                                        <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xs ring-4 ring-background shadow-md animate-pulse">
                                            <Zap className="w-4 h-4" />
                                        </div>
                                    ) : (
                                        <div className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center font-bold text-xs ring-4 ring-background">
                                            3
                                        </div>
                                    )}
                                    <p className="text-xs font-semibold mt-2">Gateway Processing</p>
                                    <p className="text-[10px] text-muted-foreground">
                                        {['processing', 'ongoing', 'pending'].includes(lastOrder.status) && !isQueued ? 'Active Pulse' : 
                                         lastOrder.status === 'completed' || lastOrder.status === 'failed' ? 'Completed' : 'Pending'}
                                    </p>
                                </div>

                                {/* Step 4: Delivery */}
                                <div className="flex flex-col items-center text-center z-10">
                                    {lastOrder.status === 'completed' ? (
                                        <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center font-bold text-xs ring-4 ring-background shadow-md">
                                            <Check className="w-4 h-4" />
                                        </div>
                                    ) : lastOrder.status === 'failed' ? (
                                        <div className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center font-bold text-xs ring-4 ring-background shadow-md">
                                            <X className="w-4 h-4" />
                                        </div>
                                    ) : (
                                        <div className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center font-bold text-xs ring-4 ring-background">
                                            4
                                        </div>
                                    )}
                                    <p className="text-xs font-semibold mt-2">Delivery Status</p>
                                    <p className="text-[10px] text-muted-foreground">
                                        {lastOrder.status === 'completed' ? 'Delivered' : 
                                         lastOrder.status === 'failed' ? 'Failed' : 'Pending'}
                                    </p>
                                </div>
                            </div>

                            {/* Mobile Stepper (Vertical) */}
                            <div className="md:hidden space-y-4 pl-2 relative before:absolute before:left-5 before:top-2 before:bottom-2 before:w-0.5 before:bg-muted">
                                {/* Step 1: Placed */}
                                <div className="flex items-start gap-4 relative">
                                    <div className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center font-bold text-[10px] ring-4 ring-background z-10">
                                        <Check className="w-3 h-3" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold">Order Placed</p>
                                        <p className="text-[10px] text-muted-foreground">{new Date(lastOrder.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                    </div>
                                </div>

                                {/* Step 2: Queue Validation */}
                                <div className="flex items-start gap-4 relative">
                                    {lastOrder.status === 'completed' || lastOrder.status === 'failed' || (!isQueued && ['processing', 'ongoing', 'pending'].includes(lastOrder.status)) ? (
                                        <div className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center font-bold text-[10px] ring-4 ring-background z-10">
                                            <Check className="w-3 h-3" />
                                        </div>
                                    ) : isQueued ? (
                                        <div className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-[10px] ring-4 ring-background z-10 animate-pulse">
                                            <Clock className="w-3 h-3" />
                                        </div>
                                    ) : (
                                        <div className="w-6 h-6 rounded-full bg-muted text-muted-foreground flex items-center justify-center font-bold text-[10px] ring-4 ring-background z-10">
                                            2
                                        </div>
                                    )}
                                    <div>
                                        <p className="text-xs font-semibold">Queue Validation</p>
                                        <p className="text-[10px] text-muted-foreground">
                                            {isQueued ? 'Queued Offline' : 'Passed'}
                                        </p>
                                    </div>
                                </div>

                                {/* Step 3: Gateway Processing */}
                                <div className="flex items-start gap-4 relative">
                                    {lastOrder.status === 'completed' || lastOrder.status === 'failed' ? (
                                        <div className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center font-bold text-[10px] ring-4 ring-background z-10">
                                            <Check className="w-3 h-3" />
                                        </div>
                                    ) : !isQueued && ['processing', 'ongoing', 'pending'].includes(lastOrder.status) ? (
                                        <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center font-bold text-[10px] ring-4 ring-background z-10 animate-pulse">
                                            <Zap className="w-3 h-3" />
                                        </div>
                                    ) : (
                                        <div className="w-6 h-6 rounded-full bg-muted text-muted-foreground flex items-center justify-center font-bold text-[10px] ring-4 ring-background z-10">
                                            3
                                        </div>
                                    )}
                                    <div>
                                        <p className="text-xs font-semibold">Gateway Processing</p>
                                        <p className="text-[10px] text-muted-foreground">
                                            {['processing', 'ongoing', 'pending'].includes(lastOrder.status) && !isQueued ? 'Active Pulse' : 
                                             lastOrder.status === 'completed' || lastOrder.status === 'failed' ? 'Completed' : 'Pending'}
                                        </p>
                                    </div>
                                </div>

                                {/* Step 4: Delivery */}
                                <div className="flex items-start gap-4 relative">
                                    {lastOrder.status === 'completed' ? (
                                        <div className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center font-bold text-[10px] ring-4 ring-background z-10">
                                            <Check className="w-3 h-3" />
                                        </div>
                                    ) : lastOrder.status === 'failed' ? (
                                        <div className="w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center font-bold text-[10px] ring-4 ring-background z-10">
                                            <X className="w-3.5 h-3.5" />
                                        </div>
                                    ) : (
                                        <div className="w-6 h-6 rounded-full bg-muted text-muted-foreground flex items-center justify-center font-bold text-[10px] ring-4 ring-background z-10">
                                            4
                                        </div>
                                    )}
                                    <div>
                                        <p className="text-xs font-semibold">Delivery Status</p>
                                        <p className="text-[10px] text-muted-foreground">
                                            {lastOrder.status === 'completed' ? 'Delivered' : 
                                             lastOrder.status === 'failed' ? 'Failed' : 'Pending'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Dynamic Warnings / Notices */}
                        {isQueued && (
                            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs animate-in fade-in slide-in-from-top-1 duration-300">
                                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                <div>
                                    <span className="font-semibold">Queue Notice:</span> Placed outside working hours (7 AM - 10 PM) and will be processed next morning.
                                </div>
                            </div>
                        )}
                        
                        {['processing', 'ongoing', 'pending'].includes(lastOrder.status) && !isQueued && elapsedSeconds > 120 && (
                            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-600 dark:text-orange-400 text-xs animate-in fade-in slide-in-from-top-1 duration-300 animate-pulse">
                                <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                <div>
                                    <span className="font-semibold">Delay Notice:</span> Gateway processing is taking longer than 2 minutes. Retrying...
                                </div>
                            </div>
                        )}
                        
                        {lastOrder.status === 'failed' && (
                            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs animate-in fade-in slide-in-from-top-1 duration-300">
                                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                <div>
                                    <span className="font-semibold">Failure Notice:</span> Refunded to wallet.
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}


            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                <Link to="/dashboard/wallet" className="block">
                    <Card variant="spatial" className={cn(
                        "bg-primary/5 border-primary/20 h-full",
                        "hover:border-primary/40"
                    )}>
                        <CardContent className="p-4 md:p-6">
                            <div className="flex items-center justify-between">
                                <div className="min-w-0">
                                    <p className="text-[10px] tracking-wider uppercase text-muted-foreground/80 truncate">Wallet Balance</p>
                                    <p className="font-display text-xl sm:text-2xl md:text-3xl font-extrabold text-primary tracking-tight truncate">
                                        ₵{walletBalance.toFixed(2)}
                                    </p>
                                </div>
                                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                                    <Wallet className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </Link>

                <Link to="/dashboard/orders" className="block">
                    <Card variant="spatial" className={cn(
                        "bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/30 h-full",
                        "hover:border-blue-500/50"
                    )}>
                        <CardContent className="p-4 md:p-6">
                            <div className="flex items-center justify-between">
                                <div className="min-w-0">
                                    <p className="text-[10px] tracking-wider uppercase text-muted-foreground/80 truncate">Total Orders</p>
                                    <p className="font-display text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight">{stats.totalOrders}</p>
                                    <p className="text-xs text-green-500 flex items-center gap-1 mt-1">
                                        <TrendingUp className="w-3 h-3" />
                                        <span className="hidden sm:inline">+8.2%</span>
                                    </p>
                                </div>
                                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                                    <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </Link>

                <Link to="/dashboard/orders" className="block">
                    <Card variant="spatial" className={cn(
                        "bg-gradient-to-br from-amber-500/10 to-orange-500/5 border-amber-500/30 h-full",
                        "hover:border-amber-500/50"
                    )}>
                        <CardContent className="p-4 md:p-6">
                            <div className="flex items-center justify-between">
                                <div className="min-w-0">
                                    <p className="text-[10px] tracking-wider uppercase text-muted-foreground/80 truncate">Processing</p>
                                    <p className="font-display text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight">{stats.pendingOrders}</p>
                                    <p className="text-xs text-amber-500 flex items-center gap-1 mt-1">
                                        <Clock className="w-3 h-3" />
                                        <span className="hidden sm:inline">Processing</span>
                                    </p>
                                </div>
                                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                                    <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </Link>

                <Link to="/dashboard/orders/completed" className="block">
                    <Card variant="spatial" className={cn(
                        "bg-primary/5 border-primary/20 h-full",
                        "hover:border-primary/40 group"
                    )}>
                        <CardContent className="p-4 md:p-6">
                            <div className="flex items-center justify-between">
                                <div className="min-w-0">
                                    <p className="text-[10px] tracking-wider uppercase text-muted-foreground/80 truncate">Completed</p>
                                    <p className="font-display text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight">{stats.completedOrders}</p>
                                    <p className="text-xs text-green-500 flex items-center gap-1 mt-1">
                                        <TrendingUp className="w-3 h-3" />
                                        <span className="hidden sm:inline">+15.6%</span>
                                    </p>
                                </div>
                                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0 group-hover:rotate-6 transition-transform">
                                    <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-500" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </Link>
            </div>


            {/* Important Notices Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                {/* Working Hours */}
                <div className="flex items-start gap-4 p-5 clay-card-emerald group hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                        <Clock className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                        <p className="font-bold text-emerald-700 dark:text-emerald-400">Working Hours</p>
                        <p className="text-sm text-muted-foreground font-medium">7:00 AM - 10:00 PM daily</p>
                        <p className="text-xs text-muted-foreground/80 mt-1">Orders outside hours processed next day</p>
                    </div>
                </div>

                {/* Delivery Time */}
                <div className="flex items-start gap-4 p-5 clay-card-blue group hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                        <Truck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                        <p className="font-bold text-blue-700 dark:text-blue-400">Delivery Time</p>
                        <p className="text-sm text-muted-foreground font-medium">10 minutes - 2 hours</p>
                        <p className="text-xs text-muted-foreground/80 mt-1">During peak hours may take longer</p>
                    </div>
                </div>

                {/* Transaction Warning */}
                <div className="flex items-start gap-4 p-5 clay-card-amber group hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
                    <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                        <p className="font-bold text-amber-700 dark:text-amber-400">Transaction Notice</p>
                        <p className="text-sm text-muted-foreground font-medium">All purchases are non-refundable</p>
                        <p className="text-xs text-muted-foreground/80 mt-1">Double-check phone number before paying</p>
                    </div>
                </div>

                {/* Security Tips */}
                <div className="flex items-start gap-4 p-5 clay-card-purple group hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                        <Shield className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                        <p className="font-bold text-purple-700 dark:text-purple-400">Security Tips</p>
                        <p className="text-sm text-muted-foreground font-medium">Never share your login details</p>
                        <p className="text-xs text-muted-foreground/80 mt-1">Use a strong password</p>
                    </div>
                </div>
            </div>


            {/* Orders Overview & Recent Deposits */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
                {/* Orders Overview Chart */}
                <Card className="lg:col-span-2 bg-gradient-to-br from-card to-card/80">
                    <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4">
                        <div>
                            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                                <ShoppingCart className="w-5 h-5 text-primary" />
                                Orders Overview
                            </CardTitle>
                            <p className="text-sm text-muted-foreground mt-1">Your order activity summary</p>
                        </div>
                        <div className="flex gap-2">
                            <Link to="/dashboard/orders">
                                <Button variant="outline" size="sm" className="gap-2">
                                    <ArrowRight className="w-4 h-4" />
                                    View All
                                </Button>
                            </Link>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Status Summary */}
                        <div className="grid grid-cols-3 gap-3">
                            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center">
                                <p className="text-2xl font-bold text-emerald-500">{stats.completedOrders}</p>
                                <p className="text-xs text-muted-foreground">Completed</p>
                            </div>
                            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-center">
                                <p className="text-2xl font-bold text-amber-500">{stats.pendingOrders}</p>
                                <p className="text-xs text-muted-foreground">Processing</p>
                            </div>
                            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 text-center">
                                <p className="text-2xl font-bold text-blue-500">{stats.totalOrders}</p>
                                <p className="text-xs text-muted-foreground">Total</p>
                            </div>
                        </div>

                        {/* Network Breakdown */}
                        <div>
                            <p className="text-sm font-medium mb-3">Network Distribution</p>
                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-yellow-400/50">
                                        <img src="/mtn-logo.png" alt="MTN" className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-sm font-medium">MTN</span>
                                            <span className="text-xs text-muted-foreground">{networkStats.mtn}%</span>
                                        </div>
                                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                                            <div className="h-full bg-yellow-400 rounded-full transition-all duration-500" style={{ width: `${networkStats.mtn}%` }}></div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-red-500/50">
                                        <img src="/telecel-logo.png" alt="Telecel" className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-sm font-medium">Telecel</span>
                                            <span className="text-xs text-muted-foreground">{networkStats.telecel}%</span>
                                        </div>
                                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                                            <div className="h-full bg-red-500 rounded-full transition-all duration-500" style={{ width: `${networkStats.telecel}%` }}></div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-blue-500/50">
                                        <img src="/airteltigo-logo.png" alt="AirtelTigo" className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-sm font-medium">AirtelTigo</span>
                                            <span className="text-xs text-muted-foreground">{networkStats.airteltigo}%</span>
                                        </div>
                                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                                            <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${networkStats.airteltigo}%` }}></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </CardContent>
                </Card>

                {/* Right Panel */}
                <div className="space-y-4 md:space-y-6">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                                <CreditCard className="w-4 h-4 sm:w-5 sm:h-5" />
                                Recent Deposits
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground text-sm text-center py-6 sm:py-8">
                                No recent deposits
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                                <Zap className="w-4 h-4 sm:w-5 sm:h-5" />
                                Top Packages
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {role === 'agent' || role === 'superagent' ? (
                                bundlesLoading ? (
                                    <div className="flex items-center justify-center py-6 sm:py-8">
                                        <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-primary"></div>
                                    </div>
                                ) : topBundles.length === 0 ? (
                                    <p className="text-muted-foreground text-sm text-center py-6">No bundles available</p>
                                ) : (
                                    <div className="space-y-2">
                                        {topBundles.map((bundle) => (
                                            <div
                                                key={bundle.id}
                                                className="flex items-center justify-between p-2.5 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className={cn(
                                                        "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
                                                        bundle.network === 'MTN' ? 'bg-yellow-400 text-black' :
                                                            bundle.network === 'TELECEL' ? 'bg-red-500 text-white' : 'bg-blue-500 text-white'
                                                    )}>
                                                        {bundle.network.slice(0, 2)}
                                                    </span>
                                                    <div>
                                                        <p className="text-sm font-medium">{bundle.dataAmount}</p>
                                                        <p className="text-xs text-muted-foreground">{bundle.network}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm font-semibold text-primary">
                                                        GH₵{bundle.agentPriceGhc?.toFixed(2) || bundle.priceGhc.toFixed(2)}
                                                    </p>
                                                    {bundle.agentPriceGhc && bundle.agentPriceGhc < bundle.priceGhc && (
                                                        <p className="text-xs text-green-500">Agent Price</p>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )
                            ) : (
                                <div className="text-center py-6 sm:py-8">
                                    <Zap className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
                                    <p className="text-muted-foreground text-sm">Top Packages</p>
                                    <p className="text-xs text-muted-foreground/70 mt-1">Become an Agent to see top bundles</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Recent Orders */}
            <Card>
                <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2">
                    <div>
                        <CardTitle className="text-base sm:text-lg">Recent Orders</CardTitle>
                        <p className="text-xs sm:text-sm text-muted-foreground">Your latest bundle orders</p>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2 self-start sm:self-auto">
                        <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9">
                            <RefreshCw className="w-4 h-4" />
                        </Button>
                        <Link to="/dashboard/orders">
                            <Button variant="link" size="sm" className="gap-1 px-2">
                                View All
                                <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4" />
                            </Button>
                        </Link>
                    </div>
                </CardHeader>
                <CardContent>
                    {recentTransactions.length === 0 ? (
                        <div className="text-center py-8 sm:py-12">
                            <Package className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-muted-foreground mb-3 sm:mb-4" />
                            <p className="text-muted-foreground text-sm">No orders yet</p>
                        </div>
                    ) : (
                        <div className="space-y-2 sm:space-y-3">
                            {recentTransactions.map((tx) => (
                                <div
                                    key={tx.id}
                                    className={cn(
                                        "flex items-center justify-between p-2.5 sm:p-3 bg-muted/50 rounded-lg",
                                        "transition-all duration-200 hover:bg-muted"
                                    )}
                                >
                                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                                        <div className={cn(
                                            "w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0",
                                            tx.data_bundles?.network === 'MTN' ? 'bg-yellow-400 text-black' : 'bg-red-500 text-white'
                                        )}>
                                            {tx.data_bundles?.network?.[0] || '?'}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-medium text-xs sm:text-sm truncate">
                                                {tx.data_bundles?.data_amount} - {tx.data_bundles?.network}
                                            </p>
                                            <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{tx.recipient_phone}</p>
                                        </div>
                                    </div>
                                    <div className="text-right flex-shrink-0 ml-2">
                                        <p className="font-semibold text-xs sm:text-sm">GH₵{tx.amount_ghc.toFixed(2)}</p>
                                        <span className={cn(
                                            "text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full",
                                            tx.status === 'completed' ? 'bg-green-500/20 text-green-500' :
                                                (tx.status === 'processing') ? 'bg-yellow-500/20 text-yellow-500' :
                                                    'bg-red-500/20 text-red-500'
                                        )}>
                                            {tx.status === 'pending' ? 'processing' : tx.status}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Place New Order - Network Cards */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base sm:text-lg">Place New Order</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        {networks.map((network) => (
                            <Link key={network.id} to={network.href}>
                                <div className={cn(
                                    network.color,
                                    "rounded-2xl p-4 sm:p-6 text-center cursor-pointer",
                                    "transition-all duration-300",
                                    "hover:scale-[1.03] active:scale-[0.98]",
                                    "border-2 border-white/20",
                                    network.id === 'mtn' && "hover:shadow-mtn hover:bg-yellow-400/95",
                                    network.id === 'telecel' && "hover:shadow-telecel hover:bg-red-500/95",
                                    network.id === 'airteltigo' && "hover:shadow-airteltigo hover:bg-blue-600/95"
                                )}>
                                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3 overflow-hidden shadow-lg ring-4 ring-white/30">
                                        <img src={network.logo} alt={network.name} className="w-full h-full object-cover" />
                                    </div>
                                    <p className={cn("font-bold text-sm sm:text-base", network.textColor)}>{network.name}</p>
                                </div>
                            </Link>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Add Funds CTA */}
            <Card className="bg-primary/10 border-primary/20">
                <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3 sm:gap-4">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                            <Wallet className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-sm sm:text-base">Add Funds to Your Account</h3>
                            <p className="text-xs sm:text-sm text-muted-foreground">Need more credits? Deposit money into your account.</p>
                        </div>
                    </div>
                    <Link to="/dashboard/wallet" className="w-full sm:w-auto">
                        <Button className="w-full sm:w-auto">Deposit Now</Button>
                    </Link>
                </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base sm:text-lg">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
                        {quickActions.map((action) => (
                            <Link key={action.label} to={action.href}>
                                <div className={cn(
                                    action.color,
                                    "rounded-xl p-3 sm:p-4 text-center cursor-pointer",
                                    "transition-all duration-200",
                                    "hover:opacity-90 hover:scale-[1.02] active:scale-[0.98]"
                                )}>
                                    <action.icon className="w-5 h-5 sm:w-6 sm:h-6 mx-auto mb-1.5 sm:mb-2 text-white" />
                                    <p className="text-xs sm:text-sm font-medium text-white">{action.label}</p>
                                </div>
                            </Link>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
