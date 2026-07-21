import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import { walletService, type WalletCreditRequest } from '@/services';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import {
    Wallet,
    Eye,
    EyeOff,
    CreditCard,
    Shield,
    TrendingUp,
    Download,
    Filter,
    Loader2,
    Lock,
    Clock,
    CheckCircle2,
    AlertCircle,
    HelpCircle,
    Send
} from 'lucide-react';

const MIN_AMOUNT = 5; // Minimum GHS 5

declare global {
    interface Window {
        PaystackPop: {
            setup: (options: Record<string, unknown>) => { openIframe: () => void };
        };
    }
}

interface Deposit {
    id: string;
    amount: number;
    method: string;
    status: string;
    created_at: string;
    reference?: string;
}

export default function WalletPage() {
    const { user } = useAuth();
    const { socket } = useSocket();
    const { toast } = useToast();
    const [walletBalance, setWalletBalance] = useState(0);
    const [recentActivity, setRecentActivity] = useState(0);
    const [showBalance, setShowBalance] = useState(true);
    const [amount, setAmount] = useState('');
    const [loading, setLoading] = useState(false);
    const [deposits, setDeposits] = useState<Deposit[]>([]);
    const [depositsCount, setDepositsCount] = useState(0);
    
    // Agent Wallet Credit Requests States
    const [creditRequests, setCreditRequests] = useState<WalletCreditRequest[]>([]);
    const [creditAmount, setCreditAmount] = useState('');
    const [agentNotes, setAgentNotes] = useState('');
    const [isSubmittingCredit, setIsSubmittingCredit] = useState(false);
    const [showCreditModal, setShowCreditModal] = useState(false);
    const [activeTab, setActiveTab] = useState<'deposits' | 'credits'>('deposits');
    const [paystackKey, setPaystackKey] = useState<string>('pk_live_caf0e82935e11c750d70b53c8b7d575e86f6d633');

    // Load dynamic public Paystack key on mount
    useEffect(() => {
        const loadConfig = async () => {
            try {
                const config = await walletService.getSystemConfig();
                if (config && config.paystackPublicKey) {
                    setPaystackKey(config.paystackPublicKey);
                }
            } catch (err) {
                console.error('Failed to load dynamic system configurations:', err);
            }
        };
        loadConfig();
    }, []);

    const isAgent = user?.role === 'agent';
    const feePercentage = 0.03; // 3% fee for both customers and agents

    const fetchWalletData = useCallback(async () => {
        if (!user) return;

        try {
            const data = await walletService.getBalance();
            setWalletBalance(data.balance || 0);
        } catch (err) {
            console.error('Error fetching wallet:', err);
        }
    }, [user]);

    const fetchCreditRequests = useCallback(async () => {
        if (!user || user.role !== 'agent') return;

        try {
            const response = await walletService.getMyCreditRequests();
            if (response.success) {
                setCreditRequests(response.data);
            }
        } catch (err) {
            console.error('Error fetching credit requests:', err);
        }
    }, [user]);

    const fetchDeposits = useCallback(async () => {
        if (!user) return;

        try {
            const data = await walletService.getDeposits();
            const formattedDeposits = data.map(d => ({
                id: d.id,
                amount: d.amount,
                method: 'paystack',
                status: d.status,
                created_at: d.createdAt,
                reference: d.reference,
            }));
            setDeposits(formattedDeposits);
            setDepositsCount(formattedDeposits.length);
        } catch (err) {
            console.error('Error fetching deposits:', err);
        }
    }, [user]);

    useEffect(() => {
        if (user) {
            fetchWalletData();
            fetchDeposits();
            if (user.role === 'agent') {
                fetchCreditRequests();
            }
        }
    }, [user, fetchWalletData, fetchDeposits, fetchCreditRequests]);

    // Socket listeners for real-time balance updates
    useEffect(() => {
        if (!socket) return;

        socket.on('balanceUpdate', (data: { newBalance: number }) => {
            setWalletBalance(data.newBalance);
            fetchDeposits(); // Refresh the deposits table too
            if (user?.role === 'agent') {
                fetchCreditRequests();
            }
            toast({
                title: 'Balance Updated',
                description: `Your new wallet balance is GHS ${data.newBalance.toFixed(2)}`,
            });
        });

        return () => {
            socket.off('balanceUpdate');
        };
    }, [socket, fetchDeposits, fetchCreditRequests, user, toast]);

    const calculateFee = () => {
        const baseAmount = parseFloat(amount) || 0;
        return baseAmount * feePercentage;
    };

    const calculateTotal = () => {
        const baseAmount = parseFloat(amount) || 0;
        const fee = baseAmount * feePercentage;
        return baseAmount + fee; // User pays base + fee
    };

    // Preload Paystack script on component mount
    useEffect(() => {
        if (!window.PaystackPop) {
            const script = document.createElement('script');
            script.src = 'https://js.paystack.co/v1/inline.js';
            script.async = true;
            document.head.appendChild(script);
        }
    }, []);

    const handlePaystackPayment = async () => {
        const amountValue = parseFloat(amount);

        if (!amountValue || amountValue < MIN_AMOUNT) {
            toast({
                title: 'Invalid amount',
                description: `Minimum deposit amount is GHS ${MIN_AMOUNT}`,
                variant: 'destructive',
            });
            return;
        }

        if (!user?.email) {
            toast({
                title: 'Error',
                description: 'User email not found',
                variant: 'destructive',
            });
            return;
        }

        setLoading(true);

        try {
            // Calculate fee and total amount
            const fee = amountValue * feePercentage;
            const totalAmount = amountValue + fee; // Add fee on top
            const amountInPesewas = Math.round(totalAmount * 100);
            const reference = `DEP-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

            // Ensure Paystack script is loaded
            if (!window.PaystackPop) {
                // Wait for script to load with timeout
                let attempts = 0;
                while (!window.PaystackPop && attempts < 50) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    attempts++;
                }

                if (!window.PaystackPop) {
                    throw new Error('Paystack failed to load. Please refresh the page and try again.');
                }
            }

            const handler = window.PaystackPop.setup({
                key: paystackKey,
                email: user.email,
                amount: amountInPesewas, // Total including fee
                currency: 'GHS',
                ref: reference,
                metadata: {
                    user_id: user.id,
                    custom_fields: [
                        {
                            display_name: 'Wallet Credit',
                            variable_name: 'wallet_credit',
                            value: amountValue, // Amount to credit
                        },
                        {
                            display_name: 'Transaction Fee (3%)',
                            variable_name: 'fee',
                            value: fee,
                        },
                        {
                            display_name: 'Total Paid',
                            variable_name: 'total_paid',
                            value: totalAmount,
                        },
                    ],
                },
                callback: function (response: { reference: string }) {
                    // Payment successful - credit the base amount (not including fee)
                    handlePaymentSuccess(response.reference, amountValue);
                },
                onClose: function () {
                    setLoading(false);
                    toast({
                        title: 'Payment cancelled',
                        description: 'You closed the payment window',
                    });
                },
            });

            handler.openIframe();
        } catch (error) {
            console.error('Payment error:', error);
            const message = error instanceof Error ? error.message : 'An error occurred while processing payment';
            toast({
                title: 'Payment failed',
                description: message,
                variant: 'destructive',
            });
            setLoading(false);
        }
    };

    const handlePaymentSuccess = async (reference: string, depositAmount: number) => {
        try {
            // Update wallet balance in database via backend
            const response = await walletService.fund(depositAmount, reference);

            setWalletBalance(response.newBalance);
            setAmount('');

            toast({
                title: 'Deposit successful!',
                description: `GHS ${depositAmount.toFixed(2)} has been added to your wallet`,
            });

            fetchDeposits();
        } catch (error) {
            console.error('Error updating wallet:', error);
            const message = error instanceof Error ? error.message : 'Unknown error';
            toast({
                title: 'Error',
                description: `Payment was successful but wallet update failed: ${message}. Please contact support.`,
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleRequestCredit = async (e: React.FormEvent) => {
        e.preventDefault();
        const amt = parseFloat(creditAmount);
        if (!amt || amt <= 0) {
            toast({
                title: 'Invalid Amount',
                description: 'Please enter a valid positive amount.',
                variant: 'destructive',
            });
            return;
        }

        setIsSubmittingCredit(true);
        try {
            const response = await walletService.createCreditRequest(amt, agentNotes);
            if (response.success) {
                toast({
                    title: 'Request Submitted',
                    description: `Your request for GHS ${amt.toFixed(2)} credit has been submitted to the admin.`,
                });
                setCreditAmount('');
                setAgentNotes('');
                setShowCreditModal(false);
                fetchCreditRequests();
            }
        } catch (error) {
            console.error('Request credit error:', error);
            const message = error instanceof Error ? error.message : 'Failed to submit request';
            toast({
                title: 'Submission Failed',
                description: message,
                variant: 'destructive',
            });
        } finally {
            setIsSubmittingCredit(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="font-display text-2xl md:text-3xl font-bold">Wallet Management</h1>
                <p className="text-muted-foreground">
                    Manage your wallet balance, top up easily, and view transaction history.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Wallet Balance Card */}
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                                    <Wallet className="w-5 h-5 text-primary" />
                                </div>
                                <CardTitle className="text-lg">Wallet Balance</CardTitle>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setShowBalance(!showBalance)}
                            >
                                {showBalance ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div>
                                    <p className="font-display text-3xl md:text-4xl font-bold text-primary">
                                        {showBalance ? `GHS ${walletBalance.toFixed(2)}` : '••••••'}
                                    </p>
                                    <p className="text-sm text-green-500 flex items-center gap-1 mt-1">
                                        <TrendingUp className="w-4 h-4" />
                                        +0.0% from last month
                                    </p>
                                </div>

                                <div className="bg-muted/50 rounded-lg p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <TrendingUp className="w-4 h-4 text-muted-foreground" />
                                            <span className="text-sm text-muted-foreground">Recent Activity</span>
                                        </div>
                                        <span className="text-xs text-muted-foreground">Last 7 days</span>
                                    </div>
                                    <p className="font-display text-xl font-bold text-green-500">
                                        +GHS {recentActivity.toFixed(2)}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">{depositsCount} deposits</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-6">
                    {/* Top Up Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                + Top Up Wallet
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Paystack Checkout Info */}
                            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                                <div className="flex items-center gap-2">
                                    <CreditCard className="w-4 h-4 text-primary" />
                                    <span className="font-medium text-sm">Paystack Checkout</span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Secure payment with cards, bank transfer, and mobile money
                                </p>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    <span className="px-2 py-1 bg-primary text-primary-foreground text-xs rounded">
                                        Min: GHS {MIN_AMOUNT}
                                    </span>
                                    <span className="px-2 py-1 bg-yellow-500/20 text-yellow-600 text-xs rounded">
                                        Fee: {feePercentage * 100}% (Added to payment)
                                    </span>
                                    <span className="px-2 py-1 bg-green-500/20 text-green-600 text-xs rounded flex items-center gap-1">
                                        <Shield className="w-3 h-3" />
                                        Secure
                                    </span>
                                </div>
                            </div>

                            {/* Warning Message */}
                            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                                <div className="flex items-start gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                        <line x1="12" y1="9" x2="12" y2="13" />
                                        <line x1="12" y1="17" x2="12.01" y2="17" />
                                    </svg>
                                    <div>
                                        <p className="text-sm font-semibold text-red-500">Important Notice</p>
                                        <p className="text-xs text-red-400 mt-1">
                                            Please ensure you use a <strong>real and valid email address</strong>.
                                            All transactions are final and <strong>no refunds</strong> will be issued.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Amount Input */}
                            <div className="space-y-2">
                                <Label htmlFor="amount">Amount to Credit (GHS)</Label>
                                <Input
                                    id="amount"
                                    type="number"
                                    placeholder="Enter amount"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    min={MIN_AMOUNT}
                                    className="bg-muted/50"
                                />
                                {amount && parseFloat(amount) > 0 && (
                                    <div className="text-xs space-y-1">
                                        <p className="text-muted-foreground">
                                            Fee ({feePercentage * 100}%): GH₵ {calculateFee().toFixed(2)}
                                        </p>
                                        <p className="text-primary font-medium">
                                            Total to pay: GH₵ {calculateTotal().toFixed(2)}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Pay Button */}
                            <Button
                                className="w-full"
                                size="lg"
                                onClick={handlePaystackPayment}
                                disabled={loading || !amount || parseFloat(amount) < MIN_AMOUNT}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                        Processing...
                                    </>
                                ) : (
                                    'Proceed to Paystack'
                                )}
                            </Button>

                            {/* Security Note */}
                            <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
                                <Lock className="w-3 h-3" />
                                Your payment is secured with 256-bit SSL encryption
                            </p>
                        </CardContent>
                    </Card>

                    {/* Agent Credit Request Card */}
                    {isAgent && (
                        <Card className="border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/10">
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                                    <Shield className="w-5 h-5" />
                                    Agent Credit Line
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <p className="text-xs text-muted-foreground">
                                    Need quick inventory funds? Request immediate wallet credit from the administrator. Approved credits will update your balance instantly.
                                </p>
                                <Button
                                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                                    onClick={() => setShowCreditModal(true)}
                                >
                                    Request Wallet Credit
                                </Button>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>

            {/* Recent Activity / Credits Tabs */}
            <Card>
                <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
                    <div className="flex items-center gap-4">
                        {isAgent ? (
                            <div className="flex bg-muted/65 p-1 rounded-lg">
                                <button
                                    onClick={() => setActiveTab('deposits')}
                                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                                        activeTab === 'deposits'
                                            ? 'bg-background text-foreground shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    Deposit History
                                </button>
                                <button
                                    onClick={() => setActiveTab('credits')}
                                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                                        activeTab === 'credits'
                                            ? 'bg-background text-foreground shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    Credit Line Requests
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3">
                                <CreditCard className="w-5 h-5 flex-shrink-0" />
                                <CardTitle className="text-lg">Recent Deposits</CardTitle>
                            </div>
                        )}
                    </div>
                    {activeTab === 'deposits' && (
                        <div className="flex flex-wrap items-center gap-2">
                            <Link to="/dashboard/deposits">
                                <Button variant="outline" size="sm">
                                    All
                                </Button>
                            </Link>
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-1"
                                onClick={() => {
                                    if (deposits.length === 0) {
                                        toast({ title: 'No data', description: 'No deposits to export' });
                                        return;
                                    }
                                    const csv = ['Reference,Amount,Status,Date', ...deposits.map(d =>
                                        `${d.reference || d.id},${d.amount},${d.status},${new Date(d.created_at).toLocaleDateString()}`
                                    )].join('\n');
                                    const blob = new Blob([csv], { type: 'text/csv' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `deposits-${new Date().toISOString().split('T')[0]}.csv`;
                                    a.click();
                                    URL.revokeObjectURL(url);
                                    toast({ title: 'Exported', description: 'Deposits exported to CSV' });
                                }}
                            >
                                <Download className="w-4 h-4" />
                                Export
                            </Button>
                            <Link to="/dashboard/deposits" className="hidden sm:inline-block">
                                <Button variant="link" size="sm">
                                    View All
                                </Button>
                            </Link>
                        </div>
                    )}
                </CardHeader>
                <CardContent className="pt-6">
                    {activeTab === 'deposits' ? (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="text-left text-sm text-muted-foreground border-b border-border">
                                        <th className="pb-3 font-medium">ID</th>
                                        <th className="pb-3 font-medium">METHOD</th>
                                        <th className="pb-3 font-medium">AMOUNT</th>
                                        <th className="pb-3 font-medium">STATUS</th>
                                        <th className="pb-3 font-medium">DATE</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {deposits.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="text-center py-12 text-muted-foreground">
                                                No records found
                                            </td>
                                        </tr>
                                    ) : (
                                        deposits.map((deposit) => (
                                            <tr key={deposit.id} className="border-b border-border">
                                                <td className="py-3 text-sm">{deposit.id.slice(0, 8)}...</td>
                                                <td className="py-3 text-sm">{deposit.method}</td>
                                                <td className="py-3 text-sm font-semibold">GHS {deposit.amount.toFixed(2)}</td>
                                                <td className="py-3">
                                                    <span className={`px-2 py-1 text-xs rounded ${deposit.status === 'completed'
                                                        ? 'bg-green-500/20 text-green-500'
                                                        : 'bg-yellow-500/20 text-yellow-500'
                                                        }`}>
                                                        {deposit.status}
                                                    </span>
                                                </td>
                                                <td className="py-3 text-sm text-muted-foreground">
                                                    {new Date(deposit.created_at).toLocaleDateString()}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="text-left text-sm text-muted-foreground border-b border-border">
                                        <th className="pb-3 font-medium">REQUEST ID</th>
                                        <th className="pb-3 font-medium">AMOUNT</th>
                                        <th className="pb-3 font-medium">STATUS</th>
                                        <th className="pb-3 font-medium">NOTES</th>
                                        <th className="pb-3 font-medium">SUBMITTED ON</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {creditRequests.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="text-center py-12 text-muted-foreground">
                                                No credit requests found
                                            </td>
                                        </tr>
                                    ) : (
                                        creditRequests.map((reqItem) => (
                                            <tr key={reqItem.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                                                <td className="py-3 text-sm font-mono">{reqItem.id.slice(0, 8)}...</td>
                                                <td className="py-3 text-sm font-semibold text-emerald-600 dark:text-emerald-400">GHS {reqItem.amount.toFixed(2)}</td>
                                                <td className="py-3">
                                                    <span className={`px-2 py-1 text-xs rounded-full font-medium inline-flex items-center gap-1 ${
                                                        reqItem.status === 'approved'
                                                            ? 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20'
                                                            : reqItem.status === 'rejected'
                                                            ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                                                            : 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20'
                                                    }`}>
                                                        {reqItem.status === 'approved' && <CheckCircle2 className="w-3 h-3" />}
                                                        {reqItem.status === 'rejected' && <AlertCircle className="w-3 h-3" />}
                                                        {reqItem.status === 'pending' && <Clock className="w-3 h-3" />}
                                                        {reqItem.status}
                                                    </span>
                                                </td>
                                                <td className="py-3 text-xs max-w-xs space-y-1">
                                                    {reqItem.agentNotes && (
                                                        <p className="text-muted-foreground">
                                                            <strong className="text-foreground">My note:</strong> {reqItem.agentNotes}
                                                        </p>
                                                    )}
                                                    {reqItem.adminNotes && (
                                                        <p className="text-amber-600 dark:text-amber-400 font-medium">
                                                            <strong>Admin response:</strong> {reqItem.adminNotes}
                                                        </p>
                                                    )}
                                                    {!reqItem.agentNotes && !reqItem.adminNotes && <span className="text-muted-foreground">—</span>}
                                                </td>
                                                <td className="py-3 text-sm text-muted-foreground">
                                                    {new Date(reqItem.createdAt).toLocaleDateString()} {new Date(reqItem.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Request Wallet Credit Modal */}
            <Dialog open={showCreditModal} onOpenChange={setShowCreditModal}>
                <DialogContent className="sm:max-w-[450px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 font-display text-xl font-bold text-emerald-600 dark:text-emerald-400">
                            <Shield className="w-6 h-6" />
                            Request Agent Credit
                        </DialogTitle>
                        <DialogDescription>
                            Enter the credit amount you want added to your agent wallet. Your request will be reviewed by the system administrator.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleRequestCredit} className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <Label htmlFor="credit-amount" className="text-sm font-semibold">Credit Amount (GHS)</Label>
                            <Input
                                id="credit-amount"
                                type="number"
                                step="0.01"
                                placeholder="Enter amount to request (e.g. 500)"
                                value={creditAmount}
                                onChange={(e) => setCreditAmount(e.target.value)}
                                className="bg-muted/50"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="credit-notes" className="text-sm font-semibold">Additional Notes / Reference (Optional)</Label>
                            <textarea
                                id="credit-notes"
                                placeholder="Add any details or payment verification reference..."
                                value={agentNotes}
                                onChange={(e) => setAgentNotes(e.target.value)}
                                className="w-full min-h-[100px] bg-muted/50 rounded-md border border-input p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            />
                        </div>
                        <div className="flex gap-3 justify-end pt-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setShowCreditModal(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                                disabled={isSubmittingCredit}
                            >
                                {isSubmittingCredit ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                        Submitting...
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-4 h-4 mr-2" />
                                        Submit Request
                                    </>
                                )}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
