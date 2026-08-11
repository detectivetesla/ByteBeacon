import React, { useEffect, useState } from 'react';
import { agentStoreService } from '@/services/agentStore.service';
import { Users, Search, ShoppingBag, DollarSign, RefreshCw, Calendar } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface CustomerItem {
    customer_phone: string;
    total_orders: number;
    total_spent_ghc: number;
    last_purchase_at: string;
}

export const AgentCustomersPage: React.FC = () => {
    const { toast } = useToast();
    const [customers, setCustomers] = useState<CustomerItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchCustomers = async () => {
        setLoading(true);
        try {
            const res = await agentStoreService.getCustomers();
            if (res.success) {
                setCustomers(res.customers || []);
            }
        } catch (err: any) {
            toast({ title: 'Error', description: err.message || 'Failed to load customers', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCustomers();
    }, []);

    const filteredCustomers = customers.filter(c =>
        c.customer_phone.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-4 sm:space-y-6 bg-[#141518] text-white p-3.5 sm:p-6 rounded-2xl sm:rounded-3xl font-sans w-full min-w-0">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 bg-[#202227] p-4 sm:p-6 rounded-2xl border border-white/5">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Users className="w-5 h-5 text-[#a3e635]" />
                        Store Customers
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                        Track customer repeat purchases and total spend across your storefront.
                    </p>
                </div>
                <button
                    onClick={fetchCustomers}
                    disabled={loading}
                    className="px-3.5 py-2 bg-[#18191c] hover:bg-white/5 text-slate-300 rounded-xl border border-white/10 transition-all text-xs flex items-center gap-2 font-semibold disabled:opacity-50"
                >
                    <RefreshCw className={`w-3.5 h-3.5 text-[#a3e635] ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            {/* Search Bar */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
                <div className="relative w-full sm:w-72">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Search phone number..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-[#202227] border border-white/5 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#a3e635]"
                    />
                </div>
                <div className="text-xs text-slate-400 self-end sm:self-center font-medium">
                    Total Customers: <span className="font-bold text-white">{customers.length}</span>
                </div>
            </div>

            {/* Customers Table */}
            <div className="bg-[#202227] rounded-2xl border border-white/5 overflow-hidden shadow-xl">
                {loading ? (
                    <div className="space-y-0">
                        <div className="bg-[#18191c] p-4 flex gap-6">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="h-3 w-28 bg-[#2a2b30] rounded animate-pulse" />
                            ))}
                        </div>
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="p-4 flex gap-6 border-b border-white/5">
                                <div className="h-3 w-32 bg-[#2a2b30] rounded animate-pulse" />
                                <div className="h-3 w-20 bg-[#2a2b30] rounded animate-pulse" />
                                <div className="h-3 w-24 bg-[#2a2b30] rounded animate-pulse" />
                                <div className="h-3 w-36 bg-[#2a2b30] rounded animate-pulse" />
                            </div>
                        ))}
                    </div>
                ) : filteredCustomers.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 text-xs">
                        No customers recorded yet. Customers who buy bundles on your storefront will appear here.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-slate-300">
                            <thead className="bg-[#18191c] text-slate-400 font-semibold uppercase tracking-wider border-b border-white/5">
                                <tr>
                                    <th className="p-4">Customer Phone</th>
                                    <th className="p-4">Orders Completed</th>
                                    <th className="p-4">Total Amount Spent</th>
                                    <th className="p-4">Last Purchase Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredCustomers.map((c, i) => (
                                    <tr key={i} className="hover:bg-white/[0.02] transition-all">
                                        <td className="p-4 font-bold text-white flex items-center gap-2">
                                            <div className="w-7 h-7 rounded-lg bg-[#a3e635]/10 text-[#a3e635] flex items-center justify-center font-mono text-[11px]">
                                                📱
                                            </div>
                                            {c.customer_phone}
                                        </td>
                                        <td className="p-4">
                                            <span className="px-2.5 py-1 rounded-md bg-[#18191c] text-white font-bold border border-white/10">
                                                {c.total_orders} {c.total_orders === 1 ? 'order' : 'orders'}
                                            </span>
                                        </td>
                                        <td className="p-4 font-extrabold text-[#a3e635]">
                                            GHS {(parseFloat(c.total_spent_ghc as any) || 0).toFixed(2)}
                                        </td>
                                        <td className="p-4 text-slate-400 font-medium">
                                            {c.last_purchase_at ? new Date(c.last_purchase_at).toLocaleString() : 'N/A'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AgentCustomersPage;
