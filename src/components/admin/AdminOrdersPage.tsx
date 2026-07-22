import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { adminService } from '@/services';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
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
    Loader2,
    CheckCircle2,
    Clock,
    XCircle,
    RefreshCw,
    SlidersHorizontal,
    MoreHorizontal,
    ArrowUpDown,
    Calendar,
    Phone,
    User,
    Package,
    ShieldCheck,
    HelpCircle,
    Ban,
    ChevronDown,
    Eye,
    Download,
    FileSpreadsheet,
    FileText,
    FileCode,
    RotateCcw
} from 'lucide-react';
import { exportOrders } from '@/lib/export';
import { cn } from '@/lib/utils';

interface Order {
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
    reference: string;
    serialId?: number;
    balanceBefore?: number | null;
    balanceAfter?: number | null;
    source?: string;
    paid?: string;
    sourceProvider?: string;
    updatedAt?: string;
}

export default function AdminOrdersPage() {
    const { toast } = useToast();
    const location = useLocation();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [reprocessingId, setReprocessingId] = useState<string | null>(null);
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

    // Sync status & network filter from route path
    useEffect(() => {
        if (location.pathname.endsWith('/mtn')) {
            setNetworkFilter('mtn');
            setStatusFilter('all');
        } else if (location.pathname.endsWith('/at')) {
            setNetworkFilter('at');
            setStatusFilter('all');
        } else if (location.pathname.endsWith('/telecel')) {
            setNetworkFilter('telecel');
            setStatusFilter('all');
        } else if (location.pathname.endsWith('/processing')) {
            setStatusFilter('processing');
            setNetworkFilter('all');
        } else if (location.pathname.endsWith('/completed')) {
            setStatusFilter('completed');
            setNetworkFilter('all');
        } else if (location.pathname.endsWith('/failed')) {
            setStatusFilter('failed');
            setNetworkFilter('all');
        } else {
            setStatusFilter('all');
            setNetworkFilter('all');
        }
    }, [location.pathname]);

    // Smart network classifier (checks network field + recipient phone number prefix fallback)
    const getNetworkFromOrder = (networkStr: string, phoneStr: string): 'mtn' | 'at' | 'telecel' | 'unknown' => {
        const net = (networkStr || '').toUpperCase();
        if (net.includes('MTN')) return 'mtn';
        if (net.includes('AT') || net.includes('AIRTEL') || net.includes('TIGO')) return 'at';
        if (net.includes('TELECEL') || net.includes('VODA')) return 'telecel';

        const cleanPhone = (phoneStr || '').replace(/\D/g, '');
        let prefix = '';
        if (cleanPhone.startsWith('233')) {
            prefix = '0' + cleanPhone.slice(3, 5);
        } else if (cleanPhone.startsWith('0')) {
            prefix = cleanPhone.slice(0, 3);
        }

        if (['024', '054', '055', '059', '025', '053'].includes(prefix)) return 'mtn';
        if (['020', '050'].includes(prefix)) return 'telecel';
        if (['027', '057', '026', '056'].includes(prefix)) return 'at';

        return 'unknown';
    };

    const handleReprocessOrder = async (id: string) => {
        setReprocessingId(id);
        try {
            const result = await adminService.reprocessTransaction(id);
            toast({
                title: 'Reprocess Initiated',
                description: result.message || 'Order has been requeued for processing.'
            });
            fetchOrders();
            if (selectedOrder && selectedOrder.id === id) {
                setSelectedOrder(prev => prev ? { ...prev, status: 'processing' } : null);
            }
        } catch (err: any) {
            toast({
                title: 'Reprocess Failed',
                description: err?.response?.data?.error || err?.message || 'Failed to reprocess order.',
                variant: 'destructive'
            });
        } finally {
            setReprocessingId(null);
        }
    };


    // Sorting state
    const [sortConfig, setSortConfig] = useState<{ key: keyof Order; direction: 'ascending' | 'descending' } | null>({
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

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            // Fetch all orders with a large limit so no records are omitted
            const data = await adminService.getTransactions({ limit: 5000 });
            const ordersFormatted = data.map(order => ({
                id: order.id,
                user_id: '',
                user_name: order.userName || 'Unknown',
                user_email: order.userEmail || '',
                recipient_phone: order.recipientPhone,
                network: order.network || 'N/A',
                data_amount: order.dataAmount || 'N/A',
                amount_ghc: order.amount,
                status: order.status,
                created_at: order.createdAt,
                reference: order.id.slice(0, 12),
                serialId: order.serialId,
                balanceBefore: order.balanceBefore,
                balanceAfter: order.balanceAfter,
                source: order.source,
                paid: order.paid,
                sourceProvider: order.sourceProvider,
                updatedAt: order.updatedAt
            }));
            setOrders(ordersFormatted);
        } catch (err) {
            console.error('Error fetching orders:', err);
            toast({
                title: 'Error',
                description: 'Failed to fetch transaction logs.',
                variant: 'destructive'
            });
        } finally {
            setLoading(false);
        }
    };


    const updateOrderStatus = async (orderId: string, newStatus: 'processing' | 'completed' | 'failed') => {
        setUpdating(orderId);
        try {
            await adminService.updateTransactionStatus(orderId, newStatus);

            setOrders(prev => prev.map(order =>
                order.id === orderId ? { ...order, status: newStatus, updatedAt: new Date().toISOString() } : order
            ));

            toast({
                title: 'Order Updated',
                description: `Order status changed to ${newStatus}`,
            });
            if (selectedOrder && selectedOrder.id === orderId) {
                setSelectedOrder(prev => prev ? { ...prev, status: newStatus, updatedAt: new Date().toISOString() } : null);
            }
        } catch (err) {
            toast({
                title: 'Error',
                description: 'Failed to update order status.',
                variant: 'destructive',
            });
        } finally {
            setUpdating(null);
        }
    };

    // Sorting handler
    const requestSort = (key: keyof Order) => {
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
                order.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                order.user_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                order.recipient_phone.includes(searchTerm) ||
                displayId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (order.sourceProvider && order.sourceProvider.toLowerCase().includes(searchTerm.toLowerCase()));

            const matchesStatus = statusFilter === 'all' || order.status === statusFilter;

            let matchesNetwork = true;
            if (networkFilter !== 'all') {
                const detectedNet = getNetworkFromOrder(order.network, order.recipient_phone);
                matchesNetwork = (detectedNet === networkFilter);
            }

            let matchesDate = true;
            if (order.created_at) {
                const orderDate = new Date(order.created_at);
                if (startDate) {
                    const start = new Date(startDate);
                    start.setHours(0, 0, 0, 0);
                    if (orderDate < start) matchesDate = false;
                }
                if (endDate) {
                    const end = new Date(endDate);
                    end.setHours(23, 59, 59, 999);
                    if (orderDate > end) matchesDate = false;
                }
            }

            return matchesSearch && matchesStatus && matchesNetwork && matchesDate;
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
    }, [orders, searchTerm, statusFilter, startDate, endDate, sortConfig]);

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed':
                return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
            case 'processing':
            case 'pending':
            case 'ongoing':
            case 'queued':
                return <Clock className="w-4 h-4 text-amber-500 animate-pulse" />;
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

    const getPageTitle = () => {
        if (networkFilter === 'mtn') return 'MTN Network Orders';
        if (networkFilter === 'at') return 'AT (AirtelTigo) Network Orders';
        if (networkFilter === 'telecel') return 'Telecel Network Orders';

        switch (statusFilter) {
            case 'processing':
                return 'Processing Orders';
            case 'completed':
                return 'Completed Orders';
            case 'failed':
                return 'Failed Orders';
            case 'all':
            default:
                return 'All System Orders';
        }
    };


    const handleExport = (format: 'excel' | 'csv' | 'json' = 'csv') => {
        if (processedOrders.length === 0) {
            toast({ title: 'No Data', description: 'No orders available to export.', variant: 'destructive' });
            return;
        }
        exportOrders(processedOrders, { filename: 'admin_orders', format, sheetName: 'Orders' });
        const formatLabels: Record<string, string> = { excel: 'Excel (.xls)', csv: 'CSV', json: 'JSON' };
        toast({ title: 'Export Successful', description: `Exported ${processedOrders.length} order(s) to ${formatLabels[format]}.` });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 p-1">
                <div className="flex items-center gap-3">
                    <ShoppingCart className="w-8 h-8 text-primary" />
                    <div>
                        <h1 className="text-3xl font-display font-black tracking-tight text-foreground">{getPageTitle()}</h1>
                        <p className="text-muted-foreground font-medium">Manage and audit all system data bundle orders ({processedOrders.length} records)</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 self-start sm:self-auto">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                className="rounded-xl border-border/50 hover:bg-primary/10 hover:text-primary transition-all font-bold h-9"
                            >
                                <Download className="w-4 h-4 mr-2" />
                                Export Orders
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
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchOrders}
                        className="rounded-xl border-border/50 hover:bg-primary/10 hover:text-primary transition-all font-bold h-9"
                    >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Refresh Logs
                    </Button>
                </div>
            </div>

            {/* Filter & Options Toolbar */}
            <Card className="border-border/50 bg-card/60 backdrop-blur-xl">
                <CardContent className="p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                    {/* Search & Filter */}
                    <div className="flex flex-col md:flex-row gap-3 flex-1 flex-wrap">
                        <div className="relative min-w-[240px] flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Search order ID, user, phone or provider..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 bg-accent/40 border-border/50 text-foreground"
                            />
                        </div>
                        <div className="flex gap-1.5 overflow-x-auto hide-scrollbar items-center">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mr-1">Status:</span>
                            {['all', 'processing', 'completed', 'failed'].map((status) => (
                                <Button
                                    key={status}
                                    variant={statusFilter === status ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => { setStatusFilter(status); if (status !== 'all') setNetworkFilter('all'); }}
                                    className="capitalize rounded-lg px-3 text-xs border-border/50 font-semibold"
                                >
                                    {status}
                                </Button>
                            ))}
                        </div>
                        <div className="flex gap-1.5 overflow-x-auto hide-scrollbar items-center border-l border-border/60 pl-3">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mr-1">Network:</span>
                            {[
                                { id: 'all', label: 'All' },
                                { id: 'mtn', label: 'MTN' },
                                { id: 'at', label: 'AT' },
                                { id: 'telecel', label: 'Telecel' }
                            ].map((net) => (
                                <Button
                                    key={net.id}
                                    variant={networkFilter === net.id ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setNetworkFilter(net.id)}
                                    className="rounded-lg px-3 text-xs border-border/50 font-semibold"
                                >
                                    {net.label}
                                </Button>
                            ))}
                        </div>

                    </div>

                    {/* Date filter & Columns selection */}
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
                                ) : processedOrders.length === 0 ? (
                                    <tr>
                                        <td colSpan={columnsList.length + 1} className="py-12 text-center text-muted-foreground">
                                            No orders match the search or date query.
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
                                                {visibleColumns.customer && (
                                                    <td className="p-4">
                                                        <p className="text-foreground text-sm font-semibold">{order.user_name}</p>
                                                        <p className="text-xs text-muted-foreground">{order.user_email}</p>
                                                    </td>
                                                )}
                                                {visibleColumns.recipient && (
                                                    <td className="p-4 text-sm font-medium">{order.recipient_phone}</td>
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
                                                {visibleColumns.size && (
                                                    <td className="p-4 text-sm font-semibold">{order.data_amount}</td>
                                                )}
                                                {visibleColumns.status && (
                                                    <td className="p-4 text-sm">
                                                        <span className={cn(
                                                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-wide",
                                                            getStatusBadge(order.status)
                                                        )}>
                                                            {getStatusIcon(order.status)}
                                                            {order.status === 'pending' ? 'processing' : order.status}
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
                                                    <td className="p-4 font-mono text-sm font-extrabold text-foreground">{formatGHS(order.amount_ghc)}</td>
                                                )}
                                                {visibleColumns.balAfter && (
                                                    <td className="p-4 font-mono text-xs hidden xl:table-cell text-muted-foreground">{formatGHS(order.balanceAfter)}</td>
                                                )}
                                                {visibleColumns.date && (
                                                    <td className="p-4 text-xs text-muted-foreground hidden sm:table-cell">{formatDate(order.created_at)}</td>
                                                )}
                                                {visibleColumns.updated && (
                                                    <td className="p-4 text-xs text-muted-foreground hidden xl:table-cell">
                                                        {order.updatedAt ? formatDate(order.updatedAt) : '—'}
                                                    </td>
                                                )}
                                                {visibleColumns.actions && (
                                                    <td className="p-4 text-sm text-right">
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            {order.status === 'processing' && (
                                                                <div className="flex gap-1 mr-2 shrink-0">
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        onClick={() => updateOrderStatus(order.id, 'completed')}
                                                                        disabled={updating === order.id}
                                                                        className="h-7 text-xs border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10"
                                                                    >
                                                                        {updating === order.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Complete'}
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        onClick={() => updateOrderStatus(order.id, 'failed')}
                                                                        disabled={updating === order.id}
                                                                        className="h-7 text-xs border-red-500/50 text-red-400 hover:bg-red-500/10"
                                                                    >
                                                                        Fail
                                                                    </Button>
                                                                </div>
                                                            )}
                                                            {order.status === 'failed' && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() => handleReprocessOrder(order.id)}
                                                                    disabled={reprocessingId === order.id}
                                                                    className="h-7 text-xs border-amber-500/50 text-amber-400 hover:bg-amber-500/10 gap-1 mr-1"
                                                                    title="Reprocess failed order"
                                                                >
                                                                    {reprocessingId === order.id ? (
                                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                    ) : (
                                                                        <RotateCcw className="w-3.5 h-3.5" />
                                                                    )}
                                                                    Reprocess
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
                                                                        onClick={() => setSelectedOrder(order)}
                                                                        className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
                                                                    >
                                                                        <Eye className="w-3.5 h-3.5" />
                                                                        View Details
                                                                    </DropdownMenuItem>
                                                                    {order.status === 'failed' && (
                                                                        <DropdownMenuItem 
                                                                            onClick={() => handleReprocessOrder(order.id)}
                                                                            disabled={reprocessingId === order.id}
                                                                            className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer text-amber-400 focus:text-amber-400"
                                                                        >
                                                                            <RotateCcw className="w-3.5 h-3.5" />
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
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
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

                        {/* Modal Footer with Status Overrides */}
                        <div className="p-4 border-t border-border/50 flex flex-col sm:flex-row gap-3 items-center justify-between bg-accent/20">
                            <div className="flex gap-2">
                                {selectedOrder.status === 'processing' && (
                                    <>
                                        <Button 
                                            size="sm"
                                            onClick={() => updateOrderStatus(selectedOrder.id, 'completed')}
                                            disabled={updating === selectedOrder.id}
                                            className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold"
                                        >
                                            Mark Completed
                                        </Button>
                                        <Button 
                                            size="sm"
                                            onClick={() => updateOrderStatus(selectedOrder.id, 'failed')}
                                            disabled={updating === selectedOrder.id}
                                            className="bg-red-500 hover:bg-red-600 text-white font-bold"
                                        >
                                            Mark Failed
                                        </Button>
                                    </>
                                )}
                                {selectedOrder.status === 'failed' && (
                                    <Button
                                        size="sm"
                                        onClick={() => handleReprocessOrder(selectedOrder.id)}
                                        disabled={reprocessingId === selectedOrder.id}
                                        className="bg-amber-500 hover:bg-amber-600 text-black font-bold flex items-center gap-1.5"
                                    >
                                        {reprocessingId === selectedOrder.id ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <RotateCcw className="w-4 h-4" />
                                        )}
                                        Reprocess Order
                                    </Button>
                                )}
                            </div>
                            <Button 
                                onClick={() => setSelectedOrder(null)}
                                variant="outline"
                                className="border-border text-muted-foreground hover:bg-accent rounded-xl font-bold w-full sm:w-auto"
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
