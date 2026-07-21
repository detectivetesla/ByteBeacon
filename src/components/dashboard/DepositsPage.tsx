import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { walletService } from '@/services';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import {
    CreditCard,
    Download,
    RefreshCw,
    CheckCircle,
    Clock,
    Loader2
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface Deposit {
    id: string;
    amount: number;
    method: string;
    status: string;
    created_at: string;
    reference?: string;
}

export default function DepositsPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [deposits, setDeposits] = useState<Deposit[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<string>('all');

    const fetchDeposits = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const data = await walletService.getDeposits();
            const formattedDeposits = data.map(d => ({
                id: d.id,
                amount: d.amount,
                method: 'Paystack',
                status: d.status,
                created_at: d.createdAt,
                reference: d.reference,
            }));
            setDeposits(formattedDeposits);
        } catch (err) {
            console.error('Error fetching deposits:', err);
            setDeposits([]);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (user) {
            fetchDeposits();
        }
    }, [user, fetchDeposits]);

    const filteredDeposits = deposits.filter(d =>
        filter === 'all' || d.status === filter
    );

    const totalDeposits = deposits.reduce((sum, d) => d.status === 'completed' ? sum + d.amount : sum, 0);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <CreditCard className="w-8 h-8 text-muted-foreground" />
                    <div>
                        <h1 className="font-display text-2xl md:text-3xl font-bold">Deposits</h1>
                        <p className="text-muted-foreground">View your deposit history</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={fetchDeposits}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Refresh
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            if (deposits.length === 0) {
                                toast({ title: 'No data', description: 'No deposits to export' });
                                return;
                            }
                            const csv = ['Reference,Amount (GHS),Method,Status,Date', ...deposits.map(d =>
                                `${d.reference || d.id},${d.amount.toFixed(2)},${d.method},${d.status},${new Date(d.created_at).toLocaleDateString()}`
                            )].join('\n');
                            const blob = new Blob([csv], { type: 'text/csv' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `deposits-${new Date().toISOString().split('T')[0]}.csv`;
                            a.click();
                            URL.revokeObjectURL(url);
                            toast({ title: 'Exported', description: `${deposits.length} deposits exported to CSV` });
                        }}
                    >
                        <Download className="w-4 h-4 mr-2" />
                        Export
                    </Button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card>
                    <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground">Total Deposited</p>
                        <p className="text-2xl font-bold text-primary">GH₵ {totalDeposits.toFixed(2)}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground">Total Deposits</p>
                        <p className="text-2xl font-bold">{deposits.length}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground">Processing</p>
                        <p className="text-2xl font-bold text-yellow-500">
                            {deposits.filter(d => d.status === 'processing' || d.status === 'pending').length}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <div className="flex gap-2">
                {['all', 'completed', 'processing', 'failed'].map((status) => (
                    <Button
                        key={status}
                        variant={filter === status ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFilter(status)}
                        className="capitalize"
                    >
                        {status}
                    </Button>
                ))}
            </div>

            {/* Deposits Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Deposit History</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="text-left text-sm text-muted-foreground border-b border-border">
                                        <th className="p-4 font-medium">Reference</th>
                                        <th className="p-4 font-medium">Method</th>
                                        <th className="p-4 font-medium">Amount</th>
                                        <th className="p-4 font-medium">Status</th>
                                        <th className="p-4 font-medium">Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Array.from({ length: 5 }).map((_, i) => (
                                        <tr key={i} className="border-b border-border">
                                            <td className="p-4"><Skeleton className="h-4 w-24" /></td>
                                            <td className="p-4"><Skeleton className="h-4 w-20" /></td>
                                            <td className="p-4"><Skeleton className="h-4 w-20" /></td>
                                            <td className="p-4"><Skeleton className="h-6 w-24 rounded-full" /></td>
                                            <td className="p-4"><Skeleton className="h-4 w-24" /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : filteredDeposits.length === 0 ? (
                        <div className="text-center py-12">
                            <CreditCard className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                            <p className="text-muted-foreground">No deposits found</p>
                            <p className="text-sm text-muted-foreground mt-1">
                                Top up your wallet to see deposits here
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="text-left text-sm text-muted-foreground border-b border-border">
                                        <th className="p-4 font-medium">Reference</th>
                                        <th className="p-4 font-medium">Method</th>
                                        <th className="p-4 font-medium">Amount</th>
                                        <th className="p-4 font-medium">Status</th>
                                        <th className="p-4 font-medium">Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredDeposits.map((deposit) => (
                                        <tr key={deposit.id} className="border-b border-border">
                                            <td className="p-4 text-sm font-mono">{deposit.reference || deposit.id.slice(0, 8)}</td>
                                            <td className="p-4 text-sm">{deposit.method}</td>
                                            <td className="p-4 text-sm font-semibold">GH₵ {deposit.amount.toFixed(2)}</td>
                                            <td className="p-4">
                                                <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${deposit.status === 'completed'
                                                    ? 'bg-green-500/20 text-green-500'
                                                    : (deposit.status === 'processing' || deposit.status === 'pending')
                                                        ? 'bg-yellow-500/20 text-yellow-500'
                                                        : 'bg-red-500/20 text-red-500'
                                                    }`}>
                                                    {deposit.status === 'completed' && <CheckCircle className="w-3 h-3" />}
                                                    {(deposit.status === 'processing' || deposit.status === 'pending') && <Clock className="w-3 h-3" />}
                                                    {deposit.status === 'pending' ? 'processing' : deposit.status}
                                                </span>
                                            </td>
                                            <td className="p-4 text-sm text-muted-foreground">
                                                {new Date(deposit.created_at).toLocaleDateString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
