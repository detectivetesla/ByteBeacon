import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { adminService, UserDetails } from '@/services/admin.service';
import { walletService } from '@/services';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
    ArrowLeft,
    User,
    Wallet,
    ShoppingBag,
    Activity,
    CreditCard,
    Clock,
    CheckCircle,
    XCircle,
    Loader2,
    Mail,
    Phone,
    Calendar,
    DollarSign,
    Send,
    RefreshCw,
    Download,
    FileSpreadsheet,
    FileText,
    FileCode,
    Shield,
    ShieldCheck
} from 'lucide-react';
import { exportTransactions, exportActivityLogs, exportDeposits } from '@/lib/export';
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import AgentPricingModal from './AgentPricingModal';

const STATUS_COLORS: Record<string, string> = {
    completed: 'bg-emerald-500/20 text-emerald-500',
    pending: 'bg-yellow-500/20 text-yellow-600',
    processing: 'bg-blue-500/20 text-blue-500',
    failed: 'bg-red-500/20 text-red-500',
};

const ACTION_COLORS: Record<string, string> = {
    LOGIN: 'bg-blue-500/20 text-blue-500',
    REGISTER: 'bg-emerald-500/20 text-emerald-500',
    PURCHASE: 'bg-yellow-500/20 text-yellow-600',
    WALLET_FUND: 'bg-purple-500/20 text-purple-500',
    AGENT_APPLICATION: 'bg-orange-500/20 text-orange-500',
};

const ROLE_COLORS: Record<string, string> = {
    admin: 'bg-red-500/20 text-red-500',
    superagent: 'bg-emerald-500/20 text-emerald-500',
    agent: 'bg-purple-500/20 text-purple-500',
    customer: 'bg-blue-500/20 text-blue-500',
};

