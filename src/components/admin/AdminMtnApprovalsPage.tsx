import React, { useEffect, useState, useCallback } from 'react';
import { api } from '@/services';
import { useToast } from '@/hooks/use-toast';
import { useSocket } from '@/contexts/SocketContext';
import { exportViaApi } from '@/lib/export';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
    Loader2, Search, Download, RefreshCw, AlertCircle, CheckCircle2, XCircle, Clock, ExternalLink, ShieldAlert, FileSpreadsheet, FileText, FileCode
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
    datahouseReference?: string | null;
    datahouseStatus?: string;
    datahouseSyncStatus?: 'synced' | 'pending' | 'failed' | 'syncing';
    datahouseLastSyncAt?: string | null;
    datahouseSyncError?: string | null;
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

export const AdminMtnApprovalsPage: React.FC = () => {
    const { toast } = useToast();
    const { socket } = useSocket();
    const [approvals, setApprovals] = useState<MtnApproval[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [exporting, setExporting] = useState(false);

    // Filters
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [timeframeFilter, setTimeframeFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');

    // Pagination State
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [hasNextPage, setHasNextPage] = useState(false);
    const [hasPreviousPage, setHasPreviousPage] = useState(false);

    // Modal state for linked orders
    const [selectedBeneficiary, setSelectedBeneficiary] = useState<MtnApproval | null>(null);
    const [linkedOrders, setLinkedOrders] = useState<LinkedOrder[]>([]);
    const [loadingOrders, setLoadingOrders] = useState(false);

    // Reset to page 1 when filters change
    useEffect(() => {
        setPage(1);
    }, [statusFilter, timeframeFilter, searchQuery, pageSize]);

    const loadApprovals = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.append('page', page.toString());
            params.append('limit', pageSize.toString());
            if (statusFilter !== 'all') params.append('status', statusFilter);
            if (timeframeFilter !== 'all') params.append('timeframe', timeframeFilter);
            if (searchQuery.trim()) params.append('search', searchQuery.trim());

            const res = await api.get<{ success: boolean; data: MtnApproval[]; meta?: PaginationMeta }>(`/admin/mtn-approvals?${params.toString()}`);
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
                api.post('/admin/mtn-approvals/mark-seen').catch(() => {});
            }
        } catch (err: any) {
            toast({
                title: 'Error',
                description: err.message || 'Failed to load MTN beneficiary approval records.',
                variant: 'destructive'
            });
        } finally {
            setLoading(false);
        }
    }, [page, pageSize, statusFilter, timeframeFilter, searchQuery, toast]);

    useEffect(() => {
        loadApprovals();
    }, [loadApprovals]);

    // Real-time socket listener for MTN approval updates
    useEffect(() => {
        if (!socket) return;

        const handleUpdate = () => {
            loadApprovals();
        };

        socket.on('mtnApprovalUpdate', handleUpdate);
        return () => {
            socket.off('mtnApprovalUpdate', handleUpdate);
        };
    }, [socket, loadApprovals]);

    const handleSync = async () => {
        setSyncing(true);
        try {
            const res = await api.post<{ success: boolean; message: string; updated: number }>('/admin/mtn-approvals/sync');
            if (res.success) {
                toast({
                    title: 'Sync Complete',
                    description: res.message || `Updated ${res.updated} records from DataHouse.`
                });
                loadApprovals();
            }
        } catch (err: any) {
            toast({
                title: 'Sync Failed',
                description: err.message || 'Failed to sync status with DataHouse.',
                variant: 'destructive'
            });
        } finally {
            setSyncing(false);
        }
    };

    const handleExport = async (format: 'csv' | 'excel' | 'json' = 'csv') => {
        setExporting(true);
        try {
            const params: Record<string, string> = { format };
            if (statusFilter !== 'all') params.status = statusFilter;
            if (timeframeFilter !== 'all') params.timeframe = timeframeFilter;
            if (searchQuery.trim()) params.search = searchQuery.trim();

            await exportViaApi('/admin/mtn-approvals/export', params, `MTN_Pending_Approvals_${Date.now()}`);

            toast({
                title: 'Export Ready',
                description: `MTN beneficiary approvals downloaded successfully (${format.toUpperCase()}).`
            });
        } catch (err: any) {
            toast({
                title: 'Export Failed',
                description: err.message || 'Could not export pending MTN numbers.',
                variant: 'destructive'
            });
        } finally {
            setExporting(false);
        }
    };

    const handleViewOrders = async (beneficiary: MtnApproval) => {
        setSelectedBeneficiary(beneficiary);
        setLoadingOrders(true);
        try {
            const res = await api.get<{ success: boolean; orders: LinkedOrder[] }>(`/admin/mtn-approvals/${beneficiary.id}/orders`);
            if (res.success) {
                setLinkedOrders(res.orders || []);
            }
        } catch (err: any) {
            toast({ title: 'Error', description: 'Failed to load linked orders', variant: 'destructive' });
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
                    <Clock className="w-3.5 h-3.5 animate-spin" /> Processing
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
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            return dateStr;
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-5">
                <div>
                    <h1 className="text-2xl font-bold text-foreground flex items-center gap-2.5">
                        <ShieldAlert className="w-6 h-6 text-amber-400" />
                        Pending MTN Approval
                    </h1>
                    <p className="text-xs text-muted-foreground mt-1">
                        Track and manage unverified MTN beneficiary numbers queued for network approval.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSync}
                        disabled={syncing}
                        className="bg-card border-border hover:bg-accent text-xs font-semibold gap-2"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                        {syncing ? 'Syncing...' : 'Sync Status'}
                    </Button>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                disabled={exporting}
                                className="bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs gap-2"
                            >
                                {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                                {exporting ? 'Exporting...' : 'Export Approvals'}
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

            {/* Explanatory Banner */}
            <Card className="bg-amber-500/10 border-amber-500/20 text-amber-200">
                <CardContent className="p-4 flex items-start gap-3 text-xs leading-relaxed">
                    <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="font-semibold text-amber-300 mb-1">MTN Beneficiary Validation Requirement</p>
                        MTN requires every beneficiary number to be validated before it can receive data through GMPL. Numbers below were detected in your orders (single, bulk upload, paste or API) but are not yet on the validated list — they are sent to MTN for approval and unblock automatically once approved. You don't need to do anything; this page gives you visibility and lets you download the list.
                    </div>
                </CardContent>
            </Card>

            {/* Filter Controls */}
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

                    {/* Filters */}
                    <div className="flex flex-wrap items-center gap-3">
                        {/* Status Filter */}
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span className="font-semibold">Status:</span>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="bg-background border border-border rounded-lg px-2.5 py-1.5 text-foreground text-xs font-semibold focus:outline-none"
                            >
                                <option value="all">All Statuses</option>
                                <option value="pending">Pending</option>
                                <option value="submitted">Processing</option>
                                <option value="approved">Approved</option>
                                <option value="rejected">Rejected</option>
                            </select>
                        </div>

                        {/* Timeframe Filter */}
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span className="font-semibold">Time:</span>
                            <select
                                value={timeframeFilter}
                                onChange={(e) => setTimeframeFilter(e.target.value)}
                                className="bg-background border border-border rounded-lg px-2.5 py-1.5 text-foreground text-xs font-semibold focus:outline-none"
                            >
                                <option value="all">All Time</option>
                                <option value="today">Today</option>
                                <option value="7d">7 Days</option>
                                <option value="30d">30 Days</option>
                                <option value="90d">90 Days</option>
                                <option value="1y">1 Year</option>
                            </select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Beneficiaries Table */}
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
                            <span className="text-xs font-semibold">Loading beneficiary numbers...</span>
                        </div>
                    ) : approvals.length === 0 ? (
                        <div className="p-12 text-center text-muted-foreground space-y-2">
                            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                            <p className="font-bold text-foreground text-sm">No Pending Numbers</p>
                            <p className="text-xs max-w-sm mx-auto">No unverified MTN numbers currently match your filter selection.</p>
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead>
                                        <tr className="border-b border-border/60 bg-muted/30 text-muted-foreground uppercase tracking-wider font-semibold">
                                            <th className="p-4">Number</th>
                                            <th className="p-4">Bundle Size</th>
                                            <th className="p-4">Source(s)</th>
                                            <th className="p-4 text-center">Occurrences</th>
                                            <th className="p-4">DataHouse Ref</th>
                                            <th className="p-4">DH Sync</th>
                                            <th className="p-4">First Detected</th>
                                            <th className="p-4">Last Detected</th>
                                            <th className="p-4">Status</th>
                                            <th className="p-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/40">
                                        {approvals.map((b) => (
                                            <tr key={b.id} className="hover:bg-muted/20 transition-colors">
                                                <td className="p-4 font-mono font-bold text-foreground">{b.displayPhone}</td>
                                                <td className="p-4">
                                                    <div className="flex flex-wrap gap-1">
                                                        {b.bundleSizes.map((sz, i) => (
                                                            <span key={i} className="px-2 py-0.5 rounded bg-muted text-foreground font-semibold text-[11px] border border-border">
                                                                {sz}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex flex-wrap gap-1">
                                                        {b.sources.map((src, i) => (
                                                            <span key={i} className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 font-semibold text-[11px] border border-purple-500/20">
                                                                {src}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="p-4 text-center font-bold text-amber-400">{b.occurrences}</td>
                                                <td className="p-4 font-mono text-[11px] text-muted-foreground">
                                                    {b.datahouseReference ? (
                                                        <span className="text-emerald-400 font-medium">{b.datahouseReference}</span>
                                                    ) : (
                                                        <span className="text-muted-foreground/60">—</span>
                                                    )}
                                                </td>
                                                <td className="p-4">
                                                    {b.datahouseSyncStatus === 'synced' ? (
                                                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-semibold text-[10px] border border-emerald-500/20">Synced</span>
                                                    ) : b.datahouseSyncStatus === 'failed' ? (
                                                        <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 font-semibold text-[10px] border border-rose-500/20" title={b.datahouseSyncError || ''}>Failed</span>
                                                    ) : (
                                                        <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 font-semibold text-[10px] border border-amber-500/20">Pending</span>
                                                    )}
                                                </td>
                                                <td className="p-4 text-muted-foreground">{formatDate(b.firstDetectedAt)}</td>
                                                <td className="p-4 text-muted-foreground">{formatDate(b.lastDetectedAt)}</td>
                                                <td className="p-4">{getStatusBadge(b.status)}</td>
                                                <td className="p-4 text-right">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleViewOrders(b)}
                                                        className="text-xs text-primary hover:text-primary/80 h-8 font-semibold gap-1"
                                                    >
                                                        Orders ({b.occurrences}) <ExternalLink className="w-3 h-3" />
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

            {/* Linked Orders Modal */}
            <Dialog open={Boolean(selectedBeneficiary)} onOpenChange={() => setSelectedBeneficiary(null)}>
                <DialogContent className="bg-card border-border max-w-2xl text-foreground">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold flex items-center gap-2">
                            Linked Orders for {selectedBeneficiary?.displayPhone}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                            Occurrences: {selectedBeneficiary?.occurrences} | Status: {selectedBeneficiary?.status.toUpperCase()}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4">
                        {loadingOrders ? (
                            <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center space-y-2">
                                <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
                                <span className="text-xs font-semibold">Loading linked orders...</span>
                            </div>
                        ) : linkedOrders.length === 0 ? (
                            <p className="text-center py-6 text-xs text-muted-foreground">No specific linked order records found.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead>
                                        <tr className="border-b border-border text-muted-foreground uppercase">
                                            <th className="p-2 font-semibold">Reference</th>
                                            <th className="p-2 font-semibold">Bundle Size</th>
                                            <th className="p-2 font-semibold">Source</th>
                                            <th className="p-2 font-semibold">Created Date</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/40">
                                        {linkedOrders.map((ord) => (
                                            <tr key={ord.id} className="hover:bg-muted/20">
                                                <td className="p-2 font-mono font-bold text-foreground">{ord.order_reference}</td>
                                                <td className="p-2 font-semibold text-emerald-400">{ord.bundle_size}</td>
                                                <td className="p-2 text-purple-300 font-semibold">{ord.source}</td>
                                                <td className="p-2 text-muted-foreground">{formatDate(ord.created_at)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default AdminMtnApprovalsPage;
