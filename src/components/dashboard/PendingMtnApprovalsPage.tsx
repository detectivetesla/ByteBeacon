import React, { useEffect, useState, useCallback } from 'react';
import { api } from '@/services';
import { useToast } from '@/hooks/use-toast';
import { useSocket } from '@/contexts/SocketContext';
import { exportViaApi } from '@/lib/export';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import {
    Loader2, Search, Clock, CheckCircle2, XCircle, AlertCircle, Phone, ShieldAlert, RefreshCw, Download, FileSpreadsheet, FileText, FileCode
} from 'lucide-react';
import { PaginationControl, PaginationMeta } from '@/components/common/PaginationControl';

interface MtnApproval {
    id: string;
    msisdn: string;
    displayPhone: string;
    network: string;
    status: 'pending' | 'submitted' | 'approved' | 'rejected';
    occurrences: number;
    bundleSizes: string[];
    sources: string[];
    primarySource?: string;
    datahouseReference?: string | null;
    datahouseStatus?: string;
    datahouseSyncStatus?: 'synced' | 'pending' | 'failed' | 'syncing';
    firstDetectedAt: string;
    lastDetectedAt: string;
    submittedAt?: string;
    approvedAt?: string;
    rejectedAt?: string;
    resolvedAt?: string;
}

interface LinkedOrder {
    id: string;
    approval_id: string;
    order_id: string | null;
    order_reference: string;
    bundle_size: string;
    source: string;
    created_at: string;
}

