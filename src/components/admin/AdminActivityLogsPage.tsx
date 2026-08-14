import { useState, useEffect, useCallback } from 'react';
import { adminService, ActivityLog } from '@/services/admin.service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { exportActivityLogs, exportViaApi } from '@/lib/export';
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from '@/components/ui/dialog';
import { Activity, Search, RefreshCcw, User, Clock, Globe, Download, FileSpreadsheet, FileText, FileCode, Info, ShieldCheck, ShieldAlert, Sparkles, UserCheck, Loader2 } from 'lucide-react';
import { PaginationControl, PaginationMeta } from '@/components/common/PaginationControl';

const ACTION_TYPES = [
    { value: 'all', label: 'All Actions' },
    { value: 'LOGIN', label: 'Login' },
    { value: 'REGISTER', label: 'Registration' },
    { value: 'PURCHASE', label: 'Purchase' },
    { value: 'WALLET_FUND', label: 'Wallet Funding' },
    { value: 'REFUND', label: 'Refund' },
    { value: 'USER_CREATED', label: 'User Created' },
    { value: 'USER_UPDATED', label: 'User Updated' },
    { value: 'USER_ROLE_CHANGED', label: 'Role Changed' },
    { value: 'USER_SUSPENDED', label: 'User Suspended' },
    { value: 'USER_ACTIVATED', label: 'User Activated' },
    { value: 'DATA_PLAN_CREATED', label: 'Data Plan Created' },
    { value: 'DATA_PLAN_ENABLED', label: 'Data Plan Enabled' },
    { value: 'DATA_PLAN_DISABLED', label: 'Data Plan Disabled' },
    { value: 'ORDER_STATUS_CHANGED', label: 'Order Status Changed' },
    { value: 'ADMIN_REPROCESS', label: 'Order Reprocessed' },
    { value: 'AGENT_APPLICATION_APPROVED', label: 'Agent Approved' },
    { value: 'AGENT_STORE_APPROVED', label: 'Store Approved' },
    { value: 'MESSAGE_SENT', label: 'Message Sent' },
    { value: 'MAINTENANCE_TOGGLED', label: 'Maintenance Mode' },
];

const ACTION_COLORS: Record<string, string> = {
    LOGIN: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
    REGISTER: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
    PURCHASE: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
    WALLET_FUND: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
    REFUND: 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30',
    USER_CREATED: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
    USER_UPDATED: 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30',
    USER_ROLE_CHANGED: 'bg-violet-500/20 text-violet-400 border border-violet-500/30',
    USER_SUSPENDED: 'bg-red-500/20 text-red-400 border border-red-500/30',
    USER_ACTIVATED: 'bg-teal-500/20 text-teal-400 border border-teal-500/30',
    DATA_PLAN_CREATED: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
    DATA_PLAN_ENABLED: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
    DATA_PLAN_DISABLED: 'bg-rose-500/20 text-rose-400 border border-rose-500/30',
    ORDER_STATUS_CHANGED: 'bg-sky-500/20 text-sky-400 border border-sky-500/30',
    ADMIN_REPROCESS: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
    AGENT_APPLICATION_APPROVED: 'bg-lime-500/20 text-lime-400 border border-lime-500/30',
    AGENT_STORE_APPROVED: 'bg-lime-500/20 text-lime-400 border border-lime-500/30',
    MESSAGE_SENT: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
    MAINTENANCE_TOGGLED: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
};

