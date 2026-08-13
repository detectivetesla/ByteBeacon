import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { transactionService } from '@/services';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { exportOrders, exportViaApi } from '@/lib/export';
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
    ShoppingCart,
    Search,
    Download,
    RefreshCw,
    CheckCircle2,
    Clock,
    XCircle,
    Package,
    SlidersHorizontal,
    MoreHorizontal,
    ArrowUpDown,
    Calendar,
    Phone,
    Coins,
    ChevronDown,
    Eye,
    FileSpreadsheet,
    FileText,
    FileCode,
    Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PremiumIcon } from '@/components/ui/PremiumIcon';

interface OrderTransaction {
    id: string;
    recipientPhone: string;
    amount: number;
    status: string;
    network: string;
    dataAmount: string;
    createdAt: string;
    updatedAt?: string;
    serialId?: number;
    balanceBefore?: number | null;
    balanceAfter?: number | null;
    source?: string;
    paid?: string;
    sourceProvider?: string;
}

export default function OrdersPage() {
    const { status: statusParam } = useParams<{ status?: string }>();
    const { user } = useAuth();
    const { toast } = useToast();
    const [orders, setOrders] = useState<OrderTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>(statusParam || 'all');
    const [selectedOrder, setSelectedOrder] = useState<OrderTransaction | null>(null);
    const [exporting, setExporting] = useState(false);
    
    // Sorting state
    const [sortConfig, setSortConfig] = useState<{ key: keyof OrderTransaction; direction: 'ascending' | 'descending' } | null>({
        key: 'createdAt',
        direction: 'descending'
    });

    const handleExport = async (format: 'excel' | 'csv' | 'json' = 'csv') => {
        setExporting(true);
        try {
            const params: Record<string, string> = { format };
            if (statusFilter && statusFilter !== 'all') params.status = statusFilter;
            if (searchTerm.trim()) params.search = searchTerm.trim();

            await exportViaApi('/transactions/export', params, `my_orders_${Date.now()}`);
            const formatLabels: Record<string, string> = { excel: 'Excel (.xlsx)', csv: 'CSV', json: 'JSON' };
            toast({ title: 'Export Ready', description: `Full orders history exported to ${formatLabels[format]}.` });
        } catch (err: any) {
            if (processedOrders.length > 0) {
                exportOrders(processedOrders, { filename: 'my_orders', format, sheetName: 'My Orders' });
                toast({ title: 'Export Downloaded', description: `Exported ${processedOrders.length} displayed orders.` });
            } else {
                toast({ title: 'Export Failed', description: err.message || 'Could not export orders.', variant: 'destructive' });
            }
        } finally {
            setExporting(false);
        }
    };

    // Column visibility state
    const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
        orderId: true,
        size: true,
        recipient: true,
        network: true,
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

    useEffect(() => {
        if (statusParam) {
            setStatusFilter(statusParam);
        }
    }, [statusParam]);

    const fetchOrders = useCallback(async () => {
        if (!user) return;

        setLoading(true);
        try {
            const data = await transactionService.getAll();
            setOrders(data as OrderTransaction[]);
        } catch (err) {
            console.error('Error fetching orders:', err);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (user) {
            fetchOrders();
        }
    }, [user, fetchOrders]);

    // Sorting handler
    const requestSort = (key: keyof OrderTransaction) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    // Filtered & Sorted orders
    const processedOrders = useMemo(() => {
        let result = orders.filter(order => {
            const displayId = `ORD-${order.serialId || order.id.slice(0, 7).toUpperCase()}`;
            const matchesSearch = 
                order.recipientPhone.includes(searchTerm) ||
                displayId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                order.network.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (order.sourceProvider && order.sourceProvider.toLowerCase().includes(searchTerm.toLowerCase()));

            const matchesStatus = statusFilter === 'all' ||
                (statusFilter === 'processing' && (order.status === 'processing' || order.status === 'pending' || order.status === 'ongoing' || order.status === 'queued')) ||
                (statusFilter === 'completed' && order.status === 'completed') ||
                order.status === statusFilter;

            return matchesSearch && matchesStatus;
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
    }, [orders, searchTerm, statusFilter, sortConfig]);

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'pending_mtn_approval':
            case 'awaiting_mtn_approval':
                return <Clock className="w-4 h-4 text-amber-400 animate-pulse" />;
            case 'completed':
                return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
            case 'processing':
            case 'pending':
            case 'ongoing':
            case 'queued':
                return <Clock className="w-4 h-4 text-amber-500 animate-pulse" />;
            case 'pending_payment':
                return <Clock className="w-4 h-4 text-blue-500 animate-pulse" />;
            case 'failed':
            default:
                return <XCircle className="w-4 h-4 text-red-500" />;
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'pending_mtn_approval':
            case 'awaiting_mtn_approval':
                return 'bg-amber-500/15 text-amber-300 border border-amber-500/30';
            case 'completed':
                return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
            case 'processing':
            case 'pending':
            case 'ongoing':
            case 'queued':
                return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
            case 'pending_payment':
                return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
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

    const stats = {
        total: orders.length,
        pending: orders.filter(o => o.status === 'processing' || o.status === 'ongoing' || o.status === 'queued' || o.status === 'pending').length,
        completed: orders.filter(o => o.status === 'completed').length,
        failed: orders.filter(o => o.status === 'failed').length,
    };

    const columnsList = [
        { id: 'orderId', label: 'Order ID' },
        { id: 'size', label: 'Size' },
        { id: 'recipient', label: 'Recipient' },
        { id: 'network', label: 'Network' },
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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 p-1">
                <div className="flex items-center gap-4">
                    <PremiumIcon
                        icon={ShoppingCart}
                        variant="emerald"
                        size="lg"
                        showBackground={true}
                    />
                    <div>
                        <h1 className="font-display text-3xl md:text-4xl font-black tracking-tight text-foreground">Orders</h1>
                        <p className="text-muted-foreground font-medium">Manage and track your data bundle orders</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <Button
                        variant="outline"
                        size="default"
                        onClick={fetchOrders}
                        className="rounded-xl border-border/50 hover:bg-primary/10 hover:text-primary transition-all font-bold"
                    >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Refresh
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="outline"
                                size="default"
                                disabled={exporting}
                                className="rounded-xl border-border/50 hover:bg-primary/10 hover:text-primary transition-all font-bold"
                            >
                                {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                                {exporting ? 'Exporting...' : 'Export'}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-card border-border">
                            <DropdownMenuLabel>Export Format</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleExport('excel')} className="cursor-pointer">
                                <FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-500" />
                                Export to Excel (.xlsx)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleExport('csv')} className="cursor-pointer">
                                <FileText className="w-4 h-4 mr-2 text-blue-500" />
                                Export to CSV (.csv)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleExport('json')} className="cursor-pointer">
                                <FileCode className="w-4 h-4 mr-2 text-purple-500" />
                                Export to JSON (.json)
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="bg-blue-500/5 border-blue-500/20 group hover:shadow-md transition-all duration-300">
                    <CardContent className="p-5 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <ShoppingCart className="w-6 h-6 text-blue-500" />
                        </div>
                        <div>
                            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Total</p>
                            <p className="text-3xl font-display font-bold">{stats.total}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-amber-500/5 border-amber-500/20 group hover:shadow-md transition-all duration-300">
                    <CardContent className="p-5 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Clock className="w-6 h-6 text-amber-500 animate-pulse" />
                        </div>
                        <div>
                            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Processing</p>
                            <p className="text-3xl font-display font-bold text-amber-500">{stats.pending}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-emerald-500/5 border-emerald-500/20 group hover:shadow-md transition-all duration-300">
                    <CardContent className="p-5 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                        </div>
                        <div>
                            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Success</p>
                            <p className="text-3xl font-display font-bold text-emerald-500">{stats.completed}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-red-500/5 border-red-500/20 group hover:shadow-md transition-all duration-300">
                    <CardContent className="p-5 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <XCircle className="w-6 h-6 text-red-500" />
                        </div>
                        <div>
                            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Failed</p>
                            <p className="text-3xl font-display font-bold text-red-500">{stats.failed}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filter & Options Toolbar */}
            <Card className="border-border/50 bg-card/60 backdrop-blur-xl">
                <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Left: Search & Filter */}
                    <div className="flex flex-col sm:flex-row gap-3 flex-1">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Search order ID, recipient, network or source..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 bg-accent/40 border-border/50 text-foreground"
                            />
                        </div>
                        <div className="flex gap-1.5 overflow-x-auto hide-scrollbar">
                            {['all', 'processing', 'completed', 'failed'].map((status) => (
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
                    </div>

                    {/* Right: Column Visibility */}
                    <div className="flex items-center gap-3 shrink-0">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="rounded-lg border-border/50 font-semibold flex items-center gap-1.5">
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
                                    {visibleColumns.size && (
                                        <th 
                                            className="p-4 text-xs font-bold uppercase tracking-widest text-muted-foreground cursor-pointer hover:text-foreground"
                                            onClick={() => requestSort('dataAmount')}
                                        >
                                            <div className="flex items-center gap-1.5">
                                                Size
                                                <ArrowUpDown className="w-3.5 h-3.5" />
                                            </div>
                                        </th>
                                    )}
                                    {visibleColumns.recipient && (
                                        <th className="p-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">Recipient</th>
                                    )}
                                    {visibleColumns.network && (
                                        <th 
                                            className="p-4 text-xs font-bold uppercase tracking-widest text-muted-foreground cursor-pointer hover:text-foreground"
                                            onClick={() => requestSort('network')}
                                        >
                                            <div className="flex items-center gap-1.5">
                                                Network
                                                <ArrowUpDown className="w-3.5 h-3.5" />
                                            </div>
                                        </th>
                                    )}
                                    {visibleColumns.status && (
                                        <th 
                                            className="p-4 text-xs font-bold uppercase tracking-widest text-muted-foreground cursor-pointer hover:text-foreground"
                                            onClick={() => requestSort('status')}
                                        >
                                            <div className="flex items-center gap-1.5">
                                                Status
                                                <ArrowUpDown className="w-3.5 h-3.5" />
                                            </div>
                                        </th>
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
                                            onClick={() => requestSort('amount')}
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
                                            onClick={() => requestSort('createdAt')}
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
                                ) : processedOrders.length === 0 ? (
                                    <tr>
                                        <td colSpan={columnsList.length + 1} className="py-12 text-center text-muted-foreground">
                                            <Package className="w-10 h-10 mx-auto mb-2 text-muted-foreground/50" />
                                            No orders match the current filter or search query.
                                        </td>
                                    </tr>
                                ) : (
                                    processedOrders.map((order, index) => {
                                        const displayId = `ORD-${order.serialId || order.id.slice(0, 7).toUpperCase()}`;
                                        return (
                                            <tr 
                                                key={order.id} 
                                                className={cn(
                                                    "border-b border-border/40 hover:bg-accent/20 transition-colors",
                                                    index % 2 === 0 ? 'bg-card/25' : 'bg-transparent'
                                                )}
                                            >
                                                {visibleColumns.orderId && (
                                                    <td className="p-4 font-mono text-xs font-bold text-foreground">{displayId}</td>
                                                )}
                                                {visibleColumns.size && (
                                                    <td className="p-4 text-sm font-semibold">{order.dataAmount}</td>
                                                )}
                                                {visibleColumns.recipient && (
                                                    <td className="p-4 text-sm font-medium">{order.recipientPhone}</td>
                                                )}
                                                {visibleColumns.network && (
                                                    <td className="p-4 text-sm">
                                                        <span className={cn(
                                                            "px-2.5 py-0.5 rounded text-[11px] font-bold uppercase",
                                                            getNetworkBadge(order.network)
                                                        )}>
                                                            {order.network}
                                                        </span>
                                                    </td>
                                                )}
                                                {visibleColumns.status && (
                                                    <td className="p-4 text-sm">
                                                        <span className={cn(
                                                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-wide",
                                                            getStatusBadge(order.status)
                                                        )}>
                                                            {getStatusIcon(order.status)}
                                                            {order.status === 'pending_mtn_approval' || order.status === 'awaiting_mtn_approval'
                                                                ? 'Awaiting MTN Approval'
                                                                : order.status === 'pending'
                                                                ? 'processing'
                                                                : order.status === 'pending_payment'
                                                                ? 'pending payment'
                                                                : order.status}
                                                        </span>
                                                    </td>
                                                )}
                                                {visibleColumns.source && (
                                                    <td className="p-4 text-sm hidden lg:table-cell">
                                                        <span className={cn(
                                                            "px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border tracking-wider",
                                                            order.source === 'api' 
                                                                ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' 
                                                                : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                                        )}>
                                                            {order.source || 'web'}
                                                        </span>
                                                    </td>
                                                )}
                                                {visibleColumns.paid && (
                                                    <td className="p-4 text-sm hidden md:table-cell">
                                                        <span className={cn(
                                                            "px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border tracking-wider",
                                                            order.paid === 'no' 
                                                                ? 'bg-red-500/10 text-red-400 border-red-500/20' 
                                                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                                        )}>
                                                            {order.paid || 'yes'}
                                                        </span>
                                                    </td>
                                                )}
                                                {visibleColumns.balBefore && (
                                                    <td className="p-4 font-mono text-xs hidden xl:table-cell text-muted-foreground">{formatGHS(order.balanceBefore)}</td>
                                                )}
                                                {visibleColumns.amount && (
                                                    <td className="p-4 font-mono text-sm font-extrabold text-foreground">{formatGHS(order.amount)}</td>
                                                )}
                                                {visibleColumns.balAfter && (
                                                    <td className="p-4 font-mono text-xs hidden xl:table-cell text-muted-foreground">{formatGHS(order.balanceAfter)}</td>
                                                )}
                                                {visibleColumns.date && (
                                                    <td className="p-4 text-xs text-muted-foreground hidden sm:table-cell">{formatDate(order.createdAt)}</td>
                                                )}
                                                {visibleColumns.updated && (
                                                    <td className="p-4 text-xs text-muted-foreground hidden xl:table-cell">
                                                        {order.updatedAt ? formatDate(order.updatedAt) : '—'}
                                                    </td>
                                                )}
                                                {visibleColumns.actions && (
                                                    <td className="p-4 text-sm text-right">
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-accent rounded-lg">
                                                                    <MoreHorizontal className="w-4 h-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" className="bg-card border-border">
                                                                <DropdownMenuItem 
                                                                    onClick={() => setSelectedOrder(order)}
                                                                    className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
                                                                >
                                                                    <Eye className="w-3.5 h-3.5" />
                                                                    View Details
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
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
                        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                            {/* Summary Card */}
                            <div className="p-4 bg-accent/30 rounded-xl flex items-center justify-between">
                                <div className="space-y-1">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Order Amount</span>
                                    <p className="text-2xl font-display font-black text-primary">{formatGHS(selectedOrder.amount)}</p>
                                </div>
                                <span className={cn(
                                    "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase",
                                    getStatusBadge(selectedOrder.status)
                                )}>
                                    {getStatusIcon(selectedOrder.status)}
                                    {selectedOrder.status === 'pending' ? 'processing' : selectedOrder.status === 'pending_payment' ? 'pending payment' : selectedOrder.status}
                                </span>
                            </div>

                            {/* Info Fields */}
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div className="p-3 bg-accent/20 border border-border/30 rounded-xl space-y-1">
                                    <div className="flex items-center gap-1 text-muted-foreground text-xs font-bold uppercase tracking-wider">
                                        <Package className="w-3.5 h-3.5" />
                                        Bundle Size
                                    </div>
                                    <span className="font-semibold text-foreground">{selectedOrder.dataAmount} ({selectedOrder.network})</span>
                                </div>
                                <div className="p-3 bg-accent/20 border border-border/30 rounded-xl space-y-1">
                                    <div className="flex items-center gap-1 text-muted-foreground text-xs font-bold uppercase tracking-wider">
                                        <Phone className="w-3.5 h-3.5" />
                                        Recipient
                                    </div>
                                    <span className="font-semibold text-foreground font-mono">{selectedOrder.recipientPhone}</span>
                                </div>
                                <div className="p-3 bg-accent/20 border border-border/30 rounded-xl space-y-1">
                                    <div className="flex items-center gap-1 text-muted-foreground text-xs font-bold uppercase tracking-wider">
                                        <Calendar className="w-3.5 h-3.5" />
                                        Placed Date
                                    </div>
                                    <span className="font-medium text-foreground text-xs">{formatDate(selectedOrder.createdAt)}</span>
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
                                <h4 className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground">Order Sourcing Metadata</h4>
                                <div className="space-y-2.5 text-xs">
                                    <div className="flex justify-between items-center">
                                        <span className="text-muted-foreground font-medium">Source:</span>
                                        <span className="font-semibold capitalize text-foreground">{selectedOrder.source || 'web'}</span>
                                    </div>
                                    {selectedOrder.sourceProvider && (
                                        <div className="flex justify-between items-center">
                                            <span className="text-muted-foreground font-medium">Sourcing API:</span>
                                            <span className="font-mono bg-accent/50 px-1.5 py-0.5 rounded text-[10px] text-foreground font-bold uppercase">{selectedOrder.sourceProvider}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center">
                                        <span className="text-muted-foreground font-medium">Payment Method:</span>
                                        <span className="font-semibold text-foreground">{selectedOrder.paid === 'no' ? 'Credit' : 'Wallet Deduction'}</span>
                                    </div>
                                    {selectedOrder.balanceBefore !== null && selectedOrder.balanceBefore !== undefined && (
                                        <div className="flex justify-between items-center">
                                            <span className="text-muted-foreground font-medium">Balance Before:</span>
                                            <span className="font-mono text-muted-foreground">{formatGHS(selectedOrder.balanceBefore)}</span>
                                        </div>
                                    )}
                                    {selectedOrder.balanceAfter !== null && selectedOrder.balanceAfter !== undefined && (
                                        <div className="flex justify-between items-center">
                                            <span className="text-muted-foreground font-medium">Balance After:</span>
                                            <span className="font-mono text-muted-foreground">{formatGHS(selectedOrder.balanceAfter)}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-border/50 flex justify-end bg-accent/20">
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
        </div>
    );
}
