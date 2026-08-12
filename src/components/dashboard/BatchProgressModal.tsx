import React, { useEffect, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle2, AlertTriangle, Clock, RefreshCw, XCircle, ShieldAlert } from 'lucide-react';
import { getBulkSubmissionStatusApi, getBulkSubmissionItemsApi, BulkSubmissionStatus, BulkItem } from '@/services/bulk.service';

interface BatchProgressModalProps {
    submissionId: string | null;
    open: boolean;
    onClose: () => void;
}

export const BatchProgressModal: React.FC<BatchProgressModalProps> = ({ submissionId, open, onClose }) => {
    const [status, setStatus] = useState<BulkSubmissionStatus | null>(null);
    const [items, setItems] = useState<BulkItem[]>([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [filterStatus, setFilterStatus] = useState('all');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!open || !submissionId) return;

        let interval: NodeJS.Timeout;

        const fetchData = async () => {
            try {
                const res = await getBulkSubmissionStatusApi(submissionId);
                if (res.success && res.data) {
                    setStatus(res.data);
                }

                const itemsRes = await getBulkSubmissionItemsApi(submissionId, page, 50, filterStatus);
                if (itemsRes.success) {
                    setItems(itemsRes.data);
                    setTotalPages(itemsRes.pagination.totalPages);
                }
            } catch (err) {
                console.error('Error polling batch progress:', err);
            }
        };

        fetchData();
        interval = setInterval(fetchData, 3000); // Poll every 3 seconds

        return () => clearInterval(interval);
    }, [open, submissionId, page, filterStatus]);

    if (!status) return null;

    const isFinished = status.status === 'completed' || status.status === 'completed_with_errors' || status.status === 'failed';

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-card border-border">
                <DialogHeader>
                    <div className="flex items-center justify-between">
                        <DialogTitle className="text-xl flex items-center gap-2">
                            <span>Batch Processing Progress</span>
                            <Badge variant="outline" className="font-mono">{status.referenceCode}</Badge>
                        </DialogTitle>
                        <Badge className={
                            status.status === 'completed' ? 'bg-green-500/20 text-green-500 border-green-500/30' :
                            status.status === 'completed_with_errors' ? 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30' :
                            status.status === 'processing' ? 'bg-blue-500/20 text-blue-500 border-blue-500/30' :
                            'bg-muted text-muted-foreground'
                        }>
                            {status.status.toUpperCase()}
                        </Badge>
                    </div>
                    <DialogDescription>
                        Network: {status.network} | Data: {status.dataAmount} | Source: {status.source}
                    </DialogDescription>
                </DialogHeader>

                {/* Progress Bar & Breakdown */}
                <div className="space-y-4 my-4">
                    <div className="flex justify-between text-sm font-medium">
                        <span>Progress ({status.progressPercent}%)</span>
                        <span>{status.completed + status.failed + status.blocked + status.pendingMtn} / {status.totalRecipients} processed</span>
                    </div>
                    <Progress value={status.progressPercent} className="h-3" />

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
                        <div className="p-3 bg-muted/40 rounded-xl border border-border text-center">
                            <div className="text-xs text-muted-foreground font-semibold">Total</div>
                            <div className="text-xl font-bold">{status.totalRecipients}</div>
                        </div>
                        <div className="p-3 bg-green-500/10 text-green-500 rounded-xl border border-green-500/20 text-center">
                            <div className="text-xs font-semibold flex items-center justify-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Completed
                            </div>
                            <div className="text-xl font-bold">{status.completed}</div>
                        </div>
                        <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl border border-amber-500/20 text-center">
                            <div className="text-xs font-semibold flex items-center justify-center gap-1">
                                <Clock className="w-3.5 h-3.5" /> Pending MTN
                            </div>
                            <div className="text-xl font-bold">{status.pendingMtn}</div>
                        </div>
                        <div className="p-3 bg-red-500/10 text-red-500 rounded-xl border border-red-500/20 text-center">
                            <div className="text-xs font-semibold flex items-center justify-center gap-1">
                                <XCircle className="w-3.5 h-3.5" /> Failed
                            </div>
                            <div className="text-xl font-bold">{status.failed}</div>
                        </div>
                        <div className="p-3 bg-purple-500/10 text-purple-500 rounded-xl border border-purple-500/20 text-center">
                            <div className="text-xs font-semibold flex items-center justify-center gap-1">
                                <ShieldAlert className="w-3.5 h-3.5" /> Blocked
                            </div>
                            <div className="text-xl font-bold">{status.blocked}</div>
                        </div>
                    </div>
                </div>

                {/* Filter & Paginated Items Table */}
                <div className="space-y-3 pt-4">
                    <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-sm">Recipient Details</h4>
                        <div className="flex gap-1 text-xs">
                            {['all', 'completed', 'pending_mtn_approval', 'failed', 'blocked'].map(st => (
                                <Button
                                    key={st}
                                    variant={filterStatus === st ? 'default' : 'ghost'}
                                    size="sm"
                                    className="h-7 text-xs capitalize"
                                    onClick={() => { setFilterStatus(st); setPage(1); }}
                                >
                                    {st.replace(/_/g, ' ')}
                                </Button>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-xl border border-border overflow-hidden">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="w-12">#</TableHead>
                                    <TableHead>Phone Number</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Reference / Note</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {items.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-6 text-muted-foreground text-sm">
                                            No items match the selected filter.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    items.map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell className="font-mono text-xs text-muted-foreground">{item.item_index + 1}</TableCell>
                                            <TableCell className="font-medium">{item.recipient_phone}</TableCell>
                                            <TableCell>
                                                <Badge className={
                                                    item.status === 'completed' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                                                    item.status === 'pending_mtn_approval' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                                                    item.status === 'failed' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                                                    item.status === 'blocked' ? 'bg-purple-500/10 text-purple-500 border-purple-500/20' :
                                                    'bg-blue-500/10 text-blue-500 border-blue-500/20'
                                                }>
                                                    {item.status.replace(/_/g, ' ')}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                {item.datahouse_reference || item.error_message || (item.status === 'pending_mtn_approval' ? 'Queued for MTN Approval' : 'Processing...')}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between pt-2">
                            <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                                    Previous
                                </Button>
                                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                                    Next
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};