export default function AdminUserDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { toast } = useToast();
    const [data, setData] = useState<UserDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [showPricingModal, setShowPricingModal] = useState(false);
    const [activityFilter, setActivityFilter] = useState<string>('all');

    // Date range filters
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');

    // Manual credit states
    const [showCreditModal, setShowCreditModal] = useState(false);
    const [creditAmount, setCreditAmount] = useState('');
    const [creditNotes, setCreditNotes] = useState('');
    const [creditAction, setCreditAction] = useState<'credit' | 'debit' | 'set' | 'refund'>('credit');
    const [isSubmittingCredit, setIsSubmittingCredit] = useState(false);

    const handleCreditWallet = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id) return;
        const amt = parseFloat(creditAmount);
        
        if (creditAction === 'set') {
            if (isNaN(amt) || amt < 0) {
                toast({
                    title: 'Invalid Amount',
                    description: 'Please enter a valid non-negative amount.',
                    variant: 'destructive',
                });
                return;
            }
        } else {
            if (isNaN(amt) || amt <= 0) {
                toast({
                    title: 'Invalid Amount',
                    description: 'Please enter a valid positive amount.',
                    variant: 'destructive',
                });
                return;
            }
        }

        setIsSubmittingCredit(true);
        try {
            const response = await walletService.adminCreditUserWallet(id, amt, creditAction, creditNotes);
            if (response.success) {
                let successMsg = '';
                if (creditAction === 'credit') {
                    successMsg = `Successfully credited GH₵ ${amt.toFixed(2)} manually.`;
                } else if (creditAction === 'debit') {
                    successMsg = `Successfully debited GH₵ ${amt.toFixed(2)} manually.`;
                } else if (creditAction === 'refund') {
                    successMsg = `Successfully refunded GH₵ ${amt.toFixed(2)} manually.`;
                } else {
                    successMsg = `Wallet balance successfully set to GH₵ ${amt.toFixed(2)}.`;
                }

                toast({
                    title: 'Success',
                    description: successMsg,
                });
                setCreditAmount('');
                setCreditNotes('');
                setShowCreditModal(false);
                fetchUserDetails();
            }
        } catch (error: any) {
            console.error('Manual credit error:', error);
            const msg = error?.message || 'Failed to adjust user wallet.';
            toast({
                title: 'Operation Failed',
                description: msg,
                variant: 'destructive',
            });
        } finally {
            setIsSubmittingCredit(false);
        }
    };

    const fetchUserDetails = useCallback(async () => {
        if (!id) return;
        setLoading(true);
        try {
            const result = await adminService.getUserDetails(id);
            setData(result);
        } catch (error) {
            console.error('Error fetching user details:', error);
            toast({
                title: 'Error',
                description: 'Failed to load user details.',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    }, [id, toast]);

    useEffect(() => {
        fetchUserDetails();
    }, [fetchUserDetails]);

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Skeleton className="h-9 w-24 rounded-xl" />
                    <Skeleton className="h-8 w-48 rounded-lg" />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Skeleton className="h-64 rounded-2xl col-span-1" />
                    <Skeleton className="h-64 rounded-2xl col-span-2" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Skeleton className="h-24 rounded-xl" />
                    <Skeleton className="h-24 rounded-xl" />
                    <Skeleton className="h-24 rounded-xl" />
                    <Skeleton className="h-24 rounded-xl" />
                </div>
                <Skeleton className="h-96 w-full rounded-2xl" />
            </div>
        );
    }

    if (!data) {
        return (
            <div className="text-center py-20">
                <p className="text-muted-foreground">User not found.</p>
                <Button variant="link" onClick={() => navigate('/admin/users')}>
                    Back to Users
                </Button>
            </div>
        );
    }

    const user = data?.user || { id: id || '', fullName: 'Unknown', email: '', phone: '', walletBalance: 0, role: 'customer' };
    const transactions = data?.transactions || [];
    const activityLogs = data?.activityLogs || [];
    const deposits = data?.deposits || [];
    const stats = data?.stats || { totalOrders: 0, completedOrders: 0, failedOrders: 0, pendingOrders: 0, totalSpent: 0, dailySpent: 0, dailyOrders: 0, dailyRefunds: 0, totalRefunds: 0 };
    const refunds = data?.refunds || [];

    const filteredTransactions = transactions.filter(tx => {
        if (!tx.createdAt) return true;
        const txDate = new Date(tx.createdAt);
        if (startDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            if (txDate < start) return false;
        }
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            if (txDate > end) return false;
        }
        return true;
    });

    const filteredActivityLogs = activityLogs.filter(log => {
        if (!log.createdAt) return true;
        const logDate = new Date(log.createdAt);
        if (startDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            if (logDate < start) return false;
        }
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            if (logDate > end) return false;
        }
        return true;
    });

    const filteredDeposits = deposits.filter(dep => {
        if (!dep.createdAt) return true;
        const depDate = new Date(dep.createdAt);
        if (startDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            if (depDate < start) return false;
        }
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            if (depDate > end) return false;
        }
        return true;
    });

    const filteredRefunds = refunds.filter(ref => {
        if (!ref.createdAt) return true;
        const refDate = new Date(ref.createdAt);
        if (startDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            if (refDate < start) return false;
        }
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            if (refDate > end) return false;
        }
        return true;
    });

    const handleExportUserDetail = (format: 'excel' | 'csv' | 'json' = 'csv') => {
        if (!data) return;
        const sanitizedName = user.fullName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
        
        exportTransactions(filteredTransactions, {
            filename: `user_${sanitizedName}_transactions`,
            format,
            sheetName: 'User Transactions'
        });

        const formatLabels: Record<string, string> = { excel: 'Excel (.xls)', csv: 'CSV', json: 'JSON' };
        toast({
            title: 'Export Successful',
            description: `Exported ${filteredTransactions.length} transaction(s) for ${user.fullName} to ${formatLabels[format]}.`
        });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" onClick={() => navigate('/admin/users')}>
                    <ArrowLeft className="w-4 h-4" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold">{user.fullName}</h1>
                    <p className="text-muted-foreground">{user.email}</p>
                </div>
                <div className="ml-auto flex items-center gap-2 flex-wrap">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="rounded-xl border-border/50 hover:bg-primary/10 hover:text-primary transition-all font-bold">
                                <Download className="w-4 h-4 mr-2" />
                                Export User Data
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-card border-border">
                            <DropdownMenuLabel>Export Format</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleExportUserDetail('excel')} className="cursor-pointer">
                                <FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-500" />
                                Export Transactions to Excel (.xlsx / .xls)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleExportUserDetail('csv')} className="cursor-pointer">
                                <FileText className="w-4 h-4 mr-2 text-blue-500" />
                                Export Transactions to CSV
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleExportUserDetail('json')} className="cursor-pointer">
                                <FileCode className="w-4 h-4 mr-2 text-purple-500" />
                                Export Transactions to JSON
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <Button
                        variant="outline"
                        className="border-emerald-600/30 text-emerald-600 hover:bg-emerald-500/10 font-semibold rounded-xl"
                        onClick={() => setShowCreditModal(true)}
                    >
                        <Wallet className="w-4 h-4 mr-2 text-emerald-500" />
                        Credit Wallet
                    </Button>
                    <Button
                        className="rounded-xl"
                        onClick={() => setShowPricingModal(true)}
                    >
                        <DollarSign className="w-4 h-4 mr-2" />
                        Set Custom Pricing
                    </Button>
                </div>
            </div>

            {/* User Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                            <Wallet className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Wallet Balance</p>
                            <p className="text-lg font-bold">GH₵ {user.walletBalance.toFixed(2)}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                            <ShoppingBag className="w-5 h-5 text-emerald-500" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Total Orders</p>
                            <p className="text-lg font-bold">{stats.totalOrders}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                            <CreditCard className="w-5 h-5 text-yellow-600" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Total Spent</p>
                            <p className="text-lg font-bold">GH₵ {stats.totalSpent.toFixed(2)}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                            <Shield className="w-5 h-5 text-blue-500" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Role</p>
                            <span className={`px-2 py-1 text-xs rounded capitalize ${ROLE_COLORS[user.role] || 'bg-gray-500/20 text-gray-500'}`}>
                                {user.role}
                            </span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Daily & Refund Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-card border-border border-l-4 border-l-orange-500">
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                            <Clock className="w-5 h-5 text-orange-500" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Daily Spent</p>
                            <p className="text-lg font-bold">GH₵ {(stats.dailySpent || 0).toFixed(2)}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-card border-border border-l-4 border-l-blue-500">
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                            <ShoppingBag className="w-5 h-5 text-blue-500" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Daily Orders</p>
                            <p className="text-lg font-bold">{stats.dailyOrders || 0}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-card border-border border-l-4 border-l-yellow-500">
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
                            <RefreshCw className="w-5 h-5 text-yellow-600" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Daily Refunds</p>
                            <p className="text-lg font-bold">GH₵ {(stats.dailyRefunds || 0).toFixed(2)}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-card border-border border-l-4 border-l-emerald-500">
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                            <CheckCircle className="w-5 h-5 text-emerald-500" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Total Refunds</p>
                            <p className="text-lg font-bold">GH₵ {(stats.totalRefunds || 0).toFixed(2)}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* User Details */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <User className="w-5 h-5" />
                        Profile Information
                    </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <span>{user.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <span>{user.phone}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span>Joined {new Date(user.createdAt).toLocaleDateString()}</span>
                    </div>
                </CardContent>
            </Card>

            {/* Universal Date Filters */}
            <Card className="bg-card border-border">
                <CardContent className="p-4 flex flex-wrap gap-4 items-center justify-between">
                    <span className="text-sm font-semibold text-foreground uppercase tracking-wider">Filter Data by Date Range</span>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 text-sm">
                            <span className="text-muted-foreground">From:</span>
                            <Input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-[150px] bg-muted/50 border-border text-foreground"
                            />
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                            <span className="text-muted-foreground">To:</span>
                            <Input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-[150px] bg-muted/50 border-border text-foreground"
                            />
                        </div>
                        {(startDate || endDate) && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => { setStartDate(''); setEndDate(''); }}
                                className="text-red-500 hover:text-red-600 font-bold"
                            >
                                Clear Filters
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Tabs for Transactions, Activity, Deposits, Refunds */}
            <Tabs defaultValue="transactions" className="w-full">
                <TabsList className="mb-4">
                    <TabsTrigger value="transactions">
                        <ShoppingBag className="w-4 h-4 mr-2" />
                        Transactions ({filteredTransactions.length})
                    </TabsTrigger>
                    <TabsTrigger value="activity">
                        <Activity className="w-4 h-4 mr-2" />
                        Activity ({filteredActivityLogs.length})
                    </TabsTrigger>
                    <TabsTrigger value="deposits">
                        <CreditCard className="w-4 h-4 mr-2" />
                        Deposits ({filteredDeposits.length})
                    </TabsTrigger>
                    <TabsTrigger value="refunds">
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Refunds ({filteredRefunds.length})
                    </TabsTrigger>
                </TabsList>

                {/* Transactions Tab */}
                <TabsContent value="transactions">
                    <Card>
                        <CardContent className="p-0">
                            {filteredTransactions.length === 0 ? (
                                <p className="text-center py-10 text-muted-foreground">No transactions found.</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="text-left text-sm text-muted-foreground border-b">
                                                <th className="p-3 font-medium">Network</th>
                                                <th className="p-3 font-medium">Data</th>
                                                <th className="p-3 font-medium">Recipient</th>
                                                <th className="p-3 font-medium">Amount</th>
                                                <th className="p-3 font-medium">Status</th>
                                                <th className="p-3 font-medium">Date</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredTransactions.map((tx) => (
                                                <tr key={tx.id} className="border-b hover:bg-muted/50">
                                                    <td className="p-3 font-medium">{tx.network}</td>
                                                    <td className="p-3">{tx.dataAmount}</td>
                                                    <td className="p-3">{tx.recipientPhone}</td>
                                                    <td className="p-3 font-semibold">GH₵ {tx.amount.toFixed(2)}</td>
                                                    <td className="p-3">
                                                        <span className={`px-2 py-1 text-xs rounded ${STATUS_COLORS[tx.status] || 'bg-gray-500/20 text-gray-500'}`}>
                                                            {tx.status}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-sm text-muted-foreground">{new Date(tx.createdAt).toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Activity Tab */}
                <TabsContent value="activity">
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between flex-wrap gap-3">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Activity className="w-5 h-5" />
                                    Activity Log
                                </CardTitle>
                            </div>
                            {/* Activity Summary - Clickable Filters */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                                <button
                                    onClick={() => setActivityFilter(activityFilter === 'LOGIN' ? 'all' : 'LOGIN')}
                                    className={`rounded-lg p-3 text-center transition-all border-2 ${activityFilter === 'LOGIN'
                                        ? 'bg-blue-500 border-blue-500 text-white'
                                        : 'bg-blue-500/10 border-transparent hover:border-blue-500/50'
                                        }`}
                                >
                                    <p className={`text-2xl font-bold ${activityFilter === 'LOGIN' ? 'text-white' : 'text-blue-500'}`}>
                                        {filteredActivityLogs.filter(l => l.action === 'LOGIN').length}
                                    </p>
                                    <p className={`text-xs ${activityFilter === 'LOGIN' ? 'text-white/80' : 'text-muted-foreground'}`}>Logins</p>
                                </button>
                                <button
                                    onClick={() => setActivityFilter(activityFilter === 'PURCHASE' ? 'all' : 'PURCHASE')}
                                    className={`rounded-lg p-3 text-center transition-all border-2 ${activityFilter === 'PURCHASE'
                                        ? 'bg-yellow-500 border-yellow-500 text-white'
                                        : 'bg-yellow-500/10 border-transparent hover:border-yellow-500/50'
                                        }`}
                                >
                                    <p className={`text-2xl font-bold ${activityFilter === 'PURCHASE' ? 'text-white' : 'text-yellow-600'}`}>
                                        {filteredActivityLogs.filter(l => l.action === 'PURCHASE').length}
                                    </p>
                                    <p className={`text-xs ${activityFilter === 'PURCHASE' ? 'text-white/80' : 'text-muted-foreground'}`}>Purchases</p>
                                </button>
                                <button
                                    onClick={() => setActivityFilter(activityFilter === 'WALLET_FUND' ? 'all' : 'WALLET_FUND')}
                                    className={`rounded-lg p-3 text-center transition-all border-2 ${activityFilter === 'WALLET_FUND'
                                        ? 'bg-purple-500 border-purple-500 text-white'
                                        : 'bg-purple-500/10 border-transparent hover:border-purple-500/50'
                                        }`}
                                >
                                    <p className={`text-2xl font-bold ${activityFilter === 'WALLET_FUND' ? 'text-white' : 'text-purple-500'}`}>
                                        {filteredActivityLogs.filter(l => l.action === 'WALLET_FUND').length}
                                    </p>
                                    <p className={`text-xs ${activityFilter === 'WALLET_FUND' ? 'text-white/80' : 'text-muted-foreground'}`}>Deposits</p>
                                </button>
                                <button
                                    onClick={() => setActivityFilter('all')}
                                    className={`rounded-lg p-3 text-center transition-all border-2 ${activityFilter === 'all'
                                        ? 'bg-emerald-500 border-emerald-500 text-white'
                                        : 'bg-emerald-500/10 border-transparent hover:border-emerald-500/50'
                                        }`}
                                >
                                    <p className={`text-2xl font-bold ${activityFilter === 'all' ? 'text-white' : 'text-emerald-500'}`}>
                                        {filteredActivityLogs.length}
                                    </p>
                                    <p className={`text-xs ${activityFilter === 'all' ? 'text-white/80' : 'text-muted-foreground'}`}>Total Activities</p>
                                </button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            {filteredActivityLogs.length === 0 ? (
                                <p className="text-center py-10 text-muted-foreground">No activity logs found.</p>
                            ) : (() => {
                                const filteredLogs = activityFilter === 'all'
                                    ? filteredActivityLogs
                                    : filteredActivityLogs.filter(l => l.action === activityFilter);

                                if (filteredLogs.length === 0) {
                                    return <p className="text-center py-10 text-muted-foreground">No {activityFilter === 'all' ? '' : activityFilter.toLowerCase().replace('_', ' ')} activities found.</p>;
                                }

                                return (
                                    <div className="divide-y">
                                        {/* Group activities by date */}
                                        {Object.entries(
                                            filteredLogs.reduce((groups, log) => {
                                                const date = new Date(log.createdAt).toLocaleDateString('en-US', {
                                                    weekday: 'long',
                                                    year: 'numeric',
                                                    month: 'long',
                                                    day: 'numeric'
                                                });
                                                if (!groups[date]) groups[date] = [];
                                                groups[date].push(log);
                                                return groups;
                                            }, {} as Record<string, typeof activityLogs>)
                                        ).map(([date, logs]) => {
                                            const dailyPurchaseSum = logs
                                                .filter(l => l.action === 'PURCHASE')
                                                .reduce((sum, l) => sum + (Number(l.metadata?.amount) || 0), 0);

                                            return (
                                                <div key={date} className="py-4 px-4">
                                                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                                                        <div className="flex items-center gap-2">
                                                            <Calendar className="w-4 h-4 text-primary" />
                                                            <h4 className="font-semibold text-sm">{date}</h4>
                                                            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                                                                {logs.length} activities
                                                            </span>
                                                        </div>
                                                        {dailyPurchaseSum > 0 && (
                                                            <div className="text-sm font-bold text-yellow-600 bg-yellow-500/10 px-3 py-1 rounded-full border border-yellow-500/20">
                                                                Daily Purchase: GH₵ {dailyPurchaseSum.toFixed(2)}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="space-y-2 ml-6">
                                                        {logs.map((log) => (
                                                            <div key={log.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50">
                                                                <div className={`w-2 h-2 rounded-full mt-2 ${log.action === 'LOGIN' ? 'bg-blue-500' :
                                                                    log.action === 'PURCHASE' ? 'bg-yellow-500' :
                                                                        log.action === 'WALLET_FUND' ? 'bg-purple-500' :
                                                                            log.action === 'REGISTER' ? 'bg-emerald-500' :
                                                                                'bg-gray-400'
                                                                    }`}></div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                                                        <div className="flex items-center gap-2 flex-wrap">
                                                                            <span className={`px-2 py-0.5 text-xs rounded ${ACTION_COLORS[log.action] || 'bg-gray-500/20 text-gray-500'}`}>
                                                                                {log.action}
                                                                            </span>
                                                                            <span className="text-xs text-muted-foreground">
                                                                                {new Date(log.createdAt).toLocaleTimeString()}
                                                                            </span>
                                                                            {log.ipAddress && (
                                                                                <span className="text-xs text-muted-foreground">
                                                                                    • IP: {log.ipAddress}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        {log.metadata?.amount && (
                                                                            <span className={`text-sm font-bold ${log.action === 'PURCHASE' ? 'text-yellow-600' : 'text-purple-600'}`}>
                                                                                {log.action === 'PURCHASE' ? '-' : '+'}GH₵ {Number(log.metadata.amount).toFixed(2)}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <p className="text-sm mt-1 truncate">{log.description}</p>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })()}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Deposits Tab */}
                <TabsContent value="deposits">
                    <Card>
                        <CardContent className="p-0">
                            {filteredDeposits.length === 0 ? (
                                <p className="text-center py-10 text-muted-foreground">No deposits found.</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="text-left text-sm text-muted-foreground border-b">
                                                <th className="p-3 font-medium">Reference</th>
                                                <th className="p-3 font-medium">Amount</th>
                                                <th className="p-3 font-medium">Status</th>
                                                <th className="p-3 font-medium">Date</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredDeposits.map((dep) => (
                                                <tr key={dep.id} className="border-b hover:bg-muted/50">
                                                    <td className="p-3 text-sm">{dep.reference.slice(0, 15)}...</td>
                                                    <td className="p-3 font-semibold">GH₵ {dep.amount.toFixed(2)}</td>
                                                    <td className="p-3">
                                                        <span className={`px-2 py-1 text-xs rounded ${STATUS_COLORS[dep.status] || 'bg-gray-500/20 text-gray-500'}`}>
                                                            {dep.status}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-sm text-muted-foreground">{new Date(dep.createdAt).toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Refunds Tab */}
                <TabsContent value="refunds">
                    <Card>
                        <CardContent className="p-0">
                            {filteredRefunds.length === 0 ? (
                                <p className="text-center py-10 text-muted-foreground">No refunds found.</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="text-left text-sm text-muted-foreground border-b">
                                                <th className="p-3 font-medium">Refund ID</th>
                                                <th className="p-3 font-medium">Amount</th>
                                                <th className="p-3 font-medium">Notes / Reason</th>
                                                <th className="p-3 font-medium">Date</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredRefunds.map((ref) => (
                                                <tr key={ref.id} className="border-b hover:bg-muted/50">
                                                    <td className="p-3 font-mono text-xs text-muted-foreground">#{ref.id.slice(0, 8)}</td>
                                                    <td className="p-3 font-semibold text-emerald-600 dark:text-emerald-400 font-bold">GH₵ {ref.amount.toFixed(2)}</td>
                                                    <td className="p-3 text-sm">{ref.notes}</td>
                                                    <td className="p-3 text-sm text-muted-foreground">{new Date(ref.createdAt).toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Agent Pricing Modal */}
            {id && (
                <AgentPricingModal
                    isOpen={showPricingModal}
                    onClose={() => setShowPricingModal(false)}
                    agentId={id}
                    agentName={user.fullName}
                />
            )}

            {/* Direct Wallet Credit Modal */}
            <Dialog open={showCreditModal} onOpenChange={(open) => {
                setShowCreditModal(open);
                if (!open) {
                    setCreditAmount('');
                    setCreditAction('credit');
                }
            }}>
                <DialogContent className="sm:max-w-[450px]">
                    <DialogHeader>
                        <DialogTitle className={cn(
                            "flex items-center gap-2 font-display text-xl font-bold",
                            creditAction === 'debit' ? 'text-red-500' :
                            creditAction === 'set' ? 'text-blue-500' :
                            creditAction === 'refund' ? 'text-yellow-600 dark:text-yellow-400' :
                            'text-emerald-600 dark:text-emerald-400'
                        )}>
                            <Wallet className={cn(
                                "w-6 h-6",
                                creditAction === 'debit' ? 'text-red-500' :
                                creditAction === 'set' ? 'text-blue-500' :
                                creditAction === 'refund' ? 'text-yellow-500' :
                                'text-emerald-500'
                            )} />
                            {creditAction === 'credit' ? 'Credit User Wallet' :
                             creditAction === 'debit' ? 'Debit User Wallet' :
                             creditAction === 'refund' ? 'Refund User Wallet' : 'Set User Wallet Balance'}
                        </DialogTitle>
                        <DialogDescription>
                            Manually adjust <strong className="text-foreground">{user.fullName}</strong>'s wallet balance.
                            Current balance is <strong>GH₵ {user.walletBalance.toFixed(2)}</strong>.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreditWallet} className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <Label className="text-sm font-semibold">Action Type</Label>
                            <Select 
                                value={creditAction} 
                                onValueChange={(value) => {
                                    setCreditAction(value as any);
                                    setCreditAmount('');
                                }}
                            >
                                <SelectTrigger className="w-full bg-background border-input text-foreground">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-popover border-input">
                                    <SelectItem value="credit" className="hover:bg-accent focus:bg-accent">Credit (Add Funds)</SelectItem>
                                    <SelectItem value="debit" className="hover:bg-accent focus:bg-accent">Debit (Subtract Funds)</SelectItem>
                                    <SelectItem value="refund" className="hover:bg-accent focus:bg-accent">Refund (Credit back)</SelectItem>
                                    <SelectItem value="set" className="hover:bg-accent focus:bg-accent">Set Balance (Override)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="credit-amt" className="text-sm font-semibold">
                                {creditAction === 'set' ? 'New Balance (GHS)' : 'Amount (GHS)'}
                            </Label>
                            <Input
                                id="credit-amt"
                                type="number"
                                step="0.01"
                                min={creditAction === 'set' ? '0' : '0.01'}
                                placeholder="0.00"
                                value={creditAmount}
                                onChange={(e) => setCreditAmount(e.target.value)}
                                className="bg-muted/50"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="credit-msg" className="text-sm font-semibold">Optional Notes / Reason</Label>
                            <textarea
                                id="credit-msg"
                                placeholder="E.g., Cash payment received, balance correction, promotional credit..."
                                value={creditNotes}
                                onChange={(e) => setCreditNotes(e.target.value)}
                                className="w-full min-h-[80px] bg-muted/50 rounded-md border border-input p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            />
                        </div>
                        <DialogFooter className="pt-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setShowCreditModal(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                className={cn(
                                    "text-white font-semibold",
                                    creditAction === 'debit' ? 'bg-red-600 hover:bg-red-700' :
                                    creditAction === 'set' ? 'bg-blue-600 hover:bg-blue-700' :
                                    creditAction === 'refund' ? 'bg-yellow-600 hover:bg-yellow-700' :
                                    'bg-emerald-600 hover:bg-emerald-700'
                                )}
                                disabled={isSubmittingCredit}
                            >
                                {isSubmittingCredit ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-4 h-4 mr-2" />
                                        {creditAction === 'credit' ? 'Apply Credit' :
                                         creditAction === 'debit' ? 'Apply Debit' :
                                         creditAction === 'refund' ? 'Apply Refund' : 'Set Balance'}
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
