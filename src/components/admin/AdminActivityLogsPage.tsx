import { useState, useEffect, useCallback } from 'react';
import { adminService, ActivityLog } from '@/services/admin.service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { exportActivityLogs } from '@/lib/export';
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { Activity, Search, RefreshCcw, User, Clock, Globe, ChevronLeft, ChevronRight, Download, FileSpreadsheet, FileText, FileCode } from 'lucide-react';

const ACTION_TYPES = [
    { value: 'all', label: 'All Actions' },
    { value: 'LOGIN', label: 'Login' },
    { value: 'REGISTER', label: 'Registration' },
    { value: 'PURCHASE', label: 'Purchase' },
    { value: 'WALLET_FUND', label: 'Wallet Funding' },
    { value: 'AGENT_APPLICATION', label: 'Agent Application' },
];

const ACTION_COLORS: Record<string, string> = {
    LOGIN: 'bg-blue-500/20 text-blue-500',
    REGISTER: 'bg-emerald-500/20 text-emerald-500',
    PURCHASE: 'bg-yellow-500/20 text-yellow-600',
    WALLET_FUND: 'bg-purple-500/20 text-purple-500',
    AGENT_APPLICATION: 'bg-orange-500/20 text-orange-500',
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
    const logsPerPage = 25;

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const data = await adminService.getActivityLogs({
                action: actionFilter !== 'all' ? actionFilter : undefined,
                limit: 500,
            });
            setLogs(data);
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
    }, [actionFilter, toast]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const filteredLogs = logs.filter((log) => {
        const matchesSearch =
            log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.description.toLowerCase().includes(searchTerm.toLowerCase());
            
        let matchesDate = true;
        if (log.createdAt) {
            const logDate = new Date(log.createdAt);
            if (startDate) {
                const start = new Date(startDate);
                start.setHours(0, 0, 0, 0);
                if (logDate < start) matchesDate = false;
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                if (logDate > end) matchesDate = false;
            }
        }
        
        return matchesSearch && matchesDate;
    });

    const handleExport = (format: 'excel' | 'csv' | 'json') => {
        if (filteredLogs.length === 0) {
            toast({
                title: 'No Data',
                description: 'There are no activity logs to export.',
                variant: 'destructive'
            });
            return;
        }

        exportActivityLogs(filteredLogs, {
            filename: `activity_logs_${actionFilter}`,
            format,
            sheetName: 'Activity Logs'
        });

        const formatLabels: Record<string, string> = {
            excel: 'Excel (.xls)',
            csv: 'CSV',
            json: 'JSON'
        };

        toast({
            title: 'Export Successful',
            description: `Exported ${filteredLogs.length} activity log(s) to ${formatLabels[format]}.`
        });
    };

    const paginatedLogs = filteredLogs.slice((page - 1) * logsPerPage, page * logsPerPage);
    const totalPages = Math.ceil(filteredLogs.length / logsPerPage);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Activity className="w-6 h-6 text-primary" />
                        Activity Logs
                    </h1>
                    <p className="text-muted-foreground">Monitor all user activities on the platform.</p>
                </div>
                <div className="flex items-center gap-3">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="rounded-xl border-border/50 hover:bg-primary/10 hover:text-primary transition-all font-bold">
                                <Download className="w-4 h-4 mr-2" />
                                Export Activity Logs
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-card border-border">
                            <DropdownMenuLabel>Choose Format</DropdownMenuLabel>
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
                    <Button variant="outline" onClick={fetchLogs} disabled={loading} className="rounded-xl">
                        <RefreshCcw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="p-4 flex flex-wrap gap-4 items-center">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by name, email, or description..."
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                            className="pl-10"
                        />
                    </div>
                    <div className="flex items-center gap-2 text-sm flex-wrap sm:flex-nowrap">
                        <span className="text-muted-foreground text-xs">From:</span>
                        <Input
                            type="date"
                            value={startDate}
                            onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                            className="w-[140px] h-9 bg-accent/50 border-border text-foreground text-xs"
                        />
                        <span className="text-muted-foreground text-xs">To:</span>
                        <Input
                            type="date"
                            value={endDate}
                            onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                            className="w-[140px] h-9 bg-accent/50 border-border text-foreground text-xs"
                        />
                        {(startDate || endDate) && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => { setStartDate(''); setEndDate(''); setPage(1); }}
                                className="text-red-500 hover:text-red-600 font-bold h-9 text-xs px-2"
                            >
                                Clear
                            </Button>
                        )}
                    </div>
                    <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(1); }}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Filter by action" />
                        </SelectTrigger>
                        <SelectContent>
                            {ACTION_TYPES.map((type) => (
                                <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </CardContent>
            </Card>

            {/* Logs Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Recent Activity ({filteredLogs.length})</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-10 text-muted-foreground">Loading activity logs...</div>
                    ) : paginatedLogs.length === 0 ? (
                        <div className="text-center py-10 text-muted-foreground">No activity logs found.</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="text-left text-sm text-muted-foreground border-b">
                                        <th className="pb-3 font-medium">User</th>
                                        <th className="pb-3 font-medium">Action</th>
                                        <th className="pb-3 font-medium">Description</th>
                                        <th className="pb-3 font-medium">IP Address</th>
                                        <th className="pb-3 font-medium">Time</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedLogs.map((log) => (
                                        <tr key={log.id} className="border-b hover:bg-muted/50">
                                            <td className="py-3">
                                                <div className="flex items-center gap-2">
                                                    <User className="w-4 h-4 text-muted-foreground" />
                                                    <div>
                                                        <p className="font-medium">{log.userName}</p>
                                                        <p className="text-xs text-muted-foreground">{log.userEmail}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-3">
                                                <span className={`px-2 py-1 text-xs rounded ${ACTION_COLORS[log.action] || 'bg-gray-500/20 text-gray-500'}`}>
                                                    {log.action}
                                                </span>
                                            </td>
                                            <td className="py-3 text-sm max-w-xs truncate">{log.description}</td>
                                            <td className="py-3 text-sm text-muted-foreground">
                                                <div className="flex items-center gap-1">
                                                    <Globe className="w-3 h-3" />
                                                    {log.ipAddress || 'N/A'}
                                                </div>
                                            </td>
                                            <td className="py-3 text-sm text-muted-foreground">
                                                <div className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {new Date(log.createdAt).toLocaleString()}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between mt-4 pt-4 border-t">
                            <p className="text-sm text-muted-foreground">
                                Page {page} of {totalPages}
                            </p>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                                    <ChevronLeft className="w-4 h-4" />
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                                    <ChevronRight className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