const STATUS_FILTERS = [
    { value: 'all', label: 'All' },
    { value: 'pending', label: 'Pending' },
    { value: 'submitted', label: 'Processing' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
] as const;

export const PendingMtnApprovalsPage: React.FC = () => {
    const { toast } = useToast();
    const { socket } = useSocket();
    const [approvals, setApprovals] = useState<MtnApproval[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Filters
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');

    // Pagination State
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [hasNextPage, setHasNextPage] = useState(false);
    const [hasPreviousPage, setHasPreviousPage] = useState(false);

    // Detail modal
    const [selectedApproval, setSelectedApproval] = useState<MtnApproval | null>(null);
    const [linkedOrders, setLinkedOrders] = useState<LinkedOrder[]>([]);
    const [loadingOrders, setLoadingOrders] = useState(false);

    // Badge count
    const [pendingCount, setPendingCount] = useState(0);

    // Exporting state
    const [exporting, setExporting] = useState(false);

    // Reset to page 1 when filters change
    useEffect(() => {
        setPage(1);
    }, [statusFilter, searchQuery, pageSize]);

    const handleExport = async (format: 'csv' | 'excel' | 'json' = 'csv') => {
        setExporting(true);
        try {
            const params: Record<string, string> = { format };
            if (statusFilter !== 'all') params.status = statusFilter;
            if (searchQuery.trim()) params.search = searchQuery.trim();

            await exportViaApi('/users/mtn-approvals/export', params, `My_Pending_MTN_${Date.now()}`);

            toast({
                title: 'Export Ready',
                description: `Pending MTN approval records downloaded (${format.toUpperCase()}).`
            });
        } catch (err: any) {
            toast({
                title: 'Export Failed',
                description: err.message || 'Failed to export records.',
                variant: 'destructive'
            });
        } finally {
            setExporting(false);
        }
    };

    const loadApprovals = useCallback(async (showRefreshing = false) => {
        if (showRefreshing) setRefreshing(true);
        else setLoading(true);

        try {
            const params = new URLSearchParams();
            params.append('page', page.toString());
            params.append('limit', pageSize.toString());
            if (statusFilter !== 'all') params.append('status', statusFilter);
            if (searchQuery.trim()) params.append('search', searchQuery.trim());

            const res = await api.get<{ success: boolean; data: MtnApproval[]; meta?: PaginationMeta }>(`/users/mtn-approvals?${params.toString()}`);
            if (res.success) {
                setApprovals(res.data || []);
                if (res.meta) {
                    setTotal(res.meta.total);
                    setTotalPages(res.meta.totalPages);
                    setHasNextPage(res.meta.hasNextPage);
                    setHasPreviousPage(res.meta.hasPreviousPage);

                    if (res.meta.page > res.meta.totalPages && res.meta.totalPages > 0) {
                        setPage(res.meta.totalPages);
                    }
                }

                // Mark current pending items as seen to reset unread badge
                api.post('/users/mtn-approvals/mark-seen').catch(() => {});
            }
        } catch (err: any) {
            toast({
                title: 'Error',
                description: err.message || 'Failed to load pending MTN approvals.',
                variant: 'destructive'
            });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [page, pageSize, statusFilter, searchQuery, toast]);

    const loadPendingCount = useCallback(async () => {
        try {
            const res = await api.get<{ success: boolean; count: number }>('/users/mtn-approvals/count');
            if (res.success) setPendingCount(res.count);
        } catch { /* silent */ }
    }, []);

    useEffect(() => {
        loadApprovals();
        loadPendingCount();
    }, [loadApprovals, loadPendingCount]);

    // Real-time socket listener for MTN approval updates
    useEffect(() => {
        if (!socket) return;

        const handleUpdate = () => {
            loadApprovals();
            loadPendingCount();
        };

        socket.on('mtnApprovalUpdate', handleUpdate);
        return () => {
            socket.off('mtnApprovalUpdate', handleUpdate);
        };
    }, [socket, loadApprovals, loadPendingCount]);

    const handleViewDetails = async (approval: MtnApproval) => {
        setSelectedApproval(approval);
        setLoadingOrders(true);
        try {
            const res = await api.get<{ success: boolean; orders: LinkedOrder[] }>(`/users/mtn-approvals/${approval.id}/orders`);
            if (res.success) {
                setLinkedOrders(res.orders || []);
            }
        } catch {
            toast({ title: 'Error', description: 'Failed to load details', variant: 'destructive' });
        } finally {
            setLoadingOrders(false);
        }
    };

    const getStatusBadge = (status: string) => {
        const s = status.toLowerCase();
        if (s === 'approved') {
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Approved
                </span>
            );
        }
        if (s === 'rejected') {
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                    <XCircle className="w-3.5 h-3.5" /> Rejected
                </span>
            );
        }
        if (s === 'submitted' || s === 'processing') {
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    <Clock className="w-3.5 h-3.5 animate-pulse" /> Processing
                </span>
            );
        }
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <AlertCircle className="w-3.5 h-3.5" /> Pending
            </span>
        );
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '—';
        try {
            return new Date(dateStr).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return dateStr;
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-5">
                <div>
                    <h1 className="text-2xl font-bold text-foreground flex items-center gap-2.5">
                        <ShieldAlert className="w-6 h-6 text-amber-400" />
                        Pending MTN Approvals
                        {pendingCount > 0 && (
                            <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                {pendingCount}
                            </span>
                        )}
                    </h1>
                    <p className="text-xs text-muted-foreground mt-1">
                        Track MTN numbers that are awaiting network approval before they can receive data bundles.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => loadApprovals(true)}
                        disabled={refreshing}
                        className="bg-card border-border hover:bg-accent text-xs font-semibold gap-2"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                        {refreshing ? 'Refreshing...' : 'Refresh'}
                    </Button>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                disabled={exporting}
                                className="bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs gap-2"
                            >
                                {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                                {exporting ? 'Exporting...' : 'Export'}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 bg-card border-border">
                            <DropdownMenuLabel className="text-xs text-muted-foreground font-semibold">Export Format</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onClick={() => handleExport('excel')}
                                className="text-xs cursor-pointer gap-2 focus:bg-accent"
                            >
                                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
                                Export to Excel (.xlsx)
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => handleExport('csv')}
                                className="text-xs cursor-pointer gap-2 focus:bg-accent"
                            >
                                <FileText className="w-3.5 h-3.5 text-blue-500" />
                                Export to CSV (.csv)
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => handleExport('json')}
                                className="text-xs cursor-pointer gap-2 focus:bg-accent"
                            >
                                <FileCode className="w-3.5 h-3.5 text-purple-500" />
                                Export to JSON (.json)
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Info Banner — reassuring, NOT alarming */}
            <Card className="bg-amber-500/5 border-amber-500/20">
                <CardContent className="p-4 flex items-start gap-3 text-xs leading-relaxed">
                    <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div className="text-muted-foreground">
                        <p className="font-semibold text-amber-300 mb-1">What is this page?</p>
                        <p>
                            MTN requires every beneficiary number to be validated before it can receive data.
                            Numbers shown here were submitted for ordering but are not yet on MTN's approved list.
                        </p>
                        <ul className="mt-2 space-y-1 list-disc list-inside text-muted-foreground/80">
                            <li><strong className="text-foreground/80">You have NOT been charged</strong> for any number listed below.</li>
                            <li>Numbers are automatically submitted to MTN for approval — you don't need to do anything.</li>
                            <li>Once approved, you can return and place the order normally.</li>
                        </ul>
                    </div>
                </CardContent>
            </Card>

            {/* Filters */}
            <Card className="bg-card border-border">
                <CardContent className="p-4 space-y-4 sm:space-y-0 sm:flex sm:items-center sm:justify-between gap-4">
                    {/* Search */}
                    <div className="relative flex-1 max-w-md">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Search by phone number..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 bg-background border-border text-xs py-2"
                        />
                    </div>

                    {/* Status Pill Buttons */}
                    <div className="flex flex-wrap items-center gap-1.5">
                        {STATUS_FILTERS.map(f => (
                            <button
                                key={f.value}
                                onClick={() => setStatusFilter(f.value)}
                                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 border ${
                                    statusFilter === f.value
                                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                                        : 'bg-background text-muted-foreground border-border hover:bg-accent hover:text-foreground'
                                }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Approvals List */}
            <Card className="bg-card border-border overflow-hidden">
                <CardHeader className="p-4 border-b border-border/50 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-bold text-foreground tracking-wide uppercase">Your Numbers</CardTitle>
                    <span className="text-xs text-muted-foreground font-semibold">
                        {loading ? '...' : `Showing ${total === 0 ? 0 : (page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`}
                    </span>
                </CardHeader>

                <CardContent className="p-0">
                    {loading ? (
                        <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center space-y-3">
                            <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
                            <span className="text-xs font-semibold">Loading...</span>
                        </div>
                    ) : approvals.length === 0 ? (
                        <div className="p-12 text-center text-muted-foreground space-y-3">
                            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                            <p className="font-bold text-foreground text-sm">No Pending Numbers</p>
                            <p className="text-xs max-w-sm mx-auto">
                                All your MTN numbers are approved and ready for ordering! 🎉
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead>
                                        <tr className="border-b border-border/60 bg-muted/30 text-muted-foreground uppercase tracking-wider font-semibold">
                                            <th className="p-4">Number</th>
                                            <th className="p-4">Bundles Requested</th>
                                            <th className="p-4">Source</th>
                                            <th className="p-4 text-center">Attempts</th>
                                            <th className="p-4">First Seen</th>
                                            <th className="p-4">Last Seen</th>
                                            <th className="p-4">Status</th>
                                            <th className="p-4 text-right">Details</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/40">
                                        {approvals.map(a => (
                                            <tr
                                                key={a.id}
                                                className="hover:bg-muted/20 transition-colors duration-150"
                                            >
                                                <td className="p-4">
                                                    <div className="flex items-center gap-2">
                                                        <Phone className="w-3.5 h-3.5 text-amber-400" />
                                                        <span className="font-bold text-foreground tracking-wide">
                                                            {a.displayPhone || a.msisdn}
                                                        </span>
                                                        <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/20">
                                                            MTN
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex flex-wrap gap-1">
                                                        {a.bundleSizes.map((b, i) => (
                                                            <span key={i} className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                                                {b}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    <span className="text-muted-foreground font-medium">
                                                        {a.primarySource || (a.sources.length > 0 ? a.sources[0] : '—')}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-muted/50 text-foreground font-bold text-xs">
                                                        {a.occurrences}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-muted-foreground whitespace-nowrap">
                                                    {formatDate(a.firstDetectedAt)}
                                                </td>
                                                <td className="p-4 text-muted-foreground whitespace-nowrap">
                                                    {formatDate(a.lastDetectedAt)}
                                                </td>
                                                <td className="p-4">
                                                    {getStatusBadge(a.status)}
                                                </td>
                                                <td className="p-4 text-right">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleViewDetails(a)}
                                                        className="text-xs font-semibold text-muted-foreground hover:text-foreground"
                                                    >
                                                        View
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Unified Server-Side Pagination Controls */}
                            <div className="p-4 border-t border-border/50">
                                <PaginationControl
                                    meta={{
                                        page,
                                        limit: pageSize,
                                        total,
                                        totalPages,
                                        hasNextPage,
                                        hasPreviousPage
                                    }}
                                    onPageChange={setPage}
                                    onLimitChange={(newLimit) => {
                                        setPageSize(newLimit);
                                        setPage(1);
                                    }}
                                    loading={loading}
                                />
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Detail Modal */}
            <Dialog open={!!selectedApproval} onOpenChange={() => setSelectedApproval(null)}>
                <DialogContent className="sm:max-w-lg bg-card border-border">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-foreground">
                            <Phone className="w-5 h-5 text-amber-400" />
                            {selectedApproval?.displayPhone || selectedApproval?.msisdn}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                            MTN beneficiary approval details and submission history
                        </DialogDescription>
                    </DialogHeader>

                    {selectedApproval && (
                        <div className="space-y-4 mt-2">
                            {/* Status & Info Grid */}
                            <div className="grid grid-cols-2 gap-3 text-xs">
                                <div className="bg-muted/30 rounded-lg p-3">
                                    <span className="text-muted-foreground block mb-1">Status</span>
                                    {getStatusBadge(selectedApproval.status)}
                                </div>
                                <div className="bg-muted/30 rounded-lg p-3">
                                    <span className="text-muted-foreground block mb-1">Network</span>
                                    <span className="font-bold text-amber-300">{selectedApproval.network}</span>
                                </div>
                                <div className="bg-muted/30 rounded-lg p-3">
                                    <span className="text-muted-foreground block mb-1">Attempts</span>
                                    <span className="font-bold text-foreground">{selectedApproval.occurrences}</span>
                                </div>
                                <div className="bg-muted/30 rounded-lg p-3">
                                    <span className="text-muted-foreground block mb-1">Source</span>
                                    <span className="font-bold text-foreground">
                                        {selectedApproval.primarySource || (selectedApproval.sources.length > 0 ? selectedApproval.sources.join(', ') : '—')}
                                    </span>
                                </div>
                                <div className="bg-muted/30 rounded-lg p-3">
                                    <span className="text-muted-foreground block mb-1">First Seen</span>
                                    <span className="text-foreground">{formatDate(selectedApproval.firstDetectedAt)}</span>
                                </div>
                                <div className="bg-muted/30 rounded-lg p-3">
                                    <span className="text-muted-foreground block mb-1">Last Seen</span>
                                    <span className="text-foreground">{formatDate(selectedApproval.lastDetectedAt)}</span>
                                </div>
                            </div>

                            {/* Bundles requested */}
                            <div className="bg-muted/30 rounded-lg p-3">
                                <span className="text-muted-foreground text-xs block mb-2">Bundles Requested</span>
                                <div className="flex flex-wrap gap-1.5">
                                    {selectedApproval.bundleSizes.map((b, i) => (
                                        <span key={i} className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                            {b}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Submission History */}
                            <div>
                                <span className="text-xs font-semibold text-muted-foreground block mb-2">Submission History</span>
                                {loadingOrders ? (
                                    <div className="flex items-center justify-center p-4">
                                        <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                                    </div>
                                ) : linkedOrders.length === 0 ? (
                                    <p className="text-xs text-muted-foreground/60 p-2">No submission records found.</p>
                                ) : (
                                    <div className="space-y-2 max-h-48 overflow-y-auto">
                                        {linkedOrders.map(o => (
                                            <div key={o.id} className="bg-muted/20 rounded-lg p-3 text-xs flex items-center justify-between">
                                                <div>
                                                    <span className="font-semibold text-foreground">{o.bundle_size}</span>
                                                    <span className="text-muted-foreground ml-2">via {o.source}</span>
                                                </div>
                                                <span className="text-muted-foreground whitespace-nowrap">
                                                    {formatDate(o.created_at)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Reassurance message */}
                            <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 text-xs text-blue-300/80">
                                <strong className="text-blue-300">💡 Note:</strong> You have not been charged for this number.
                                Once MTN approves it, you can place the order normally from the Data Bundles page.
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default PendingMtnApprovalsPage;
