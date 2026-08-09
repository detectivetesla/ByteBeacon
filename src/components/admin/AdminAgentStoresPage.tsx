import React, { useEffect, useState } from 'react';
import { agentStoreService, AgentStore, AgentWithdrawal } from '@/services/agentStore.service';
import { Store, ShieldCheck, CheckCircle2, XCircle, AlertTriangle, DollarSign, Settings, RefreshCw, Eye } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export const AdminAgentStoresPage: React.FC = () => {
    const { toast } = useToast();
    const [stores, setStores] = useState<(AgentStore & { owner_name: string; owner_email: string; total_orders: number })[]>([]);
    const [withdrawals, setWithdrawals] = useState<(AgentWithdrawal & { store_name: string; agent_name: string; agent_email: string })[]>([]);
    const [rules, setRules] = useState<{ min_markup_ghc: number; max_markup_ghc: number; min_withdrawal_ghc: number }>({ min_markup_ghc: 0.50, max_markup_ghc: 50.00, min_withdrawal_ghc: 20.00 });

    const [activeTab, setActiveTab] = useState<'stores' | 'withdrawals' | 'rules'>('stores');
    const [loading, setLoading] = useState(true);

    // Modal state for store review action
    const [selectedStore, setSelectedStore] = useState<AgentStore | null>(null);
    const [reviewStatus, setReviewStatus] = useState<string>('APPROVED');
    const [adminNotes, setAdminNotes] = useState<string>('');
    const [processingAction, setProcessingAction] = useState(false);

    // Rules editing
    const [minMarkup, setMinMarkup] = useState<string>('0.50');
    const [maxMarkup, setMaxMarkup] = useState<string>('50.00');
    const [minWithdrawal, setMinWithdrawal] = useState<string>('20.00');

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

    useEffect(() => {
        loadAdminData();
    }, []);

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

    const handleManualActivate = async (storeId: string) => {
        try {
            const res = await agentStoreService.adminManualActivateStore(storeId);
            toast({ title: 'Activated!', description: res.message });
            loadAdminData();
        } catch (err: any) {
            toast({ title: 'Error', description: err.message, variant: 'destructive' });
        }
    };

    const handleUpdateWithdrawalStatus = async (withdrawalId: string, status: string) => {
        try {
            const res = await agentStoreService.adminUpdateWithdrawalStatus(withdrawalId, status);
            toast({ title: 'Withdrawal Updated', description: res.message });
            loadAdminData();
        } catch (err: any) {
            toast({ title: 'Error', description: err.message, variant: 'destructive' });
        }
    };

    const handleSaveRules = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await agentStoreService.adminUpdatePricingRules({
                min_markup_ghc: parseFloat(minMarkup),
                max_markup_ghc: parseFloat(maxMarkup),
                min_withdrawal_ghc: parseFloat(minWithdrawal)
            });
            toast({ title: 'Rules Saved!', description: res.message });
            loadAdminData();
        } catch (err: any) {
            toast({ title: 'Error', description: err.message, variant: 'destructive' });
        }
    };

    return (
        <div className="space-y-6 bg-[#141518] text-white p-6 rounded-3xl font-sans min-h-screen">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#202227] p-6 rounded-2xl border border-white/5">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Store className="w-5 h-5 text-[#a3e635]" />
                        Agent Store & Reseller Marketplace Admin
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                        Review store applications, process payouts, and manage global reseller markup bounds.
                    </p>
                </div>

                <button
                    onClick={loadAdminData}
                    className="px-4 py-2 bg-[#18191c] hover:bg-white/5 text-slate-300 rounded-xl border border-white/10 text-xs flex items-center gap-2 transition-all"
                >
                    <RefreshCw className="w-4 h-4 text-[#a3e635]" /> Refresh
                </button>
            </div>

            {/* Navigation Sub-Tabs */}
            <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                <button
                    onClick={() => setActiveTab('stores')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        activeTab === 'stores' ? 'bg-[#a3e635] text-black shadow-md' : 'bg-[#202227] text-slate-400 hover:text-white'
                    }`}
                >
                    Agent Stores ({stores.length})
                </button>
                <button
                    onClick={() => setActiveTab('withdrawals')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        activeTab === 'withdrawals' ? 'bg-[#a3e635] text-black shadow-md' : 'bg-[#202227] text-slate-400 hover:text-white'
                    }`}
                >
                    Payout Queue ({withdrawals.filter(w => w.status === 'REQUESTED' || w.status === 'PENDING').length})
                </button>
                <button
                    onClick={() => setActiveTab('rules')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        activeTab === 'rules' ? 'bg-[#a3e635] text-black shadow-md' : 'bg-[#202227] text-slate-400 hover:text-white'
                    }`}
                >
                    Markup Bounds Settings
                </button>
            </div>

            {/* STORES TAB */}
            {activeTab === 'stores' && (
                <div className="bg-[#202227] rounded-2xl border border-white/5 overflow-hidden shadow-xl">
                    {loading ? (
                        <div className="space-y-0">
                            <div className="bg-[#18191c] p-4 flex gap-6">
                                {Array.from({ length: 7 }).map((_, i) => (
                                    <div key={i} className="h-3 w-24 bg-[#2a2b30] rounded animate-pulse" />
                                ))}
                            </div>
                            {Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="p-4 flex gap-6 border-b border-white/5">
                                    <div className="h-3 w-32 bg-[#2a2b30] rounded animate-pulse" />
                                    <div className="h-3 w-28 bg-[#2a2b30] rounded animate-pulse" />
                                    <div className="h-3 w-20 bg-[#2a2b30] rounded animate-pulse" />
                                    <div className="h-3 w-16 bg-[#2a2b30] rounded animate-pulse" />
                                    <div className="h-3 w-12 bg-[#2a2b30] rounded animate-pulse" />
                                    <div className="h-3 w-16 bg-[#2a2b30] rounded animate-pulse" />
                                    <div className="h-3 w-20 bg-[#2a2b30] rounded animate-pulse" />
                                </div>
                            ))}
                        </div>
                    ) : stores.length === 0 ? (
                        <div className="p-12 text-center text-slate-400 text-sm">No Agent Stores created yet.</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs text-slate-300">
                                <thead className="bg-[#18191c] text-slate-400 font-semibold uppercase tracking-wider border-b border-white/5">
                                    <tr>
                                        <th className="p-4">Store Name & Slug</th>
                                        <th className="p-4">Owner</th>
                                        <th className="p-4">Review Status</th>
                                        <th className="p-4">Activation</th>
                                        <th className="p-4">Total Orders</th>
                                        <th className="p-4">Total Profit</th>
                                        <th className="p-4">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {stores.map(s => (
                                        <tr key={s.id} className="hover:bg-white/[0.02]">
                                            <td className="p-4">
                                                <div className="font-bold text-white">{s.store_name}</div>
                                                <div className="text-[10px] text-slate-500 font-mono">/store/{s.slug}</div>
                                            </td>
                                            <td className="p-4">
                                                <div className="font-semibold text-white">{s.owner_name}</div>
                                                <div className="text-[10px] text-slate-400">{s.owner_email}</div>
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                                                    s.review_status === 'APPROVED' ? 'bg-[#a3e635]/20 text-[#a3e635]' :
                                                    s.review_status === 'PENDING_REVIEW' ? 'bg-blue-400/20 text-blue-400' :
                                                    'bg-red-400/20 text-red-400'
                                                }`}>
                                                    {s.review_status}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                                                    s.activation_status === 'PAID' ? 'bg-[#a3e635]/20 text-[#a3e635]' : 'bg-amber-400/20 text-amber-400'
                                                }`}>
                                                    {s.activation_status}
                                                </span>
                                            </td>
                                            <td className="p-4 font-semibold text-white">{s.total_orders || 0}</td>
                                            <td className="p-4 font-bold text-[#a3e635]">GHS {parseFloat(s.total_profit_earned as any || 0).toFixed(2)}</td>
                                            <td className="p-4 flex items-center gap-2">
                                                <button
                                                    onClick={() => setSelectedStore(s)}
                                                    className="px-3 py-1.5 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded-lg font-bold text-[11px] border border-blue-500/30 transition-all"
                                                >
                                                    Review
                                                </button>
                                                {s.activation_status !== 'PAID' && (
                                                    <button
                                                        onClick={() => handleManualActivate(s.id)}
                                                        className="px-3 py-1.5 bg-[#a3e635]/20 text-[#a3e635] hover:bg-[#a3e635]/30 rounded-lg font-bold text-[11px] border border-[#a3e635]/30 transition-all"
                                                    >
                                                        Mark Paid
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* WITHDRAWALS TAB */}
            {activeTab === 'withdrawals' && (
                <div className="bg-[#202227] rounded-2xl border border-white/5 overflow-hidden shadow-xl">
                    {withdrawals.length === 0 ? (
                        <div className="p-12 text-center text-slate-400 text-sm">No withdrawal requests queued.</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs text-slate-300">
                                <thead className="bg-[#18191c] text-slate-400 font-semibold uppercase tracking-wider border-b border-white/5">
                                    <tr>
                                        <th className="p-4">Agent Name</th>
                                        <th className="p-4">Store</th>
                                        <th className="p-4">Amount</th>
                                        <th className="p-4">Method & Provider</th>
                                        <th className="p-4">Account Number / Name</th>
                                        <th className="p-4">Status</th>
                                        <th className="p-4">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {withdrawals.map(w => (
                                        <tr key={w.id} className="hover:bg-white/[0.02]">
                                            <td className="p-4">
                                                <div className="font-bold text-white">{w.agent_name}</div>
                                                <div className="text-[10px] text-slate-400">{w.agent_email}</div>
                                            </td>
                                            <td className="p-4 font-semibold text-slate-300">{w.store_name || 'N/A'}</td>
                                            <td className="p-4 font-extrabold text-[#a3e635]">GHS {parseFloat(w.amount_ghc as any).toFixed(2)}</td>
                                            <td className="p-4 uppercase font-bold text-white">{w.payment_method} ({w.bank_momo_provider})</td>
                                            <td className="p-4">
                                                <div className="font-bold text-white">{w.account_number}</div>
                                                <div className="text-[10px] text-slate-400">{w.account_name}</div>
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                                                    w.status === 'COMPLETED' ? 'bg-[#a3e635]/20 text-[#a3e635]' :
                                                    w.status === 'REQUESTED' || w.status === 'PENDING' ? 'bg-amber-400/20 text-amber-400' :
                                                    'bg-red-400/20 text-red-400'
                                                }`}>
                                                    {w.status}
                                                </span>
                                            </td>
                                            <td className="p-4 flex items-center gap-2">
                                                {w.status !== 'COMPLETED' && (
                                                    <button
                                                        onClick={() => handleUpdateWithdrawalStatus(w.id, 'COMPLETED')}
                                                        className="px-3 py-1 bg-[#a3e635] text-black font-bold rounded-lg text-[11px]"
                                                    >
                                                        Complete
                                                    </button>
                                                )}
                                                {w.status !== 'FAILED' && (
                                                    <button
                                                        onClick={() => handleUpdateWithdrawalStatus(w.id, 'FAILED')}
                                                        className="px-3 py-1 bg-red-500/20 text-red-400 font-bold rounded-lg text-[11px] border border-red-500/30"
                                                    >
                                                        Reject & Refund
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* RULES TAB */}
            {activeTab === 'rules' && (
                <div className="bg-[#202227] p-8 rounded-3xl border border-white/5 max-w-xl shadow-2xl space-y-6">
                    <h3 className="font-bold text-white text-lg">Global Reseller Pricing & Withdrawal Bounds</h3>

                    <form onSubmit={handleSaveRules} className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-xs text-slate-300">Minimum Allowed Markup above Base Price (GHS)</label>
                            <input
                                type="number"
                                step="0.10"
                                value={minMarkup}
                                onChange={(e) => setMinMarkup(e.target.value)}
                                className="w-full px-4 py-2.5 bg-[#18191c] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-[#a3e635]"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs text-slate-300">Maximum Allowed Markup above Base Price (GHS)</label>
                            <input
                                type="number"
                                step="1.00"
                                value={maxMarkup}
                                onChange={(e) => setMaxMarkup(e.target.value)}
                                className="w-full px-4 py-2.5 bg-[#18191c] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-[#a3e635]"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs text-slate-300">Minimum Profit Withdrawal Threshold (GHS)</label>
                            <input
                                type="number"
                                step="1.00"
                                value={minWithdrawal}
                                onChange={(e) => setMinWithdrawal(e.target.value)}
                                className="w-full px-4 py-2.5 bg-[#18191c] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-[#a3e635]"
                            />
                        </div>

                        <button
                            type="submit"
                            className="w-full py-3 bg-[#a3e635] hover:bg-[#b5f73c] text-black font-bold rounded-xl text-xs transition-all shadow-md shadow-[#a3e635]/20 mt-2"
                        >
                            Save Rules & Restrictions
                        </button>
                    </form>
                </div>
            )}

            {/* REVIEW ACTION MODAL */}
            {selectedStore && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-[#202227] border border-white/10 rounded-3xl p-6 max-w-md w-full space-y-5 shadow-2xl text-white">
                        <div className="flex justify-between items-center border-b border-white/5 pb-3">
                            <h3 className="font-bold text-lg">Review Agent Store Application</h3>
                            <button onClick={() => setSelectedStore(null)} className="text-slate-400 hover:text-white text-xl">✕</button>
                        </div>

                        <form onSubmit={handleUpdateReviewStatus} className="space-y-4">
                            <div className="p-3 bg-[#18191c] rounded-xl text-xs space-y-1">
                                <p><span className="text-slate-400">Store Name:</span> <strong className="text-white">{selectedStore.store_name}</strong></p>
                                <p><span className="text-slate-400">Phone:</span> <strong className="text-white">{selectedStore.phone}</strong></p>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs text-slate-300">Select Review Action</label>
                                <select
                                    value={reviewStatus}
                                    onChange={(e) => setReviewStatus(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-[#18191c] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-[#a3e635]"
                                >
                                    <option value="APPROVED">APPROVE STORE</option>
                                    <option value="REJECTED">REJECT APPLICATION</option>
                                    <option value="CHANGES_REQUESTED">REQUEST CHANGES</option>
                                    <option value="SUSPENDED">SUSPEND STORE</option>
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs text-slate-300">Admin Note for Store Owner</label>
                                <textarea
                                    value={adminNotes}
                                    onChange={(e) => setAdminNotes(e.target.value)}
                                    placeholder="Enter review explanation or instructions..."
                                    rows={3}
                                    className="w-full px-4 py-2.5 bg-[#18191c] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-[#a3e635]"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={processingAction}
                                className="w-full py-3 bg-[#a3e635] hover:bg-[#b5f73c] text-black font-bold rounded-xl shadow-md text-sm transition-all disabled:opacity-50"
                            >
                                {processingAction ? 'Updating Status...' : 'Submit Status Update'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
