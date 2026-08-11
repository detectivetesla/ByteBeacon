import { useState, useEffect, useCallback, useMemo } from 'react';
import { adminService } from '@/services';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { exportTransactions } from '@/lib/export';
import { useSocket } from '@/contexts/SocketContext';
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuCheckboxItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuItem
} from '@/components/ui/dropdown-menu';
import {
    Receipt,
    Search,
    Download,
    RefreshCw,
    CheckCircle2,
    Clock,
    XCircle,
    RotateCcw,
    Package,
    SlidersHorizontal,
    MoreHorizontal,
    ArrowUpDown,
    Calendar,
    Phone,
    User,
    ShieldCheck,
    ChevronDown,
    Eye,
    RotateCcw,
    AlertTriangle,
    Loader2,
    FileSpreadsheet,
    FileText,
    FileCode
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Transaction {
    id: string;
    user_id: string;
    user_name: string;
    user_email: string;
    recipient_phone: string;
    network: string;
    data_amount: string;
    amount_ghc: number;
    status: string;
    created_at: string;
    paystack_reference: string;
    serialId?: number;
    balanceBefore?: number | null;
    balanceAfter?: number | null;
    source?: string;
    paid?: string;
    sourceProvider?: string;
    updatedAt?: string;
}

export default function AdminTransactionsPage() {
    const { toast } = useToast();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [syncingId, setSyncingId] = useState<string | null>(null);
    const [selectedOrder, setSelectedOrder] = useState<Transaction | null>(null);
    const [reprocessingId, setReprocessingId] = useState<string | null>(null);
    const [massReprocessing, setMassReprocessing] = useState(false);
    const [showMassReprocessConfirm, setShowMassReprocessConfirm] = useState(false);

    const [stats, setStats] = useState({
        totalTransactions: 0,
        completedCount: 0,
        completedValue: 0,
        pendingCount: 0,
        failedCount: 0
    });

    // Sorting state
    const [sortConfig, setSortConfig] = useState<{ key: keyof Transaction; direction: 'ascending' | 'descending' } | null>({
        key: 'created_at',
        direction: 'descending'
    });

    // Column visibility state
    const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
        orderId: true,
        customer: true,
        recipient: true,
        network: true,
        size: true,
        status: true,
        source: true,
        paid: true,
        balBefore: true,
        amount: true,
        balAfter: true,
        date: true,
        updated: true,
        actions: true
    });

    const fetchTransactions = useCallback(async () => {
        setLoading(true);
        try {
            const [data, statsData] = await Promise.all([
                adminService.getTransactions({}),
                adminService.getTransactionStats()
            ]);

            setStats(statsData);
            const txFormatted = data.map(tx => ({
                id: tx.id,
                user_id: '',
                user_name: tx.userName || 'Unknown',
                user_email: tx.userEmail || '',
                recipient_phone: tx.recipientPhone,
                network: tx.network || 'N/A',
                data_amount: tx.dataAmount || 'N/A',
                amount_ghc: tx.amount,
                status: tx.status,
                created_at: tx.createdAt,
                paystack_reference: tx.id.slice(0, 12),
                serialId: tx.serialId,
                balanceBefore: tx.balanceBefore,
                balanceAfter: tx.balanceAfter,
                source: tx.source,
                paid: tx.paid,
                sourceProvider: tx.sourceProvider,
                updatedAt: tx.updatedAt
            }));
            setTransactions(txFormatted);
        } catch (err) {
            console.error('Error fetching transactions:', err);
            toast({ title: 'Error', description: 'Failed to fetch transactions', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchTransactions();
    }, [fetchTransactions]);

    const { socket } = useSocket();

    useEffect(() => {
        if (!socket) return;

        const handleUpdate = (data: any) => {
            console.log('🔄 Admin received real-time update:', data);
            fetchTransactions();
        };

        socket.on('transactionUpdate', handleUpdate);
        return () => socket.off('transactionUpdate', handleUpdate);
    }, [socket, fetchTransactions]);

    const handleSync = async (id: string) => {
        setSyncingId(id);
        try {
            const result = await adminService.syncTransactionStatus(id);
            if (result.synced) {
                toast({
                    title: 'Sync Successful',
                    description: `Transaction status is now ${result.newStatus || 'updated'}.`
                });
                fetchTransactions();
            } else {
                toast({
                    title: 'Status Up to Date',
                    description: result.message || 'The transaction status matches the provider.'
                });
            }
        } catch (err) {
            console.error('Sync error:', err);
            toast({
                title: 'Sync Failed',
                description: 'Failed to sync with provider. Please try again later.',
                variant: 'destructive'
            });
        } finally {
            setSyncingId(null);
        }
    };

    // Sorting handler
    const requestSort = (key: keyof Transaction) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    // Filtered & Sorted transactions
    const processedTransactions = useMemo(() => {
        let result = transactions.filter(tx => {
            const displayId = `ORD-${tx.serialId || tx.id.slice(0, 7).toUpperCase()}`;
            const matchesSearch =
                tx.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                tx.user_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                tx.recipient_phone.includes(searchTerm) ||
                displayId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (tx.sourceProvider && tx.sourceProvider.toLowerCase().includes(searchTerm.toLowerCase()));

            const matchesStatus = statusFilter === 'all' || tx.status === statusFilter;

            let matchesDate = true;
            const txDate = new Date(tx.created_at);
            if (dateFilter !== 'all') {
                const now = new Date();
                if (dateFilter === 'today') {
                    matchesDate = txDate.toDateString() === now.toDateString();
                } else if (dateFilter === 'week') {
                    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    matchesDate = txDate >= weekAgo;
                } else if (dateFilter === 'month') {
                    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    matchesDate = txDate >= monthAgo;
                }
            }

            if (startDate) {
                const start = new Date(startDate);
                start.setHours(0, 0, 0, 0);
                if (txDate < start) matchesDate = false;
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                if (txDate > end) matchesDate = false;
            }

            return matchesSearch && matchesStatus && matchesDate;
        });

        if (sortConfig !== null) {
            result.sort((a, b) => {
                const aVal = a[sortConfig.key];
                const bVal = b[sortConfig.key];

                if (aVal === undefined || aVal === null) return 1;
                if (bVal === undefined || bVal === null) return -1;

                if (aVal < bVal) {
                    return sortConfig.direction === 'ascending' ? -1 : 1;
                }
                if (aVal > bVal) {
                    return sortConfig.direction === 'ascending' ? 1 : -1;
                }
                return 0;
            });
        }
        return result;
    }, [transactions, searchTerm, statusFilter, dateFilter, startDate, endDate, sortConfig]);

    const handleExport = (format: 'excel' | 'csv' | 'json' = 'csv') => {
        if (processedTransactions.length === 0) {
            toast({ title: 'No Data', description: 'No transactions available to export', variant: 'destructive' });
            return;
        }
        exportTransactions(processedTransactions, { filename: 'transactions', format, sheetName: 'Transactions' });
        const formatLabels: Record<string, string> = { excel: 'Excel (.xls)', csv: 'CSV', json: 'JSON' };
        toast({ title: 'Export Complete', description: `Exported ${processedTransactions.length} transaction(s) to ${formatLabels[format]}` });
    };

    const handleReprocess = async (id: string) => {
        setReprocessingId(id);
        try {
            const result = await adminService.reprocessTransaction(id);
            toast({
                title: 'Reprocess Initiated',
                description: result.message || 'Order has been requeued for processing.'
            });
            fetchTransactions();
        } catch (err: any) {
            console.error('Reprocess error:', err);
            toast({
                title: 'Reprocess Failed',
                description: err?.response?.data?.error || err?.message || 'Failed to reprocess order.',
                variant: 'destructive'
            });
        } finally {
            setReprocessingId(null);
        }
    };

    const handleMassReprocess = async () => {
        setShowMassReprocessConfirm(false);
        setMassReprocessing(true);
        try {
            const result = await adminService.massReprocessFailedTransactions();
            toast({
                title: 'Mass Reprocess Initiated',
                description: result.message || `${result.count} orders requeued.`
            });
            fetchTransactions();
        } catch (err: any) {
            console.error('Mass reprocess error:', err);
            toast({
                title: 'Mass Reprocess Failed',
                description: err?.response?.data?.error || err?.message || 'Failed to mass reprocess orders.',
                variant: 'destructive'
            });
        } finally {
            setMassReprocessing(false);
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed':
                return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
            case 'processing':
            case 'pending':
            case 'ongoing':
            case 'queued':
                return <Clock className="w-4 h-4 text-amber-500 animate-pulse" />;
            case 'refunded':
                return <RotateCcw className="w-4 h-4 text-purple-400" />;
            case 'failed':
            default:
                return <XCircle className="w-4 h-4 text-red-500" />;
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'completed':
                return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
            case 'processing':
            case 'pending':
            case 'ongoing':
            case 'queued':
                return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
            case 'refunded':
                return 'bg-purple-500/10 text-purple-400 border border-purple-500/20';
            case 'failed':
            default:
                return 'bg-red-500/10 text-red-400 border border-red-500/20';
        }
    };

    const getNetworkBadge = (network: string) => {
        const net = network.toUpperCase();
        if (net.includes('MTN')) {
            return 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20';
        }
        if (net.includes('TELECEL') || net.includes('VODA')) {
            return 'bg-red-500/10 text-red-500 border border-red-500/20';
        }
        return 'bg-blue-500/10 text-blue-500 border border-blue-500/20';
    };

    const formatGHS = (val?: number | null) => {
        if (val === undefined || val === null) return '—';
        return `₵${val.toFixed(2)}`;
    };

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString(undefined, { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric' 
        }) + ' ' + d.toLocaleTimeString(undefined, { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: false
        });
    };

    const columnsList = [
        { id: 'orderId', label: 'Order ID' },
        { id: 'customer', label: 'Customer' },
        { id: 'recipient', label: 'Recipient' },
        { id: 'network', label: 'Network' },
        { id: 'size', label: 'Size' },
        { id: 'status', label: 'Status' },
        { id: 'source', label: 'Source' },
        { id: 'paid', label: 'Paid' },
        { id: 'balBefore', label: 'Bal. Before' },
        { id: 'amount', label: 'Amount' },
        { id: 'balAfter', label: 'Bal. After' },
        { id: 'date', label: 'Date' },
        { id: 'updated', label: 'Updated' }
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-1">
                <div className="flex items-center gap-3">
                    <Receipt className="w-8 h-8 text-primary" />
                    <div>
                        <h1 className="text-3xl font-display font-black tracking-tight text-foreground">Transactions</h1>
                        <p className="text-muted-foreground font-medium">View all platform transactions</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    {stats.failedCount > 0 && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowMassReprocessConfirm(true)}
                            disabled={massReprocessing}
                            className="rounded-xl border-red-500/30 bg-red-500/5 hover:bg-red-500/15 text-red-400 hover:text-red-300 transition-all font-bold h-9"
                        >
                            {massReprocessing ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <RotateCcw className="w-4 h-4 mr-2" />
                            )}
                            Mass Reprocess Failed ({stats.failedCount})
                        </Button>
                    )}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchTransactions}
                        className="rounded-xl border-border/50 hover:bg-primary/10 hover:text-primary transition-all font-bold h-9"
                    >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Refresh
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button 
                                variant="outline" 
                                size="sm"
                                className="rounded-xl border-border/50 hover:bg-primary/10 hover:text-primary transition-all font-bold h-9"
                            >
                                <Download className="w-4 h-4 mr-2" />
                                Export
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-card border-border">
                            <DropdownMenuLabel>Export Format</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleExport('excel')} className="cursor-pointer">
                                <FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-500" />
                                Export to Excel (.xlsx / .xls)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleExport('csv')} className="cursor-pointer">
                                <FileText className="w-4 h-4 mr-2 text-blue-500" />
                                Export to CSV
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleExport('json')} className="cursor-pointer">
                                <FileCode className="w-4 h-4 mr-2 text-purple-500" />
                                Export to JSON
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="bg-blue-500/5 border-blue-500/20 group hover:shadow-md transition-all duration-300">
                    <CardContent className="p-5 flex flex-col items-center justify-center text-center">
                        <p className="text-3xl font-display font-bold">{stats.totalTransactions}</p>
                        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mt-1">Total Transactions</p>
                    </CardContent>
                </Card>
                <Card className="bg-emerald-500/5 border-emerald-500/20 group hover:shadow-md transition-all duration-300">
                    <CardContent className="p-5 flex flex-col items-center justify-center text-center">
                        <p className="text-3xl font-display font-bold text-emerald-500">{stats.completedCount}</p>
                        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mt-1">Completed Orders</p>
                    </CardContent>
                </Card>
                <Card className="bg-amber-500/5 border-amber-500/20 group hover:shadow-md transition-all duration-300">
                    <CardContent className="p-5 flex flex-col items-center justify-center text-center">
                        <p className="text-3xl font-display font-bold text-amber-500">{stats.pendingCount}</p>
                        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mt-1">Processing</p>
                    </CardContent>
                </Card>
                <Card className="bg-red-500/5 border-red-500/20 group hover:shadow-md transition-all duration-300">
                    <CardContent className="p-5 flex flex-col items-center justify-center text-center">
                        <p className="text-3xl font-display font-bold text-red-500">{stats.failedCount}</p>
                        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mt-1">Failed</p>
                    </CardContent>
                </Card>
            </div>

            {/* Filter & Options Toolbar */}
            <Card className="border-border/50 bg-card/60 backdrop-blur-xl">
                <CardContent className="p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                    {/* Search & Filter */}
                    <div className="flex flex-col md:flex-row gap-3 flex-1 flex-wrap">
                        <div className="relative min-w-[240px] flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by name, phone, or reference..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 bg-accent/40 border-border/50 text-foreground"
                            />
                        </div>
                        <div className="flex gap-1.5 overflow-x-auto hide-scrollbar">
                            {['all', 'processing', 'completed', 'failed', 'refunded'].map((status) => (
                                <Button
                                    key={status}
                                    variant={statusFilter === status ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setStatusFilter(status)}
                                    className="capitalize rounded-lg px-4 border-border/50 font-semibold"
                                >
                                    {status}
                                </Button>
                            ))}
                        </div>
                        <div className="flex gap-1.5 overflow-x-auto hide-scrollbar">
                            {(['all', 'today', 'week', 'month'] as const).map((date) => (
                                <Button
                                    key={date}
                                    variant={dateFilter === date ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setDateFilter(date)}
                                    className="rounded-lg px-4 border-border/50 font-semibold whitespace-nowrap"
                                >
                                    {date === 'all' ? 'All Time' : date.charAt(0).toUpperCase() + date.slice(1)}
                                </Button>
                            ))}
                        </div>
                    </div>

                    {/* Date filter picker & columns */}
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 text-sm">
                            <span className="text-muted-foreground text-xs font-semibold">From:</span>
                            <Input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-[125px] h-8 bg-accent/40 border-border/50 text-foreground text-xs p-2 rounded-lg"
                            />
                            <span className="text-muted-foreground text-xs font-semibold">To:</span>
                            <Input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-[125px] h-8 bg-accent/40 border-border/50 text-foreground text-xs p-2 rounded-lg"
                            />
                            {(startDate || endDate) && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => { setStartDate(''); setEndDate(''); }}
                                    className="text-red-400 hover:text-red-500 font-bold h-8 text-xs px-2"
                                >
                                    Clear
                                </Button>
                            )}
                        </div>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="rounded-lg border-border/50 font-semibold flex items-center gap-1.5 h-8">
                                    <SlidersHorizontal className="w-4 h-4" />
                                    Columns
                                    <ChevronDown className="w-3.5 h-3.5" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-card border-border max-h-[300px] overflow-y-auto">
                                <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {columnsList.map((col) => (
                                    <DropdownMenuCheckboxItem
                                        key={col.id}
                                        checked={visibleColumns[col.id]}
                                        onCheckedChange={(checked) =>
                                            setVisibleColumns(prev => ({ ...prev, [col.id]: checked }))
                                        }
                                        className="capitalize"
                                    >
                                        {col.label}
                                    </DropdownMenuCheckboxItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </CardContent>
            </Card>

            {/* Table Card */}
            <Card className="border-border/50 bg-card/60 backdrop-blur-xl overflow-hidden">
                <CardContent className="p-0">
                    <div className="overflow-x-auto max-w-full">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-border/50 bg-accent/20">
                                    {visibleColumns.orderId && (
                                        <th 
                                            className="p-4 text-xs font-bold uppercase tracking-widest text-muted-foreground cursor-pointer hover:text-foreground"
                                            onClick={() => requestSort('serialId')}
                                        >
                                            <div className="flex items-center gap-1.5">
                                                Order ID
                                                <ArrowUpDown className="w-3.5 h-3.5" />
                                            </div>
                                        </th>
                                    )}
                                    {visibleColumns.customer && (
                                        <th 
                                            className="p-4 text-xs font-bold uppercase tracking-widest text-muted-foreground cursor-pointer hover:text-foreground"
                                            onClick={() => requestSort('user_name')}
                                        >
                                            <div className="flex items-center gap-1.5">
                                                Customer
                                                <ArrowUpDown className="w-3.5 h-3.5" />
                                            </div>
                                        </th>
                                    )}
                                    {visibleColumns.recipient && (
                                        <th className="p-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">Recipient</th>
                                    )}
                                    {visibleColumns.network && (
                                        <th className="p-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">Network</th>
                                    )}
                                    {visibleColumns.size && (
                                        <th className="p-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">Size</th>
                                    )}
                                    {visibleColumns.status && (
                                        <th className="p-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">Status</th>
                                    )}
                                    {visibleColumns.source && (
                                        <th className="p-4 text-xs font-bold uppercase tracking-widest text-muted-foreground hidden lg:table-cell">Source</th>
                                    )}
                                    {visibleColumns.paid && (
                                        <th className="p-4 text-xs font-bold uppercase tracking-widest text-muted-foreground hidden md:table-cell">Paid</th>
                                    )}
                                    {visibleColumns.balBefore && (
                                        <th className="p-4 text-xs font-bold uppercase tracking-widest text-muted-foreground hidden xl:table-cell">Bal. Before</th>
                                    )}
                                    {visibleColumns.amount && (
                                        <th 
                                            className="p-4 text-xs font-bold uppercase tracking-widest text-muted-foreground cursor-pointer hover:text-foreground"
                                            onClick={() => requestSort('amount_ghc')}
                                        >
                                            <div className="flex items-center gap-1.5">
                                                Amount
                                                <ArrowUpDown className="w-3.5 h-3.5" />
                                            </div>
                                        </th>
                                    )}
                                    {visibleColumns.balAfter && (
                                        <th className="p-4 text-xs font-bold uppercase tracking-widest text-muted-foreground hidden xl:table-cell">Bal. After</th>
                                    )}
                                    {visibleColumns.date && (
                                        <th 
                                            className="p-4 text-xs font-bold uppercase tracking-widest text-muted-foreground cursor-pointer hover:text-foreground hidden sm:table-cell"
                                            onClick={() => requestSort('created_at')}
                                        >
                                            <div className="flex items-center gap-1.5">
                                                Date
                                                <ArrowUpDown className="w-3.5 h-3.5" />
                                            </div>
                                        </th>
                                    )}
                                    {visibleColumns.updated && (
                                        <th className="p-4 text-xs font-bold uppercase tracking-widest text-muted-foreground hidden xl:table-cell">Updated</th>
                                    )}
                                    {visibleColumns.actions && (
                                        <th className="p-4 text-xs font-bold uppercase tracking-widest text-muted-foreground text-right">Actions</th>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <tr key={i} className="border-b border-border/50">
                                            {columnsList.map((col) => (
                                                <td key={col.id} className="p-4">
                                                    <Skeleton className="h-4 w-16" />
                                                </td>
                                            ))}
                                        </tr>
                                    ))
                                ) : processedTransactions.length === 0 ? (
                                    <tr>
                                        <td colSpan={columnsList.length + 1} className="py-12 text-center text-muted-foreground">
                                            No transactions match the query parameters.
                                        </td>
                                    </tr>
                                ) : (
                                    processedTransactions.map((tx, index) => {
                                        const displayId = `ORD-${tx.serialId || tx.id.slice(0, 7).toUpperCase()}`;
                                        const isProcessing = tx.status === 'processing' || tx.status === 'pending' || tx.status === 'ongoing' || tx.status === 'queued';
                                        return (
                                            <tr 
                                                key={tx.id} 
                                                className={cn(
                                                    "border-b border-border/40 hover:bg-accent/20 transition-colors",
                                                    index % 2 === 0 ? 'bg-card/25' : 'bg-transparent'
                                                )}
                                            >
                                                {visibleColumns.orderId && (
                                                    <td className="p-4 font-mono text-xs font-bold text-foreground">{displayId}</td>
                                                )}
                                                {visibleColumns.customer && (
                                                    <td className="p-4">
                                                        <p className="text-foreground text-sm font-semibold">{tx.user_name}</p>
                                                        <p className="text-xs text-muted-foreground">{tx.user_email}</p>
                                                    </td>
                                                )}
                                                {visibleColumns.recipient && (
                                                    <td className="p-4 text-sm font-medium">{tx.recipient_phone}</td>
                                                )}
                                                {visibleColumns.network && (
                                                    <td className="p-4 text-sm">
                                                        <span className={cn(
                                                            "px-2.5 py-0.5 rounded text-[11px] font-bold uppercase",
                                                            getNetworkBadge(tx.network)
                                                        )}>
                                                            {tx.network}
                                                        </span>
                                                    </td>
                                                )}
                                                {visibleColumns.size && (
                                                    <td className="p-4 text-sm font-semibold">{tx.data_amount}</td>
                                                )}
                                                {visibleColumns.status && (
                                                    <td className="p-4 text-sm">
                                                        <span className={cn(
                                                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-wide",
                                                            getStatusBadge(tx.status)
                                                        )}>
                                                            {getStatusIcon(tx.status)}
                                                            {tx.status === 'pending' ? 'processing' : tx.status}
                                                        </span>
                                                    </td>
                                                )}
                                                {visibleColumns.source && (
                                                    <td className="p-4 text-sm hidden lg:table-cell">
                                                        <span className={cn(
                                                            "px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border tracking-wider",
                                                            tx.source === 'api' 
                                                                ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' 
                                                                : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                                        )}>
                                                            {tx.source || 'web'}
                                                        </span>
                                                    </td>
                                                )}
                                                {visibleColumns.paid && (
                                                    <td className="p-4 text-sm hidden md:table-cell">
                                                        <span className={cn(
                                                            "px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border tracking-wider",
                                                            tx.paid === 'no' 
                                                                ? 'bg-red-500/10 text-red-400 border-red-500/20' 
                                                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                                        )}>
                                                            {tx.paid || 'yes'}
                                                        </span>
                                                    </td>
                                                )}
                                                {visibleColumns.balBefore && (
                                                    <td className="p-4 font-mono text-xs hidden xl:table-cell text-muted-foreground">{formatGHS(tx.balanceBefore)}</td>
                                                )}
                                                {visibleColumns.amount && (
                                                    <td className="p-4 font-mono text-sm font-extrabold text-foreground">{formatGHS(tx.amount_ghc)}</td>
                                                )}
                                                {visibleColumns.balAfter && (
                                                    <td className="p-4 font-mono text-xs hidden xl:table-cell text-muted-foreground">{formatGHS(tx.balanceAfter)}</td>
                                                )}
                                                {visibleColumns.date && (
                                                    <td className="p-4 text-xs text-muted-foreground hidden sm:table-cell">{formatDate(tx.created_at)}</td>
                                                )}
                                                {visibleColumns.updated && (
                                                    <td className="p-4 text-xs text-muted-foreground hidden xl:table-cell">
                                                        {tx.updatedAt ? formatDate(tx.updatedAt) : '—'}
                                                    </td>
                                                )}
                                                {visibleColumns.actions && (
                                                    <td className="p-4 text-sm text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            {isProcessing && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8 text-muted-foreground hover:text-primary rounded-lg mr-1.5"
                                                                    onClick={() => handleSync(tx.id)}
                                                                    disabled={syncingId === tx.id}
                                                                    title="Sync status with provider"
                                                                >
                                                                    <RefreshCw className={cn("w-4 h-4", syncingId === tx.id && "animate-spin")} />
                                                                </Button>
                                                            )}
                                                            {tx.status === 'failed' && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8 text-amber-500 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg mr-1.5"
                                                                    onClick={() => handleReprocess(tx.id)}
                                                                    disabled={reprocessingId === tx.id}
                                                                    title="Reprocess Order"
                                                                >
                                                                    {reprocessingId === tx.id ? (
                                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                                    ) : (
                                                                        <RotateCcw className="w-4 h-4" />
                                                                    )}
                                                                </Button>
                                                            )}
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-accent rounded-lg">
                                                                        <MoreHorizontal className="w-4 h-4" />
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end" className="bg-card border-border">
                                                                    <DropdownMenuItem 
                                                                        onClick={() => setSelectedOrder(tx)}
                                                                        className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
                                                                    >
                                                                        <Eye className="w-3.5 h-3.5" />
                                                                        View Details
                                                                    </DropdownMenuItem>
                                                                    {tx.status === 'failed' && (
                                                                        <DropdownMenuItem 
                                                                            onClick={() => handleReprocess(tx.id)}
                                                                            disabled={reprocessingId === tx.id}
                                                                            className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer text-amber-400 focus:text-amber-300"
                                                                        >
                                                                            {reprocessingId === tx.id ? (
                                                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                            ) : (
                                                                                <RotateCcw className="w-3.5 h-3.5" />
                                                                            )}
                                                                            Reprocess Order
                                                                        </DropdownMenuItem>
                                                                    )}
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </div>
                                                    </td>

                                                )}
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* Details Modal */}
            {selectedOrder && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        {/* Modal Header */}
                        <div className="p-5 border-b border-border/50 flex items-center justify-between bg-accent/20">
                            <div>
                                <h3 className="font-display text-lg font-bold text-foreground">
                                    Order details: ORD-{selectedOrder.serialId || selectedOrder.id.slice(0, 7).toUpperCase()}
                                </h3>
                                <p className="text-xs text-muted-foreground font-mono mt-0.5">{selectedOrder.id}</p>
                            </div>
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => setSelectedOrder(null)}
                                className="h-8 w-8 p-0 rounded-lg hover:bg-accent"
                            >
                                <XCircle className="w-5 h-5 text-muted-foreground hover:text-foreground" />
                            </Button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                            {/* Summary Card */}
                            <div className="p-4 bg-accent/30 rounded-xl flex items-center justify-between">
                                <div className="space-y-1">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Order Amount</span>
                                    <p className="text-2xl font-display font-black text-primary">{formatGHS(selectedOrder.amount_ghc)}</p>
                                </div>
                                <span className={cn(
                                    "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase",
                                    getStatusBadge(selectedOrder.status)
                                )}>
                                    {getStatusIcon(selectedOrder.status)}
                                    {selectedOrder.status === 'pending' ? 'processing' : selectedOrder.status}
                                </span>
                            </div>

                            {/* Info Fields */}
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div className="p-3 bg-accent/20 border border-border/30 rounded-xl space-y-1 col-span-2">
                                    <div className="flex items-center gap-1 text-muted-foreground text-xs font-bold uppercase tracking-wider">
                                        <User className="w-3.5 h-3.5" />
                                        Customer Account
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-semibold text-foreground">{selectedOrder.user_name}</span>
                                        <span className="text-xs text-muted-foreground">{selectedOrder.user_email || 'No email'}</span>
                                    </div>
                                </div>
                                <div className="p-3 bg-accent/20 border border-border/30 rounded-xl space-y-1">
                                    <div className="flex items-center gap-1 text-muted-foreground text-xs font-bold uppercase tracking-wider">
                                        <Package className="w-3.5 h-3.5" />
                                        Bundle Size
                                    </div>
                                    <span className="font-semibold text-foreground">{selectedOrder.data_amount} ({selectedOrder.network})</span>
                                </div>
                                <div className="p-3 bg-accent/20 border border-border/30 rounded-xl space-y-1">
                                    <div className="flex items-center gap-1 text-muted-foreground text-xs font-bold uppercase tracking-wider">
                                        <Phone className="w-3.5 h-3.5" />
                                        Recipient
                                    </div>
                                    <span className="font-semibold text-foreground font-mono">{selectedOrder.recipient_phone}</span>
                                </div>
                                <div className="p-3 bg-accent/20 border border-border/30 rounded-xl space-y-1">
                                    <div className="flex items-center gap-1 text-muted-foreground text-xs font-bold uppercase tracking-wider">
                                        <Calendar className="w-3.5 h-3.5" />
                                        Placed Date
                                    </div>
                                    <span className="font-medium text-foreground text-xs">{formatDate(selectedOrder.created_at)}</span>
                                </div>
                                <div className="p-3 bg-accent/20 border border-border/30 rounded-xl space-y-1">
                                    <div className="flex items-center gap-1 text-muted-foreground text-xs font-bold uppercase tracking-wider">
                                        <Calendar className="w-3.5 h-3.5" />
                                        Last Updated
                                    </div>
                                    <span className="font-medium text-foreground text-xs">
                                        {selectedOrder.updatedAt ? formatDate(selectedOrder.updatedAt) : '—'}
                                    </span>
                                </div>
                            </div>

                            {/* Sourcing Info */}
                            <div className="p-4 border border-border/40 rounded-xl space-y-3 bg-accent/10">
                                <h4 className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                                    Admin Audit Metadata
                                </h4>
                                <div className="space-y-2.5 text-xs">
                                    <div className="flex justify-between items-center">
                                        <span className="text-muted-foreground font-medium">Source:</span>
                                        <span className="font-semibold capitalize text-foreground">{selectedOrder.source || 'web'}</span>
                                    </div>
                                    {selectedOrder.sourceProvider && (
                                        <div className="flex justify-between items-center">
                                            <span className="text-muted-foreground font-medium">Routed Sourcing API:</span>
                                            <span className="font-mono bg-accent/50 px-1.5 py-0.5 rounded text-[10px] text-foreground font-bold uppercase">{selectedOrder.sourceProvider}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center">
                                        <span className="text-muted-foreground font-medium">Paid Indicator:</span>
                                        <span className="font-semibold text-foreground">{selectedOrder.paid || 'yes'}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-muted-foreground font-medium">User Wallet Balance Before:</span>
                                        <span className="font-mono text-foreground">{formatGHS(selectedOrder.balanceBefore)}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-muted-foreground font-medium">User Wallet Balance After:</span>
                                        <span className="font-mono text-foreground">{formatGHS(selectedOrder.balanceAfter)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-border/50 flex gap-2 justify-end bg-accent/20">
                            {selectedOrder.status === 'failed' && (
                                <Button 
                                    onClick={() => {
                                        handleReprocess(selectedOrder.id);
                                        setSelectedOrder(null);
                                    }}
                                    variant="outline"
                                    disabled={reprocessingId === selectedOrder.id}
                                    className="border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/15 text-amber-400 hover:text-amber-300 rounded-xl font-bold"
                                >
                                    {reprocessingId === selectedOrder.id ? (
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    ) : (
                                        <RotateCcw className="w-4 h-4 mr-2" />
                                    )}
                                    Reprocess Order
                                </Button>
                            )}
                            {(selectedOrder.status === 'processing' || selectedOrder.status === 'pending' || selectedOrder.status === 'ongoing' || selectedOrder.status === 'queued') && (
                                <Button 
                                    onClick={() => {
                                        handleSync(selectedOrder.id);
                                        setSelectedOrder(null);
                                    }}
                                    variant="outline"
                                    className="border-border text-muted-foreground hover:bg-accent rounded-xl font-bold"
                                >
                                    Force Status Sync
                                </Button>
                            )}
                            <Button 
                                onClick={() => setSelectedOrder(null)}
                                className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold"
                            >
                                Close Window
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Mass Reprocess Confirmation Modal */}
            {showMassReprocessConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-5 border-b border-border/50 flex items-center gap-3 bg-red-500/5">
                            <div className="p-2 bg-red-500/10 rounded-xl">
                                <AlertTriangle className="w-6 h-6 text-red-400" />
                            </div>
                            <div>
                                <h3 className="font-display text-lg font-bold text-foreground">Mass Reprocess Failed Orders</h3>
                                <p className="text-xs text-muted-foreground">This action will requeue all failed orders</p>
                            </div>
                        </div>
                        <div className="p-6 space-y-3">
                            <p className="text-sm text-muted-foreground">
                                You are about to reprocess <span className="font-bold text-red-400">{stats.failedCount}</span> failed transaction(s). 
                                All failed orders will be reset to <span className="font-bold text-amber-400">processing</span> and 
                                immediately queued for delivery.
                            </p>
                            <p className="text-xs text-muted-foreground/70">
                                Note: Orders that were previously refunded will need sufficient wallet balance for re-debiting during individual processing.
                            </p>
                        </div>
                        <div className="p-4 border-t border-border/50 flex gap-2 justify-end bg-accent/20">
                            <Button 
                                onClick={() => setShowMassReprocessConfirm(false)}
                                variant="outline"
                                className="border-border text-muted-foreground hover:bg-accent rounded-xl font-bold"
                            >
                                Cancel
                            </Button>
                            <Button 
                                onClick={handleMassReprocess}
                                className="bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold"
                            >
                                <RotateCcw className="w-4 h-4 mr-2" />
                                Reprocess All ({stats.failedCount})
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
