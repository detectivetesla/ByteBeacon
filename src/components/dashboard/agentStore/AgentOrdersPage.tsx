import React, { useEffect, useState } from 'react';
import { agentStoreService, AgentOrder } from '@/services/agentStore.service';
import { ShoppingBag, Search, Filter, RefreshCw, ShieldCheck, X, CheckCircle2, Clock } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export const AgentOrdersPage: React.FC = () => {
    const { toast } = useToast();
    const [orders, setOrders] = useState<AgentOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const [networkFilter, setNetworkFilter] = useState<string>('ALL');
    const [searchQuery, setSearchQuery] = useState<string>('');

    // Modal state for tracking specific order
    const [selectedTrackOrder, setSelectedTrackOrder] = useState<AgentOrder | null>(null);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const filters: any = {};
            if (statusFilter !== 'ALL') filters.status = statusFilter;
            if (networkFilter !== 'ALL') filters.network = networkFilter;
            if (searchQuery.trim()) filters.search = searchQuery.trim();

            const res = await agentStoreService.getOrders(filters);
            if (res.success) {
                setOrders(res.orders);
            }
        } catch (err: any) {
            toast({ title: 'Error', description: err.message || 'Failed to fetch orders', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOrders();
    }, [statusFilter, networkFilter]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        fetchOrders();
    };

    return (
        <div className="space-y-4 sm:space-y-6 bg-[#141518] text-white p-3.5 sm:p-6 rounded-2xl sm:rounded-3xl font-sans w-full min-w-0">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 bg-[#202227] p-4 sm:p-6 rounded-2xl border border-white/5">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <ShoppingBag className="w-5 h-5 text-[#a3e635]" />
                        Store Sales & Customer Orders
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                        Track orders placed through your public agent storefront and trace fulfillment status.
                    </p>
                </div>
                <button
                    onClick={fetchOrders}
                    disabled={loading}
                    className="p-2.5 bg-[#18191c] hover:bg-white/5 text-slate-300 rounded-xl border border-white/10 transition-all text-xs flex items-center gap-2 font-semibold disabled:opacity-50"
                >
                    <RefreshCw className={`w-4 h-4 text-[#a3e635] ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center w-full min-w-0">
                {/* Status Chips */}
                <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap pb-1.5 sm:pb-0 min-w-0 max-w-full">
                    {['ALL', 'completed', 'processing', 'failed', 'refunded'].map(st => (
                        <button
                            key={st}
                            onClick={() => setStatusFilter(st)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all uppercase shrink-0 ${
                                statusFilter === st
                                    ? 'bg-[#a3e635] text-black shadow-md shadow-[#a3e635]/20 font-extrabold'
                                    : 'bg-[#202227] text-slate-400 hover:text-white border border-white/5'
                            }`}
                        >
                            {st}
                        </button>
                    ))}
                </div>

                {/* Search */}
                <form onSubmit={handleSearch} className="relative w-full sm:w-64 shrink-0 min-w-0">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 shrink-0" />
                    <input
                        type="text"
                        placeholder="Search phone / reference..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-[#202227] border border-white/5 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#a3e635]"
                    />
                </form>
            </div>

            {/* Orders Table */}
            <div className="bg-[#202227] rounded-2xl border border-white/5 overflow-hidden shadow-xl">
                {loading ? (
                    <div className="space-y-0">
                        <div className="bg-[#18191c] p-4 flex gap-6">
                            {Array.from({ length: 7 }).map((_, i) => (
                                <div key={i} className="h-3 w-20 bg-[#2a2b30] rounded animate-pulse" />
                            ))}
                        </div>
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="p-4 flex gap-6 border-b border-white/5">
                                <div className="h-3 w-24 bg-[#2a2b30] rounded animate-pulse" />
                                <div className="h-3 w-14 bg-[#2a2b30] rounded animate-pulse" />
                                <div className="h-3 w-28 bg-[#2a2b30] rounded animate-pulse" />
                                <div className="h-3 w-16 bg-[#2a2b30] rounded animate-pulse" />
                                <div className="h-3 w-16 bg-[#2a2b30] rounded animate-pulse" />
                                <div className="h-3 w-16 bg-[#2a2b30] rounded animate-pulse" />
                                <div className="h-3 w-16 bg-[#2a2b30] rounded animate-pulse" />
                            </div>
                        ))}
                    </div>
                ) : orders.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 text-sm">
                        No store orders found.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-slate-300">
                            <thead className="bg-[#18191c] text-slate-400 font-semibold uppercase tracking-wider border-b border-white/5">
                                <tr>
                                    <th className="p-4">Customer Phone</th>
                                    <th className="p-4">Network</th>
                                    <th className="p-4">Data Package</th>
                                    <th className="p-4">Wholesale Base</th>
                                    <th className="p-4">Selling Price</th>
                                    <th className="p-4">Your Profit</th>
                                    <th className="p-4">Status</th>
                                    <th className="p-4">Date & Time</th>
                                    <th className="p-4 text-right">Fulfillment Trace</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {orders.map(o => (
                                    <tr key={o.id} className="hover:bg-white/[0.02] transition-all">
                                        <td className="p-4 font-bold text-white">{o.customer_phone}</td>
                                        <td className="p-4 uppercase font-semibold text-slate-300">{o.network}</td>
                                        <td className="p-4 font-semibold text-white">{o.data_amount}</td>
                                        <td className="p-4 text-slate-400">GHS {parseFloat(o.base_price_ghc as any).toFixed(2)}</td>
                                        <td className="p-4 font-bold text-white">GHS {parseFloat(o.selling_price_ghc as any).toFixed(2)}</td>
                                        <td className="p-4 font-extrabold text-[#a3e635]">
                                            +GHS {parseFloat(o.profit_ghc as any).toFixed(2)}
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                                o.fulfillment_status === 'completed' ? 'bg-[#a3e635]/20 text-[#a3e635] border border-[#a3e635]/30' :
                                                o.fulfillment_status === 'processing' ? 'bg-amber-400/20 text-amber-400 border border-amber-400/30' :
                                                o.fulfillment_status === 'refunded' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                                                'bg-red-400/20 text-red-400 border border-red-400/30'
                                            }`}>
                                                {o.fulfillment_status}
                                            </span>
                                        </td>
                                        <td className="p-4 text-slate-500">{new Date(o.created_at).toLocaleString()}</td>
                                        <td className="p-4 text-right">
                                            <button
                                                onClick={() => setSelectedTrackOrder(o)}
                                                className="px-2.5 py-1 rounded-lg bg-[#18191c] text-slate-300 hover:text-[#a3e635] border border-white/10 text-[11px] font-bold inline-flex items-center gap-1 transition-all"
                                                title="View Fulfillment Trace"
                                            >
                                                <ShieldCheck className="w-3.5 h-3.5 text-[#a3e635]" />
                                                Trace
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Order Fulfillment Tracking Modal */}
            {selectedTrackOrder && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-[#202227] border border-white/10 rounded-3xl p-6 max-w-md w-full space-y-5 shadow-2xl text-white">
                        <div className="flex justify-between items-center border-b border-white/5 pb-3">
                            <h3 className="font-bold text-base flex items-center gap-2">
                                <ShieldCheck className="w-4 h-4 text-[#a3e635]" />
                                Order Fulfillment Trace
                            </h3>
                            <button onClick={() => setSelectedTrackOrder(null)} className="text-slate-400 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="bg-[#18191c] p-3.5 rounded-xl border border-white/5 space-y-2 text-xs">
                            <div className="flex justify-between">
                                <span className="text-slate-400">Recipient Phone:</span>
                                <span className="font-bold text-white">{selectedTrackOrder.customer_phone}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Data Bundle:</span>
                                <span className="font-bold text-[#a3e635] uppercase">{selectedTrackOrder.network} {selectedTrackOrder.data_amount}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Amount Paid:</span>
                                <span className="font-bold text-white">GHS {parseFloat(selectedTrackOrder.selling_price_ghc as any).toFixed(2)}</span>
                            </div>
                        </div>

                        <div className="space-y-4 pt-1">
                            <div className="flex items-center gap-3">
                                <div className="w-7 h-7 rounded-full bg-[#a3e635]/20 text-[#a3e635] flex items-center justify-center font-bold text-xs">✓</div>
                                <div>
                                    <h4 className="text-xs font-bold text-white">1. Payment Verified</h4>
                                    <p className="text-[11px] text-slate-400">Customer payment authenticated via Paystack</p>
                                </div>
                            </div>
                            <div className="w-0.5 h-5 bg-[#a3e635] ml-3.5" />

                            <div className="flex items-center gap-3">
                                <div className="w-7 h-7 rounded-full bg-[#a3e635]/20 text-[#a3e635] flex items-center justify-center font-bold text-xs">✓</div>
                                <div>
                                    <h4 className="text-xs font-bold text-white">2. ByteBeacon Server Signature</h4>
                                    <p className="text-[11px] text-slate-400">Transaction validated & logged to reseller ledger</p>
                                </div>
                            </div>
                            <div className="w-0.5 h-5 bg-[#a3e635] ml-3.5" />

                            <div className="flex items-center gap-3">
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                                    selectedTrackOrder.fulfillment_status === 'completed' ? 'bg-[#a3e635]/20 text-[#a3e635]' : 'bg-amber-400/20 text-amber-400'
                                }`}>
                                    {selectedTrackOrder.fulfillment_status === 'completed' ? '✓' : '⏳'}
                                </div>
                                <div>
                                    <h4 className="text-xs font-bold text-white">3. Telecom Provider Delivery</h4>
                                    <p className="text-[11px] text-slate-400">
                                        Status: <span className="uppercase font-bold text-[#a3e635]">{selectedTrackOrder.fulfillment_status}</span>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AgentOrdersPage;