const ROLE_BADGES: Record<string, { label: string; color: string }> = {
    admin: { label: 'Admin', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
    superagent: { label: 'SuperAgent', color: 'bg-[#a3e635]/20 text-[#a3e635] border-[#a3e635]/30' },
    agent: { label: 'Agent', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    customer: { label: 'Customer', color: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
};

export default function AdminActivityLogsPage() {
    const { toast } = useToast();
    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionFilter, setActionFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(25);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [hasNextPage, setHasNextPage] = useState(false);
    const [hasPreviousPage, setHasPreviousPage] = useState(false);
    const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);
    const [exporting, setExporting] = useState(false);

    // Reset to page 1 when search or filters change
    useEffect(() => {
        setPage(1);
    }, [actionFilter, searchTerm, startDate, endDate, limit]);

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const res = await adminService.getActivityLogs({
                page,
                limit,
                action: actionFilter !== 'all' ? actionFilter : undefined,
                search: searchTerm.trim() || undefined,
                startDate: startDate || undefined,
                endDate: endDate || undefined,
            });

            let rawList: ActivityLog[] = [];
            if (Array.isArray(res)) {
                rawList = res;
                setTotal(res.length);
                setTotalPages(Math.ceil(res.length / limit) || 1);
                setHasNextPage(false);
                setHasPreviousPage(page > 1);
            } else if (res && res.data) {
                rawList = res.data;
                if (res.pagination) {
                    setTotal(res.pagination.total);
                    setTotalPages(res.pagination.totalPages);
                    setHasNextPage(res.pagination.hasNextPage);
                    setHasPreviousPage(res.pagination.hasPreviousPage);
                }
            }

            setLogs(rawList);
        } catch (error) {
            console.error('Error fetching activity logs:', error);
            toast({
                title: 'Error',
                description: 'Failed to load activity logs.',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    }, [page, limit, actionFilter, searchTerm, startDate, endDate, toast]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const handleExport = async (format: 'excel' | 'csv' | 'json') => {
        setExporting(true);
        try {
            const params: Record<string, string> = { format };
            if (actionFilter && actionFilter !== 'all') params.action = actionFilter;
            if (startDate) params.startDate = startDate;
            if (endDate) params.endDate = endDate;
            if (searchTerm.trim()) params.search = searchTerm.trim();

            await exportViaApi('/admin/activity-logs/export', params, `bytebeacon_activity_logs_${Date.now()}`);
            const formatLabels: Record<string, string> = { excel: 'Excel (.xlsx)', csv: 'CSV', json: 'JSON' };
            toast({ title: 'Export Complete', description: `Full activity logs exported to ${formatLabels[format]}.` });
        } catch (err: any) {
            if (logs.length > 0) {
                exportActivityLogs(logs, { filename: `activity_logs_${actionFilter}`, format, sheetName: 'Activity Logs' });
                toast({ title: 'Export Downloaded', description: `Exported ${logs.length} displayed log(s).` });
            } else {
                toast({ title: 'Export Failed', description: err.message || 'Could not export activity logs.', variant: 'destructive' });
            }
        } finally {
            setExporting(false);
        }
    };

    // Server paginated logs
    const paginatedLogs = logs;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-display font-black tracking-tight text-white flex items-center gap-3">
                        <Activity className="w-8 h-8 text-[#a3e635]" />
                        Activity Logs
                    </h1>
                    <p className="text-slate-400 font-medium text-sm">
                        Track and audit all platform administrative events, role changes, and balance updates
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="outline"
                                disabled={exporting}
                                className="rounded-xl border-white/10 hover:bg-[#a3e635]/10 hover:text-[#a3e635] transition-all font-bold text-xs"
                            >
                                {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                                {exporting ? 'Exporting...' : 'Export Logs'}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-[#202227] border-white/10 text-white">
                            <DropdownMenuLabel>Choose Format</DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-white/10" />
                            <DropdownMenuItem onClick={() => handleExport('excel')} className="cursor-pointer hover:bg-white/5">
                                <FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-400" />
                                Export to Excel (.xlsx)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleExport('csv')} className="cursor-pointer hover:bg-white/5">
                                <FileText className="w-4 h-4 mr-2 text-blue-400" />
                                Export to CSV (.csv)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleExport('json')} className="cursor-pointer hover:bg-white/5">
                                <FileCode className="w-4 h-4 mr-2 text-purple-400" />
                                Export to JSON (.json)
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <Button variant="outline" onClick={fetchLogs} disabled={loading} className="rounded-xl border-white/10 text-xs">
                        <RefreshCcw className={`w-4 h-4 mr-2 text-[#a3e635] ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <Card className="bg-[#202227] border-white/10 text-white">
                <CardContent className="p-4 flex flex-wrap gap-4 items-center">
                    <div className="relative flex-1 min-w-[220px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        <Input
                            placeholder="Search actor, action, description..."
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                            className="pl-10 bg-[#18191c] border-white/10 text-xs text-white placeholder-slate-500 rounded-xl"
                        />
                    </div>
                    <div className="flex items-center gap-2 text-sm flex-wrap sm:flex-nowrap">
                        <span className="text-slate-400 text-xs font-semibold">From:</span>
                        <Input
                            type="date"
                            value={startDate}
                            onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                            className="w-[140px] h-9 bg-[#18191c] border-white/10 text-white text-xs rounded-xl"
                        />
                        <span className="text-slate-400 text-xs font-semibold">To:</span>
                        <Input
                            type="date"
                            value={endDate}
                            onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                            className="w-[140px] h-9 bg-[#18191c] border-white/10 text-white text-xs rounded-xl"
                        />
                        {(startDate || endDate || searchTerm || actionFilter !== 'all') && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => { setStartDate(''); setEndDate(''); setSearchTerm(''); setActionFilter('all'); setPage(1); }}
                                className="text-red-400 hover:text-red-300 font-bold h-9 text-xs px-2"
                            >
                                Reset
                            </Button>
                        )}
                    </div>
                    <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(1); }}>
                        <SelectTrigger className="w-[180px] bg-[#18191c] border-white/10 text-white text-xs rounded-xl">
                            <SelectValue placeholder="Filter by action" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#202227] border-white/10 text-white">
                            {ACTION_TYPES.map((type) => (
                                <SelectItem key={type.value} value={type.value} className="text-xs">{type.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </CardContent>
            </Card>

            {/* Logs Table */}
            <Card className="bg-[#202227] border-white/10 text-white">
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                        <span>Recent Activity</span>
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#18191c] border border-white/10 text-slate-300">
                            {logs.length} records
                        </span>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-12 text-slate-400 text-xs">Loading activity logs...</div>
                    ) : paginatedLogs.length === 0 ? (
                        <div className="text-center py-12 text-slate-500 text-xs">No activity logs recorded yet.</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="text-slate-400 border-b border-white/10 pb-2">
                                        <th className="pb-3 font-semibold uppercase tracking-wider text-[10px]">Actor</th>
                                        <th className="pb-3 font-semibold uppercase tracking-wider text-[10px]">Role</th>
                                        <th className="pb-3 font-semibold uppercase tracking-wider text-[10px]">Action</th>
                                        <th className="pb-3 font-semibold uppercase tracking-wider text-[10px]">Description</th>
                                        <th className="pb-3 font-semibold uppercase tracking-wider text-[10px]">IP Address</th>
                                        <th className="pb-3 font-semibold uppercase tracking-wider text-[10px]">Time</th>
                                        <th className="pb-3 font-semibold uppercase tracking-wider text-[10px] text-right">Details</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {paginatedLogs.map((log) => {
                                        const roleBadge = ROLE_BADGES[log.userRole || 'customer'] || ROLE_BADGES.customer;
                                        return (
                                            <tr key={log.id} className="hover:bg-white/5 transition-colors cursor-pointer" onClick={() => setSelectedLog(log)}>
                                                <td className="py-3 pr-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-7 h-7 rounded-lg bg-[#18191c] border border-white/10 flex items-center justify-center text-[#a3e635] font-bold text-[11px] shrink-0">
                                                            {log.userName.slice(0, 2).toUpperCase()}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="font-bold text-white truncate">{log.userName}</p>
                                                            <p className="text-[10px] text-slate-400 truncate">{log.userEmail}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-3 pr-3">
                                                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md border ${roleBadge.color}`}>
                                                        {roleBadge.label}
                                                    </span>
                                                </td>
                                                <td className="py-3 pr-3">
                                                    <span className={`px-2 py-1 text-[10px] font-bold rounded-lg ${ACTION_COLORS[log.action] || 'bg-slate-500/20 text-slate-300 border border-slate-500/30'}`}>
                                                        {log.action}
                                                    </span>
                                                </td>
                                                <td className="py-3 pr-3 text-slate-300 font-medium max-w-xs truncate">{log.description}</td>
                                                <td className="py-3 pr-3 text-slate-400 text-[11px]">
                                                    <div className="flex items-center gap-1">
                                                        <Globe className="w-3 h-3 text-slate-500" />
                                                        {log.ipAddress || 'Internal'}
                                                    </div>
                                                </td>
                                                <td className="py-3 pr-3 text-slate-400 whitespace-nowrap text-[11px]">
                                                    <div className="flex items-center gap-1">
                                                        <Clock className="w-3 h-3 text-slate-500" />
                                                        {new Date(log.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                </td>
                                                <td className="py-3 text-right">
                                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:bg-white/10 rounded-lg text-slate-400 hover:text-[#a3e635]">
                                                        <Info className="w-3.5 h-3.5" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Unified Server-Side Pagination */}
                    <div className="mt-4 pt-4 border-t border-white/5">
                        <PaginationControl
                            meta={{
                                page,
                                limit,
                                total,
                                totalPages,
                                hasNextPage,
                                hasPreviousPage
                            }}
                            onPageChange={setPage}
                            onLimitChange={(newLimit) => {
                                setLimit(newLimit);
                                setPage(1);
                            }}
                            loading={loading}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Metadata Drawer / Modal */}
            <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
                <DialogContent className="bg-[#202227] border-white/10 text-white max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="text-base font-bold flex items-center gap-2">
                            <Activity className="w-5 h-5 text-[#a3e635]" />
                            Activity Log Details
                        </DialogTitle>
                        <DialogDescription className="text-slate-400 text-xs">
                            Complete audit record and execution payload.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedLog && (
                        <div className="space-y-4 pt-2 text-xs">
                            <div className="grid grid-cols-2 gap-3 p-3 bg-[#18191c] rounded-xl border border-white/5">
                                <div>
                                    <span className="text-slate-500 uppercase tracking-wider text-[10px] font-semibold">Actor Name</span>
                                    <p className="font-bold text-white text-sm">{selectedLog.userName}</p>
                                    <p className="text-slate-400 text-[11px]">{selectedLog.userEmail}</p>
                                </div>
                                <div>
                                    <span className="text-slate-500 uppercase tracking-wider text-[10px] font-semibold">Role</span>
                                    <p className="font-extrabold text-[#a3e635] text-sm uppercase">{selectedLog.userRole || 'CUSTOMER'}</p>
                                </div>
                                <div>
                                    <span className="text-slate-500 uppercase tracking-wider text-[10px] font-semibold">Action</span>
                                    <p className="font-bold text-white">{selectedLog.action}</p>
                                </div>
                                <div>
                                    <span className="text-slate-500 uppercase tracking-wider text-[10px] font-semibold">Timestamp</span>
                                    <p className="font-medium text-slate-300">{new Date(selectedLog.createdAt).toLocaleString()}</p>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <span className="text-slate-500 uppercase tracking-wider text-[10px] font-semibold">Description</span>
                                <p className="p-3 bg-[#18191c] rounded-xl border border-white/5 font-medium text-white">{selectedLog.description}</p>
                            </div>

                            {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                                <div className="space-y-1">
                                    <span className="text-slate-500 uppercase tracking-wider text-[10px] font-semibold">Action Metadata</span>
                                    <pre className="p-3 bg-[#18191c] rounded-xl border border-white/5 font-mono text-[11px] text-[#a3e635] overflow-x-auto max-h-48 scrollbar-thin">
                                        {JSON.stringify(selectedLog.metadata, null, 2)}
                                    </pre>
                                </div>
                            )}

                            <div className="pt-2 flex justify-end">
                                <Button onClick={() => setSelectedLog(null)} className="bg-[#a3e635] text-black font-bold hover:bg-[#b5f73c] text-xs rounded-xl">
                                    Close
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
