import React, { useEffect, useState, useMemo } from 'react';
import { agentStoreService, AgentStore, AgentWithdrawal } from '@/services/agentStore.service';
import { Store, RefreshCw, Search, ChevronDown, AlertTriangle, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

type StoreWithMeta = AgentStore & { owner_name: string; owner_email: string; total_orders: number };
type WithdrawalWithMeta = AgentWithdrawal & { store_name: string; agent_name: string; agent_email: string };

// --- Confirmation Dialog ---
const ConfirmDialog: React.FC<{
    open: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    variant?: 'danger' | 'default';
    onConfirm: () => void;
    onCancel: () => void;
}> = ({ open, title, message, confirmLabel = 'Confirm', variant = 'default', onConfirm, onCancel }) => {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#202227] border border-white/10 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
                <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${variant === 'danger' ? 'bg-red-500/15 text-red-400' : 'bg-blue-500/15 text-blue-400'}`}>
                        <AlertTriangle className="w-4.5 h-4.5" />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-white">{title}</h4>
                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">{message}</p>
                    </div>
                </div>
                <div className="flex gap-2 justify-end pt-2">
                    <button onClick={onCancel} className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-[#18191c] rounded-lg border border-white/10 transition-colors">
                        Cancel
                    </button>
                    <button onClick={onConfirm} className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors ${variant === 'danger' ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-[#a3e635] hover:bg-[#b5f73c] text-black'}`}>
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Status Dot ---
const StatusDot: React.FC<{ status: string }> = ({ status }) => {
    const config: Record<string, { color: string; pulse: boolean; label: string }> = {
        ACTIVE: { color: 'bg-emerald-500', pulse: true, label: 'Active' },
        APPROVED: { color: 'bg-blue-500', pulse: true, label: 'Approved' },
        PENDING: { color: 'bg-amber-500', pulse: true, label: 'Pending Review' },
        PENDING_REVIEW: { color: 'bg-amber-500', pulse: true, label: 'Pending Review' },
        AWAITING_ACTIVATION: { color: 'bg-blue-400', pulse: true, label: 'Awaiting Fee' },
        REJECTED: { color: 'bg-red-500', pulse: true, label: 'Rejected' },
        SUSPENDED: { color: 'bg-orange-500', pulse: true, label: 'Suspended' },
        INACTIVE: { color: 'bg-slate-400', pulse: false, label: 'Inactive' },
    };
    const c = config[status] || { color: 'bg-slate-400', pulse: false, label: status };
    return (
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-300">
            <span className={`w-2 h-2 rounded-full ${c.color} ${c.pulse ? 'animate-pulse' : ''}`} />
            {c.label}
        </span>
    );
};

const WithdrawalStatusDot: React.FC<{ status: string }> = ({ status }) => {
    const config: Record<string, { color: string; label: string }> = {
        REQUESTED: { color: 'bg-amber-400', label: 'Requested' },
        PENDING: { color: 'bg-amber-400', label: 'Pending' },
        PROCESSING: { color: 'bg-blue-400', label: 'Processing' },
        COMPLETED: { color: 'bg-emerald-400', label: 'Completed' },
        FAILED: { color: 'bg-red-400', label: 'Failed / Refunded' },
    };
    const c = config[status] || { color: 'bg-slate-400', label: status };
    return (
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-300">
            <span className={`w-2 h-2 rounded-full ${c.color}`} />
            {c.label}
        </span>
    );
};

// --- Main Component ---
export const AdminAgentStoresPage: React.FC = () => {
    const { toast } = useToast();
    const [stores, setStores] = useState<StoreWithMeta[]>([]);
    const [withdrawals, setWithdrawals] = useState<WithdrawalWithMeta[]>([]);
    const [rules, setRules] = useState<{ min_markup_ghc: number; max_markup_ghc: number; min_withdrawal_ghc: number }>({ min_markup_ghc: 0.50, max_markup_ghc: 50.00, min_withdrawal_ghc: 20.00 });

    const [activeTab, setActiveTab] = useState<'stores' | 'withdrawals' | 'rules'>('stores');
    const [loading, setLoading] = useState(true);

    // Search & filter
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('ALL');

    // Review modal
    const [selectedStore, setSelectedStore] = useState<AgentStore | null>(null);
    const [reviewStatus, setReviewStatus] = useState<string>('APPROVED');
    const [adminNotes, setAdminNotes] = useState<string>('');
    const [processingAction, setProcessingAction] = useState(false);

    // Rules editing
    const [minMarkup, setMinMarkup] = useState<string>('0.50');
    const [maxMarkup, setMaxMarkup] = useState<string>('50.00');
    const [minWithdrawal, setMinWithdrawal] = useState<string>('20.00');

    // Confirmation dialog
    const [confirmDialog, setConfirmDialog] = useState<{
        open: boolean; title: string; message: string; confirmLabel: string; variant: 'danger' | 'default'; onConfirm: () => void;
    }>({ open: false, title: '', message: '', confirmLabel: '', variant: 'default', onConfirm: () => {} });

    const loadAdminData = async () => {
        setLoading(true);
        try {
            const [storesRes, wdRes, rulesRes] = await Promise.all([
                agentStoreService.adminGetAllStores(),
                agentStoreService.adminGetAllWithdrawals(),
                agentStoreService.adminGetPricingRules()
            ]);
            setStores(storesRes || []);
            setWithdrawals(wdRes || []);
            if (rulesRes) {
                setRules(rulesRes);
                setMinMarkup(String(rulesRes.min_markup_ghc || '0.50'));
                setMaxMarkup(String(rulesRes.max_markup_ghc || '50.00'));
                setMinWithdrawal(String(rulesRes.min_withdrawal_ghc || '20.00'));
            }
        } catch (err: any) {
            toast({ title: 'Error', description: err.message || 'Failed to load admin store data', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadAdminData(); }, []);

    // --- Computed metrics ---
    const metrics = useMemo(() => {
        const active = stores.filter(s => s.effective_status === 'ACTIVE').length;
        const pending = stores.filter(s => s.effective_status === 'PENDING_REVIEW' || s.effective_status === 'AWAITING_ACTIVATION').length;
        const suspended = stores.filter(s => s.effective_status === 'SUSPENDED').length;
        const pendingWithdrawals = withdrawals.filter(w => w.status === 'REQUESTED' || w.status === 'PENDING').length;
        return { total: stores.length, active, pending, suspended, pendingWithdrawals };
    }, [stores, withdrawals]);

    // --- Filtered stores ---
    const filteredStores = useMemo(() => {
        let result = stores;
        if (statusFilter !== 'ALL') {
            result = result.filter(s => s.effective_status === statusFilter);
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(s =>
                s.store_name.toLowerCase().includes(q) ||
                s.owner_name?.toLowerCase().includes(q) ||
                s.owner_email?.toLowerCase().includes(q) ||
                s.slug?.toLowerCase().includes(q)
            );
        }
        return result;
    }, [stores, statusFilter, searchQuery]);

    // --- Actions ---
    const handleUpdateReviewStatus = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedStore) return;
        setProcessingAction(true);
        try {
            const res = await agentStoreService.adminUpdateStoreReview(selectedStore.id, reviewStatus, adminNotes);
            toast({ title: 'Status Updated', description: res.message });
            setSelectedStore(null);
            setAdminNotes('');
            loadAdminData();
        } catch (err: any) {
            toast({ title: 'Error', description: err.message, variant: 'destructive' });
        } finally {
            setProcessingAction(false);
        }
    };

    const confirmManualActivate = (storeId: string, storeName: string) => {
        setConfirmDialog({
            open: true,
            title: 'Confirm Manual Activation',
            message: `Mark "${storeName}" as PAID? This bypasses payment verification and activates the store immediately.`,
            confirmLabel: 'Mark Paid',
            variant: 'default',
            onConfirm: async () => {
                setConfirmDialog(prev => ({ ...prev, open: false }));
                try {
                    const res = await agentStoreService.adminManualActivateStore(storeId);
                    toast({ title: 'Activated', description: res.message });
                    loadAdminData();
                } catch (err: any) {
                    toast({ title: 'Error', description: err.message, variant: 'destructive' });
                }
            }
        });
    };

    const confirmDeleteStore = (storeId: string, storeName: string) => {
        setConfirmDialog({
            open: true,
            title: 'Delete Agent Store?',
            message: `Are you sure you want to delete "${storeName}"? This will permanently delete the store, its product configurations, and custom settings. This action cannot be undone.`,
            confirmLabel: 'Delete Store',
            variant: 'danger',
            onConfirm: async () => {
                setConfirmDialog(prev => ({ ...prev, open: false }));
                try {
                    const res = await agentStoreService.adminDeleteStore(storeId);
                    toast({ title: 'Store Deleted', description: res.message });
                    loadAdminData();
                } catch (err: any) {
                    toast({ title: 'Delete Failed', description: err.message, variant: 'destructive' });
                }
            }
        });
    };

    const confirmWithdrawalAction = (withdrawalId: string, status: 'COMPLETED' | 'FAILED', agentName: string, amount: string) => {
        const isDanger = status === 'FAILED';
        setConfirmDialog({
            open: true,
            title: isDanger ? 'Reject & Refund Withdrawal?' : 'Complete Withdrawal?',
            message: isDanger
                ? `Reject ${agentName}'s GHS ${amount} withdrawal and refund balance?`
                : `Confirm GHS ${amount} payout to ${agentName} has been completed?`,
            confirmLabel: isDanger ? 'Reject & Refund' : 'Mark Completed',
            variant: isDanger ? 'danger' : 'default',
            onConfirm: async () => {
                setConfirmDialog(prev => ({ ...prev, open: false }));
                try {
                    const res = await agentStoreService.adminUpdateWithdrawalStatus(withdrawalId, status);
                    toast({ title: 'Updated', description: res.message });
                    loadAdminData();
                } catch (err: any) {
                    toast({ title: 'Error', description: err.message, variant: 'destructive' });
                }
            }
        });
    };

    const handleSaveRules = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await agentStoreService.adminUpdatePricingRules({
                min_markup_ghc: parseFloat(minMarkup),
                max_markup_ghc: parseFloat(maxMarkup),
                min_withdrawal_ghc: parseFloat(minWithdrawal)
            });
            toast({ title: 'Rules Saved', description: res.message });
            loadAdminData();
        } catch (err: any) {
            toast({ title: 'Error', description: err.message, variant: 'destructive' });
        }
    };

    const pendingWithdrawals = withdrawals.filter(w => w.status === 'REQUESTED' || w.status === 'PENDING');

    return (
        <div className="space-y-5 min-h-screen font-sans">

            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                        <Store className="w-5 h-5 text-primary" />
                        Agent Stores
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Manage store applications, payouts, and pricing rules.
                    </p>
                </div>
                <button
                    onClick={loadAdminData}
                    disabled={loading}
                    className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            {/* Summary Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: 'Total Stores', value: metrics.total, accent: 'text-foreground' },
                    { label: 'Active', value: metrics.active, accent: 'text-emerald-400' },
                    { label: 'Pending Review', value: metrics.pending, accent: 'text-amber-400' },
                    { label: 'Pending Withdrawals', value: metrics.pendingWithdrawals, accent: 'text-blue-400' },
                ].map(m => (
                    <div key={m.label} className="bg-card border border-border rounded-xl p-4">
                        <p className="text-[11px] text-muted-foreground font-medium">{m.label}</p>
                        <p className={`text-2xl font-bold mt-1 ${m.accent}`}>{m.value}</p>
                    </div>
                ))}
            </div>

            {/* Tab Navigation */}
            <div className="flex items-center gap-1 border-b border-border">
                {[
                    { key: 'stores' as const, label: `Stores (${stores.length})` },
                    { key: 'withdrawals' as const, label: `Payouts${pendingWithdrawals.length > 0 ? ` (${pendingWithdrawals.length})` : ''}` },
                    { key: 'rules' as const, label: 'Pricing Rules' },
                ].map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`px-4 py-2.5 text-xs font-semibold transition-colors border-b-2 -mb-px ${
                            activeTab === tab.key
                                ? 'border-primary text-primary'
                                : 'border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ============ STORES TAB ============ */}
            {activeTab === 'stores' && (
                <div className="space-y-3">
                    {/* Search + Filter Bar */}
                    <div className="flex flex-col sm:flex-row gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Search store, owner, or email..."
                                className="w-full pl-9 pr-3 py-2 text-xs bg-card border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                            />
                        </div>
                        <div className="relative">
                            <select
                                value={statusFilter}
                                onChange={e => setStatusFilter(e.target.value)}
                                className="appearance-none pl-3 pr-8 py-2 text-xs bg-card border border-border rounded-lg text-foreground focus:outline-none focus:border-primary cursor-pointer"
                            >
                                <option value="ALL">All Statuses</option>
                                <option value="ACTIVE">Active</option>
                                <option value="APPROVED">Approved</option>
                                <option value="PENDING">Pending Review</option>
                                <option value="SUSPENDED">Suspended</option>
                                <option value="REJECTED">Rejected</option>
                                <option value="INACTIVE">Inactive</option>
                            </select>
                            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                        </div>
                    </div>

                    {/* Table */}
                    <div className="bg-card border border-border rounded-xl overflow-hidden">
                        {loading ? (
                            <div className="p-6 space-y-3">
                                {Array.from({ length: 5 }).map((_, i) => (
                                    <div key={i} className="flex gap-4">
                                        <div className="h-3 w-28 bg-muted rounded animate-pulse" />
                                        <div className="h-3 w-24 bg-muted rounded animate-pulse" />
                                        <div className="h-3 w-16 bg-muted rounded animate-pulse" />
                                        <div className="h-3 w-12 bg-muted rounded animate-pulse" />
                                        <div className="h-3 w-16 bg-muted rounded animate-pulse" />
                                    </div>
                                ))}
                            </div>
                        ) : filteredStores.length === 0 ? (
                            <div className="p-12 text-center text-muted-foreground text-sm">
                                {searchQuery || statusFilter !== 'ALL' ? 'No stores match your filters.' : 'No Agent Stores created yet.'}
                            </div>
                        ) : (
                            <>
                                {/* Desktop Table */}
                                <div className="hidden md:block overflow-x-auto">
                                    <table className="w-full text-left text-xs">
                                        <thead className="border-b border-border">
                                            <tr className="text-muted-foreground font-medium">
                                                <th className="px-4 py-3">Store</th>
                                                <th className="px-4 py-3">Owner</th>
                                                <th className="px-4 py-3">Status</th>
                                                <th className="px-4 py-3 text-right">Orders</th>
                                                <th className="px-4 py-3 text-right">Profit</th>
                                                <th className="px-4 py-3 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {filteredStores.map(s => {
                                                const storeName = s.store_name || (s as any).storeName || 'Store';
                                                const ownerName = s.owner_name || (s as any).userName || 'Owner';
                                                const ownerEmail = s.owner_email || (s as any).userEmail || '';
                                                const effStatus = s.effective_status || (s as any).effectiveStatus || 'PENDING';
                                                const actStatus = s.activation_status || (s as any).activationStatus || 'UNPAID';
                                                const totalOrders = s.total_orders || (s as any).totalOrders || 0;
                                                const totalProfit = s.total_profit_earned || (s as any).totalRevenue || 0;

                                                return (
                                                    <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                                                        <td className="px-4 py-3">
                                                            <p className="font-semibold text-foreground">{storeName}</p>
                                                            <p className="text-[10px] text-muted-foreground font-mono mt-0.5">/store/{s.slug}</p>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <p className="font-medium text-foreground">{ownerName}</p>
                                                            <p className="text-[10px] text-muted-foreground mt-0.5">{ownerEmail}</p>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <StatusDot status={effStatus} />
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-medium text-foreground">{totalOrders}</td>
                                                        <td className="px-4 py-3 text-right font-semibold text-emerald-400">
                                                            GHS {(parseFloat(totalProfit as any) || 0).toFixed(2)}
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <div className="flex items-center justify-end gap-1.5">
                                                                <button
                                                                    onClick={() => setSelectedStore(s)}
                                                                    className="px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-primary/10 rounded-md transition-colors"
                                                                >
                                                                    Review
                                                                </button>
                                                                {actStatus !== 'PAID' && (
                                                                    <button
                                                                        onClick={() => confirmManualActivate(s.id, storeName)}
                                                                        className="px-2.5 py-1 text-[11px] font-semibold text-amber-400 hover:bg-amber-400/10 rounded-md transition-colors"
                                                                    >
                                                                        Mark Paid
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={() => confirmDeleteStore(s.id, storeName)}
                                                                    className="px-2 py-1 text-[11px] font-semibold text-red-400 hover:bg-red-500/10 rounded-md transition-colors flex items-center gap-1"
                                                                    title="Delete Store"
                                                                >
                                                                    <Trash2 className="w-3 h-3" />
                                                                    Delete
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Mobile Card View */}
                                <div className="md:hidden divide-y divide-border">
                                    {filteredStores.map(s => {
                                        const storeName = s.store_name || (s as any).storeName || 'Store';
                                        const ownerName = s.owner_name || (s as any).userName || 'Owner';
                                        const ownerEmail = s.owner_email || (s as any).userEmail || '';
                                        const effStatus = s.effective_status || (s as any).effectiveStatus || 'PENDING';
                                        const actStatus = s.activation_status || (s as any).activationStatus || 'UNPAID';
                                        const totalOrders = s.total_orders || (s as any).totalOrders || 0;
                                        const totalProfit = s.total_profit_earned || (s as any).totalRevenue || 0;

                                        return (
                                            <div key={s.id} className="p-4 space-y-2.5">
                                                <div className="flex items-start justify-between">
                                                    <div>
                                                        <p className="font-semibold text-foreground text-sm">{storeName}</p>
                                                        <p className="text-[10px] text-muted-foreground mt-0.5">{ownerName} · {ownerEmail}</p>
                                                    </div>
                                                    <StatusDot status={effStatus} />
                                                </div>
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="text-muted-foreground">{totalOrders} orders · GHS {(parseFloat(totalProfit as any) || 0).toFixed(2)} profit</span>
                                                    <div className="flex gap-1.5">
                                                        <button
                                                            onClick={() => setSelectedStore(s)}
                                                            className="px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-primary/10 rounded-md transition-colors"
                                                        >
                                                            Review
                                                        </button>
                                                        {actStatus !== 'PAID' && (
                                                            <button
                                                                onClick={() => confirmManualActivate(s.id, storeName)}
                                                                className="px-2.5 py-1 text-[11px] font-semibold text-amber-400 hover:bg-amber-400/10 rounded-md transition-colors"
                                                            >
                                                                Mark Paid
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => confirmDeleteStore(s.id, storeName)}
                                                            className="px-2 py-1 text-[11px] font-semibold text-red-400 hover:bg-red-500/10 rounded-md transition-colors flex items-center gap-1"
                                                            title="Delete Store"
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                            Delete
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* ============ WITHDRAWALS TAB ============ */}
            {activeTab === 'withdrawals' && (
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                    {withdrawals.length === 0 ? (
                        <div className="p-12 text-center text-muted-foreground text-sm">No withdrawal requests.</div>
                    ) : (
                        <>
                            {/* Desktop Table */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="border-b border-border">
                                        <tr className="text-muted-foreground font-medium">
                                            <th className="px-4 py-3">Agent</th>
                                            <th className="px-4 py-3">Store</th>
                                            <th className="px-4 py-3 text-right">Amount</th>
                                            <th className="px-4 py-3">Method</th>
                                            <th className="px-4 py-3">Account</th>
                                            <th className="px-4 py-3">Status</th>
                                            <th className="px-4 py-3 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {withdrawals.map(w => (
                                            <tr key={w.id} className="hover:bg-muted/30 transition-colors">
                                                <td className="px-4 py-3">
                                                    <p className="font-medium text-foreground">{w.agent_name}</p>
                                                    <p className="text-[10px] text-muted-foreground mt-0.5">{w.agent_email}</p>
                                                </td>
                                                <td className="px-4 py-3 text-foreground">{w.store_name || '—'}</td>
                                                <td className="px-4 py-3 text-right font-bold text-foreground">
                                                    GHS {(parseFloat(w.amount_ghc as any) || 0).toFixed(2)}
                                                </td>
                                                <td className="px-4 py-3 text-muted-foreground uppercase font-medium">
                                                    {w.payment_method} ({w.bank_momo_provider})
                                                </td>
                                                <td className="px-4 py-3">
                                                    <p className="font-medium text-foreground">{w.account_number}</p>
                                                    <p className="text-[10px] text-muted-foreground mt-0.5">{w.account_name}</p>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <WithdrawalStatusDot status={w.status} />
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        {w.status !== 'COMPLETED' && w.status !== 'FAILED' && (
                                                            <>
                                                                <button
                                                                    onClick={() => confirmWithdrawalAction(w.id, 'COMPLETED', w.agent_name, (parseFloat(w.amount_ghc as any) || 0).toFixed(2))}
                                                                    className="px-2.5 py-1 text-[11px] font-semibold text-emerald-400 hover:bg-emerald-400/10 rounded-md transition-colors"
                                                                >
                                                                    Complete
                                                                </button>
                                                                <button
                                                                    onClick={() => confirmWithdrawalAction(w.id, 'FAILED', w.agent_name, (parseFloat(w.amount_ghc as any) || 0).toFixed(2))}
                                                                    className="px-2.5 py-1 text-[11px] font-semibold text-red-400 hover:bg-red-400/10 rounded-md transition-colors"
                                                                >
                                                                    Reject
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile Card View */}
                            <div className="md:hidden divide-y divide-border">
                                {withdrawals.map(w => (
                                    <div key={w.id} className="p-4 space-y-2">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <p className="font-semibold text-foreground text-sm">{w.agent_name}</p>
                                                <p className="text-[10px] text-muted-foreground">{w.store_name || '—'}</p>
                                            </div>
                                            <p className="font-bold text-foreground text-sm">GHS {(parseFloat(w.amount_ghc as any) || 0).toFixed(2)}</p>
                                        </div>
                                        <div className="flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-3">
                                                <WithdrawalStatusDot status={w.status} />
                                                <span className="text-muted-foreground uppercase text-[10px]">{w.payment_method} · {w.bank_momo_provider}</span>
                                            </div>
                                            {w.status !== 'COMPLETED' && w.status !== 'FAILED' && (
                                                <div className="flex gap-1.5">
                                                    <button
                                                        onClick={() => confirmWithdrawalAction(w.id, 'COMPLETED', w.agent_name, (parseFloat(w.amount_ghc as any) || 0).toFixed(2))}
                                                        className="px-2 py-1 text-[11px] font-semibold text-emerald-400 hover:bg-emerald-400/10 rounded-md"
                                                    >
                                                        Complete
                                                    </button>
                                                    <button
                                                        onClick={() => confirmWithdrawalAction(w.id, 'FAILED', w.agent_name, (parseFloat(w.amount_ghc as any) || 0).toFixed(2))}
                                                        className="px-2 py-1 text-[11px] font-semibold text-red-400 hover:bg-red-400/10 rounded-md"
                                                    >
                                                        Reject
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-[10px] text-muted-foreground">{w.account_number} · {w.account_name}</p>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* ============ RULES TAB ============ */}
            {activeTab === 'rules' && (
                <div className="bg-card border border-border rounded-xl p-6 max-w-lg space-y-5">
                    <div>
                        <h3 className="text-sm font-bold text-foreground">Global Pricing & Withdrawal Rules</h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                            Controls the markup range agents can set and minimum withdrawal threshold.
                        </p>
                    </div>

                    <form onSubmit={handleSaveRules} className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Minimum Markup (GHS)</label>
                            <input
                                type="number"
                                step="0.10"
                                value={minMarkup}
                                onChange={e => setMinMarkup(e.target.value)}
                                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:border-primary"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Maximum Markup (GHS)</label>
                            <input
                                type="number"
                                step="1.00"
                                value={maxMarkup}
                                onChange={e => setMaxMarkup(e.target.value)}
                                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:border-primary"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Minimum Withdrawal (GHS)</label>
                            <input
                                type="number"
                                step="1.00"
                                value={minWithdrawal}
                                onChange={e => setMinWithdrawal(e.target.value)}
                                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:border-primary"
                            />
                        </div>
                        <button
                            type="submit"
                            className="w-full py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg text-xs transition-colors"
                        >
                            Save Rules
                        </button>
                    </form>
                </div>
            )}

            {/* ============ REVIEW MODAL ============ */}
            {selectedStore && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
                        <div className="flex justify-between items-center">
                            <h3 className="text-sm font-bold text-foreground">Review Store Application</h3>
                            <button onClick={() => setSelectedStore(null)} className="text-muted-foreground hover:text-foreground text-lg leading-none">✕</button>
                        </div>

                        <div className="p-3 bg-muted/50 rounded-lg text-xs space-y-1.5 border border-border">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Store</span>
                                <span className="font-semibold text-foreground">{selectedStore.store_name}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Slug</span>
                                <span className="font-mono text-muted-foreground">/store/{selectedStore.slug}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Phone</span>
                                <span className="font-medium text-foreground">{selectedStore.phone}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Current Status</span>
                                <StatusDot status={selectedStore.effective_status} />
                            </div>
                        </div>

                        <form onSubmit={handleUpdateReviewStatus} className="space-y-3">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">Action</label>
                                <select
                                    value={reviewStatus}
                                    onChange={e => setReviewStatus(e.target.value)}
                                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:border-primary"
                                >
                                    <option value="APPROVED">Approve</option>
                                    <option value="REJECTED">Reject</option>
                                    <option value="CHANGES_REQUESTED">Request Changes</option>
                                    <option value="SUSPENDED">Suspend</option>
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">Note to Store Owner (optional)</label>
                                <textarea
                                    value={adminNotes}
                                    onChange={e => setAdminNotes(e.target.value)}
                                    placeholder="Explanation or instructions..."
                                    rows={3}
                                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={processingAction}
                                className="w-full py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg text-xs transition-colors disabled:opacity-50"
                            >
                                {processingAction ? 'Updating...' : 'Submit'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Confirmation Dialog */}
            <ConfirmDialog
                open={confirmDialog.open}
                title={confirmDialog.title}
                message={confirmDialog.message}
                confirmLabel={confirmDialog.confirmLabel}
                variant={confirmDialog.variant}
                onConfirm={confirmDialog.onConfirm}
                onCancel={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
            />
        </div>
    );
};

export default AdminAgentStoresPage;
