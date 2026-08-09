import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { agentStoreService, AgentStore, AgentOrder } from '@/services/agentStore.service';
import { AgentStoreLanding } from './AgentStoreLanding';
import { AgentPricesPage } from './AgentPricesPage';
import { StoreLinkSection } from './StoreLinkSection';
import { AgentOrdersPage } from './AgentOrdersPage';
import { AgentWalletPage } from './AgentWalletPage';
import { AgentAnalyticsPage } from './AgentAnalyticsPage';
import { AgentReportsPage } from './AgentReportsPage';
import { AgentTrackingPage } from './AgentTrackingPage';
import {
    Store, Search, Bell, Copy, Share2, DollarSign, TrendingUp, ShoppingCart,
    Wallet, Package, ShieldCheck, Tag, ArrowRight, UserCheck, ChevronRight,
    Award, BarChart3, Clock, CheckCircle2, AlertCircle, RefreshCw, FileText
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export const AgentStoreDashboard: React.FC = () => {
    const { user } = useAuth();
    const { toast } = useToast();

    const [store, setStore] = useState<AgentStore | null>(null);
    const [hasStore, setHasStore] = useState<boolean>(false);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<string>('Overview');

    // Dashboard stats
    const [stats, setStats] = useState<any>(null);

    const loadStore = async () => {
        setLoading(true);
        try {
            const res = await agentStoreService.getMyStore();
            if (res.success && res.hasStore && res.store) {
                setStore(res.store);
                setHasStore(true);

                if (res.store.effective_status === 'ACTIVE') {
                    const statsRes = await agentStoreService.getDashboardStats();
                    if (statsRes.success) {
                        setStats(statsRes);
                    }
                }
            } else {
                setHasStore(false);
            }
        } catch (err: any) {
            console.error('Error fetching store:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadStore();
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#141518] flex items-center justify-center text-[#a3e635] space-x-3 font-sans">
                <RefreshCw className="w-6 h-6 animate-spin" />
                <span className="text-sm font-bold text-white">Loading Agent Store...</span>
            </div>
        );
    }

    // If no store or inactive store status
    if (!hasStore || !store || store.effective_status !== 'ACTIVE') {
        return <AgentStoreLanding existingStore={store} onStoreCreated={loadStore} />;
    }

    const availableBalance = parseFloat(store.available_balance as any || 0);
    const totalProfitEarned = parseFloat(store.total_profit_earned as any || 0);
    const totalWithdrawn = parseFloat(store.total_withdrawn as any || 0);

    return (
        <div className="min-h-screen bg-[#141518] text-white p-4 sm:p-6 space-y-6 font-sans">
            {/* 1. TOP HEADER BAR */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-[#202227] p-4 rounded-2xl border border-white/5 shadow-xl">
                {/* Search Box */}
                <div className="relative w-full md:w-80">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Search products, orders..."
                        className="w-full pl-10 pr-4 py-2 bg-[#18191c] border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#a3e635]"
                    />
                </div>

                {/* Header Controls & Profile */}
                <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                    {/* Role Chips */}
                    <span className="px-3 py-1 bg-[#18191c] border border-white/10 rounded-lg text-xs font-semibold text-slate-300">
                        Reseller SuperAgent
                    </span>
                    <span className="px-3 py-1 bg-[#a3e635]/20 text-[#a3e635] border border-[#a3e635]/30 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#a3e635] animate-pulse" />
                        Store Active
                    </span>

                    {/* Store Link Button */}
                    <a
                        href={`/store/${store.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-4 py-2 bg-[#a3e635] hover:bg-[#b5f73c] text-black font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md shadow-[#a3e635]/20"
                    >
                        + Storefront Link
                    </a>

                    {/* Notification Bell */}
                    <button className="p-2 rounded-xl bg-[#18191c] text-slate-400 hover:text-white border border-white/10 relative transition-all">
                        <Bell className="w-4 h-4" />
                        <span className="w-2 h-2 rounded-full bg-[#a3e635] absolute top-1.5 right-1.5" />
                    </button>

                    {/* User Avatar */}
                    <div className="w-9 h-9 rounded-xl bg-[#a3e635]/20 text-[#a3e635] font-bold text-xs flex items-center justify-center border border-[#a3e635]/30">
                        {user?.name?.slice(0, 2).toUpperCase() || 'AG'}
                    </div>
                </div>
            </div>

            {/* 2. DASHBOARD GREETING & STORE LINK BANNER */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-extrabold text-white tracking-tight">
                            Hello, {user?.name || 'Partner'} Welcome back!
                        </h1>
                        <span className="px-2.5 py-0.5 rounded-md bg-[#202227] text-[11px] font-bold text-[#a3e635] border border-[#a3e635]/20">
                            {store.store_name}
                        </span>
                    </div>
                    <p className="text-xs text-slate-400">Manage your product pricing, view orders, and withdraw profit.</p>
                </div>
            </div>

            {/* 3. FEATURED PRODUCTS & NETWORKS CAROUSEL */}
            <div className="space-y-3">
                <div className="flex justify-between items-center text-xs">
                    <h3 className="font-bold text-white uppercase tracking-wider text-[11px] text-slate-400">Featured Network Products</h3>
                    <span className="text-[#a3e635] hover:underline cursor-pointer font-semibold" onClick={() => setActiveTab('Pricing')}>View All Packages →</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                    {/* MTN 1GB */}
                    <div className="bg-gradient-to-br from-yellow-500/20 to-amber-600/30 p-4 rounded-2xl border border-yellow-500/30 space-y-2 flex flex-col justify-between group hover:scale-[1.02] transition-all">
                        <div className="flex justify-between items-start">
                            <span className="px-2 py-0.5 rounded bg-yellow-400 text-black font-extrabold text-[10px]">MTN</span>
                            <span className="text-[10px] text-slate-300 font-mono">1.0 GB</span>
                        </div>
                        <div>
                            <p className="text-lg font-black text-white">MTN 1GB</p>
                            <p className="text-xs text-yellow-300 font-bold">Fast Data</p>
                        </div>
                    </div>

                    {/* MTN 2GB */}
                    <div className="bg-gradient-to-br from-amber-500/20 to-yellow-600/30 p-4 rounded-2xl border border-yellow-500/30 space-y-2 flex flex-col justify-between group hover:scale-[1.02] transition-all">
                        <div className="flex justify-between items-start">
                            <span className="px-2 py-0.5 rounded bg-yellow-400 text-black font-extrabold text-[10px]">MTN</span>
                            <span className="text-[10px] text-slate-300 font-mono">2.0 GB</span>
                        </div>
                        <div>
                            <p className="text-lg font-black text-white">MTN 2GB</p>
                            <p className="text-xs text-yellow-300 font-bold">Popular Choice</p>
                        </div>
                    </div>

                    {/* Telecel 5GB */}
                    <div className="bg-gradient-to-br from-red-500/20 to-rose-600/30 p-4 rounded-2xl border border-red-500/30 space-y-2 flex flex-col justify-between group hover:scale-[1.02] transition-all">
                        <div className="flex justify-between items-start">
                            <span className="px-2 py-0.5 rounded bg-red-500 text-white font-extrabold text-[10px]">Telecel</span>
                            <span className="text-[10px] text-slate-300 font-mono">5.0 GB</span>
                        </div>
                        <div>
                            <p className="text-lg font-black text-white">Telecel 5GB</p>
                            <p className="text-xs text-red-300 font-bold">Best Value</p>
                        </div>
                    </div>

                    {/* AirtelTigo 10GB */}
                    <div className="bg-gradient-to-br from-blue-500/20 to-indigo-600/30 p-4 rounded-2xl border border-blue-500/30 space-y-2 flex flex-col justify-between group hover:scale-[1.02] transition-all">
                        <div className="flex justify-between items-start">
                            <span className="px-2 py-0.5 rounded bg-blue-500 text-white font-extrabold text-[10px]">AirtelTigo</span>
                            <span className="text-[10px] text-slate-300 font-mono">10 GB</span>
                        </div>
                        <div>
                            <p className="text-lg font-black text-white">AT 10GB</p>
                            <p className="text-xs text-blue-300 font-bold">Super Saver</p>
                        </div>
                    </div>

                    {/* MTN 5GB */}
                    <div className="bg-gradient-to-br from-emerald-500/20 to-teal-600/30 p-4 rounded-2xl border border-emerald-500/30 space-y-2 flex flex-col justify-between group hover:scale-[1.02] transition-all">
                        <div className="flex justify-between items-start">
                            <span className="px-2 py-0.5 rounded bg-emerald-400 text-black font-extrabold text-[10px]">MTN</span>
                            <span className="text-[10px] text-slate-300 font-mono">5.0 GB</span>
                        </div>
                        <div>
                            <p className="text-lg font-black text-white">MTN 5GB</p>
                            <p className="text-xs text-emerald-300 font-bold">Top Selling</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* 4. SUB NAVIGATION TABS */}
            <div className="flex items-center gap-2 border-b border-white/5 pb-2 overflow-x-auto">
                {[
                    { id: 'Overview', label: 'Overview', icon: BarChart3 },
                    { id: 'Pricing', label: 'Agent Prices', icon: Tag },
                    { id: 'Orders', label: 'Orders', icon: ShoppingCart },
                    { id: 'Wallet', label: 'Wallet & Profit', icon: Wallet },
                    { id: 'Analytics', label: 'Analytics', icon: TrendingUp },
                    { id: 'Reports', label: 'Reports', icon: FileText },
                    { id: 'Tracking', label: 'Tracking', icon: ShieldCheck },
                ].map(tab => {
                    const IconComp = tab.icon;
                    const isActive = activeTab === tab.id;

                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                                isActive
                                    ? 'bg-[#a3e635] text-black shadow-md shadow-[#a3e635]/20 font-extrabold'
                                    : 'bg-[#202227] text-slate-400 hover:text-white border border-white/5'
                            }`}
                        >
                            <IconComp className="w-3.5 h-3.5" />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* 5. TAB CONTENT DISPLAY */}
            {activeTab === 'Overview' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column (2/3 width): Key Metrics & Recent Activity */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Financial Metrics Row */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="bg-[#202227] p-5 rounded-2xl border border-white/5 space-y-1 shadow-lg">
                                <span className="text-slate-400 text-xs font-medium">Total Sales</span>
                                <p className="text-2xl font-black text-white">
                                    GHS {stats?.financials?.total_sales_ghc ? stats.financials.total_sales_ghc.toFixed(2) : '0.00'}
                                </p>
                                <span className="text-[10px] text-slate-500">Gross revenue through store</span>
                            </div>

                            <div className="bg-[#202227] p-5 rounded-2xl border border-[#a3e635]/20 shadow-lg space-y-1">
                                <span className="text-slate-400 text-xs font-medium">Total Profit Earned</span>
                                <p className="text-2xl font-black text-[#a3e635]">
                                    GHS {totalProfitEarned.toFixed(2)}
                                </p>
                                <span className="text-[10px] text-[#a3e635]/80">Net reseller profit</span>
                            </div>

                            <div className="bg-[#202227] p-5 rounded-2xl border border-white/5 space-y-1 shadow-lg">
                                <span className="text-slate-400 text-xs font-medium">Available Balance</span>
                                <p className="text-2xl font-black text-white">
                                    GHS {availableBalance.toFixed(2)}
                                </p>
                                <span className="text-[10px] text-slate-500">Ready for withdrawal</span>
                            </div>
                        </div>

                        {/* Store Link Widget */}
                        <StoreLinkSection storeName={store.store_name} slug={store.slug} />

                        {/* Recent Store Orders Table */}
                        <div className="bg-[#202227] p-6 rounded-2xl border border-white/5 space-y-4 shadow-xl">
                            <div className="flex justify-between items-center">
                                <h3 className="font-bold text-white text-base">Recent Customer Orders</h3>
                                <button
                                    onClick={() => setActiveTab('Orders')}
                                    className="text-xs text-[#a3e635] font-bold hover:underline"
                                >
                                    View All Orders →
                                </button>
                            </div>

                            {stats?.recentOrders?.length === 0 ? (
                                <div className="p-8 text-center text-slate-500 text-xs">No orders recorded yet.</div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs text-slate-300">
                                        <thead className="bg-[#18191c] text-slate-400 font-semibold uppercase tracking-wider border-b border-white/5">
                                            <tr>
                                                <th className="p-3">Phone</th>
                                                <th className="p-3">Package</th>
                                                <th className="p-3">Price</th>
                                                <th className="p-3">Profit</th>
                                                <th className="p-3">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {stats?.recentOrders?.map((o: AgentOrder) => (
                                                <tr key={o.id} className="hover:bg-white/[0.02]">
                                                    <td className="p-3 font-bold text-white">{o.customer_phone}</td>
                                                    <td className="p-3 font-semibold text-white uppercase">{o.network} {o.data_amount}</td>
                                                    <td className="p-3">GHS {parseFloat(o.selling_price_ghc as any).toFixed(2)}</td>
                                                    <td className="p-3 font-bold text-[#a3e635]">+GHS {parseFloat(o.profit_ghc as any).toFixed(2)}</td>
                                                    <td className="p-3">
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                                            o.fulfillment_status === 'completed' ? 'bg-[#a3e635]/20 text-[#a3e635]' : 'bg-amber-400/20 text-amber-400'
                                                        }`}>
                                                            {o.fulfillment_status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column (1/3 width): Side Feed & Quick Actions */}
                    <div className="space-y-6">
                        {/* Quick Earnings Box */}
                        <div className="bg-gradient-to-br from-[#202227] to-[#26282e] p-6 rounded-2xl border border-[#a3e635]/20 space-y-4 shadow-xl">
                            <h3 className="font-bold text-white text-base">Quick Profit Summary</h3>
                            <div className="space-y-2 text-xs">
                                <div className="flex justify-between py-1 border-b border-white/5">
                                    <span className="text-slate-400">Available Profit:</span>
                                    <span className="font-bold text-[#a3e635]">GHS {availableBalance.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between py-1 border-b border-white/5">
                                    <span className="text-slate-400">Total Withdrawn:</span>
                                    <span className="font-bold text-white">GHS {totalWithdrawn.toFixed(2)}</span>
                                </div>
                            </div>
                            <button
                                onClick={() => setActiveTab('Wallet')}
                                className="w-full py-2.5 bg-[#a3e635] hover:bg-[#b5f73c] text-black font-bold rounded-xl text-xs transition-all shadow-md shadow-[#a3e635]/20"
                            >
                                Withdraw to MoMo / Bank
                            </button>
                        </div>

                        {/* Top Insights */}
                        <div className="bg-[#202227] p-6 rounded-2xl border border-white/5 space-y-4 shadow-xl">
                            <h3 className="font-bold text-white text-base">Performance Insights</h3>
                            <div className="space-y-3 text-xs">
                                <div className="p-3 bg-[#18191c] rounded-xl border border-white/5 space-y-1">
                                    <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Top Performing Network</span>
                                    <p className="font-extrabold text-white text-sm uppercase">{stats?.insights?.best_network || 'MTN'}</p>
                                </div>
                                <div className="p-3 bg-[#18191c] rounded-xl border border-white/5 space-y-1">
                                    <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Best-Selling Data Bundle</span>
                                    <p className="font-extrabold text-[#a3e635] text-sm uppercase">{stats?.insights?.best_product || 'MTN 2GB'}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'Pricing' && <AgentPricesPage />}
            {activeTab === 'Orders' && <AgentOrdersPage />}
            {activeTab === 'Wallet' && (
                <AgentWalletPage
                    availableBalance={availableBalance}
                    totalProfitEarned={totalProfitEarned}
                    totalWithdrawn={totalWithdrawn}
                    onRefresh={loadStore}
                />
            )}
            {activeTab === 'Analytics' && <AgentAnalyticsPage />}
            {activeTab === 'Reports' && <AgentReportsPage />}
            {activeTab === 'Tracking' && <AgentTrackingPage />}
        </div>
    );
};
