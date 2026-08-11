import React, { useEffect, useState } from 'react';
import { agentStoreService } from '@/services/agentStore.service';
import { BarChart3, TrendingUp, RefreshCw, Award, Activity, Download, FileSpreadsheet } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export const AgentAnalyticsPage: React.FC = () => {
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState<string | null>(null);
    const [dailyStats, setDailyStats] = useState<{ date: string; orders: number; sales: number; profit: number }[]>([]);
    const [networkShare, setNetworkShare] = useState<{ network: string; count: number; total_profit: number }[]>([]);

    const loadAnalytics = async () => {
        setLoading(true);
        try {
            const res = await agentStoreService.getAnalytics();
            if (res.success) {
                setDailyStats(res.dailyStats || []);
                setNetworkShare(res.networkShare || []);
            }
        } catch (err: any) {
            toast({ title: 'Error', description: err.message || 'Failed to load analytics', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAnalytics();
    }, []);

    const downloadCSV = (filename: string, rows: object[]) => {
        if (!rows || rows.length === 0) {
            toast({ title: 'No Data', description: 'No records available to export.', variant: 'destructive' });
            return;
        }

        const headers = Object.keys(rows[0]).join(',');
        const csvContent = [
            headers,
            ...rows.map(r => Object.values(r).map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleExportOrders = async () => {
        setExporting('orders');
        try {
            const res = await agentStoreService.getOrders();
            if (res.success && res.orders) {
                downloadCSV('agent_store_orders', res.orders);
                toast({ title: 'Export Complete', description: 'Orders CSV downloaded.' });
            }
        } catch (err: any) {
            toast({ title: 'Export Failed', description: err.message, variant: 'destructive' });
        } finally {
            setExporting(null);
        }
    };

    const handleExportLedger = async () => {
        setExporting('ledger');
        try {
            const res = await agentStoreService.getTransactions();
            if (res.success && res.ledger) {
                downloadCSV('agent_wallet_ledger', res.ledger);
                toast({ title: 'Export Complete', description: 'Wallet Ledger CSV downloaded.' });
            }
        } catch (err: any) {
            toast({ title: 'Export Failed', description: err.message, variant: 'destructive' });
        } finally {
            setExporting(null);
        }
    };

    const handleExportWithdrawals = async () => {
        setExporting('withdrawals');
        try {
            const res = await agentStoreService.getWithdrawalHistory();
            if (res.success && res.withdrawals) {
                downloadCSV('agent_withdrawals', res.withdrawals);
                toast({ title: 'Export Complete', description: 'Withdrawals CSV downloaded.' });
            }
        } catch (err: any) {
            toast({ title: 'Export Failed', description: err.message, variant: 'destructive' });
        } finally {
            setExporting(null);
        }
    };

    const maxProfit = Math.max(...dailyStats.map(d => parseFloat(d.profit as any) || 0), 1);

    return (
        <div className="space-y-4 sm:space-y-6 bg-[#141518] text-white p-3.5 sm:p-6 rounded-2xl sm:rounded-3xl font-sans w-full min-w-0">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 bg-[#202227] p-4 sm:p-6 rounded-2xl border border-white/5">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-[#a3e635]" />
                        Store Performance & Analytics
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                        Sales trend overview, profit distribution, and one-click financial report exports.
                    </p>
                </div>
                <button
                    onClick={loadAnalytics}
                    disabled={loading}
                    className="px-3.5 py-2 bg-[#18191c] hover:bg-white/5 text-slate-300 rounded-xl border border-white/10 text-xs flex items-center gap-2 font-semibold disabled:opacity-50"
                >
                    <RefreshCw className={`w-3.5 h-3.5 text-[#a3e635] ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            {/* One-Click CSV Reports Bar */}
            <div className="bg-[#202227] p-4 sm:p-5 rounded-2xl border border-white/5 space-y-3 shadow-xl">
                <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider">
                    <FileSpreadsheet className="w-4 h-4 text-[#a3e635]" />
                    Export Financial CSV Reports
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <button
                        onClick={handleExportOrders}
                        disabled={exporting === 'orders'}
                        className="py-2.5 px-4 bg-[#18191c] hover:bg-white/5 text-white font-bold rounded-xl text-xs border border-white/10 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                    >
                        {exporting === 'orders' ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#a3e635]" /> : <Download className="w-3.5 h-3.5 text-[#a3e635]" />}
                        Export Orders CSV
                    </button>

                    <button
                        onClick={handleExportLedger}
                        disabled={exporting === 'ledger'}
                        className="py-2.5 px-4 bg-[#18191c] hover:bg-white/5 text-white font-bold rounded-xl text-xs border border-white/10 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                    >
                        {exporting === 'ledger' ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#a3e635]" /> : <Download className="w-3.5 h-3.5 text-[#a3e635]" />}
                        Export Ledger CSV
                    </button>

                    <button
                        onClick={handleExportWithdrawals}
                        disabled={exporting === 'withdrawals'}
                        className="py-2.5 px-4 bg-[#18191c] hover:bg-white/5 text-white font-bold rounded-xl text-xs border border-white/10 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                    >
                        {exporting === 'withdrawals' ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#a3e635]" /> : <Download className="w-3.5 h-3.5 text-[#a3e635]" />}
                        Export Payouts CSV
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Chart Skeleton */}
                    <div className="lg:col-span-2 bg-[#202227] p-6 rounded-2xl border border-white/5 space-y-4 animate-pulse">
                        <div className="h-4 w-48 bg-[#2a2b30] rounded" />
                        <div className="h-64 flex items-end gap-3 pt-8 pb-2 px-2">
                            {Array.from({ length: 10 }).map((_, i) => (
                                <div key={i} className="flex-1 bg-[#2a2b30] rounded-t-lg" style={{ height: `${20 + Math.random() * 70}%` }} />
                            ))}
                        </div>
                    </div>
                    {/* Network Skeleton */}
                    <div className="bg-[#202227] p-6 rounded-2xl border border-white/5 space-y-4 animate-pulse">
                        <div className="h-4 w-36 bg-[#2a2b30] rounded" />
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="p-3 bg-[#18191c] rounded-xl border border-white/5 space-y-2">
                                <div className="flex justify-between">
                                    <div className="h-3 w-16 bg-[#2a2b30] rounded" />
                                    <div className="h-3 w-20 bg-[#2a2b30] rounded" />
                                </div>
                                <div className="flex justify-between">
                                    <div className="h-3 w-24 bg-[#2a2b30] rounded" />
                                    <div className="h-3 w-8 bg-[#2a2b30] rounded" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Profit Bar Chart (2 cols) */}
                    <div className="lg:col-span-2 bg-[#202227] p-6 rounded-2xl border border-white/5 space-y-4 shadow-xl">
                        <h3 className="font-bold text-white text-base flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-[#a3e635]" />
                            Daily Profit Trend (Last 14 Days)
                        </h3>

                        {dailyStats.length === 0 ? (
                            <div className="p-12 text-center text-slate-500 text-xs">No daily sales data available yet.</div>
                        ) : (
                            <div className="h-64 flex items-end gap-3 pt-8 pb-2 px-2">
                                {dailyStats.map((d, i) => {
                                    const profitVal = parseFloat(d.profit as any) || 0;
                                    const heightPct = Math.round((profitVal / maxProfit) * 100);

                                    return (
                                        <div key={i} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                                            <div className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-[#a3e635] font-bold">
                                                GHS {profitVal.toFixed(1)}
                                            </div>
                                            <div
                                                style={{ height: `${Math.max(8, heightPct)}%` }}
                                                className="w-full bg-[#a3e635] hover:bg-[#b5f73c] rounded-t-lg transition-all shadow-md shadow-[#a3e635]/20"
                                            />
                                            <span className="text-[10px] text-slate-500 truncate w-full text-center">
                                                {new Date(d.date).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Network Share Breakdown (1 col) */}
                    <div className="bg-[#202227] p-6 rounded-2xl border border-white/5 space-y-4 shadow-xl">
                        <h3 className="font-bold text-white text-base flex items-center gap-2">
                            <Award className="w-4 h-4 text-emerald-400" />
                            Profit by Network
                        </h3>

                        {networkShare.length === 0 ? (
                            <div className="p-8 text-center text-slate-500 text-xs">No network sales yet.</div>
                        ) : (
                            <div className="space-y-4 pt-2">
                                {networkShare.map((ns, idx) => (
                                    <div key={idx} className="space-y-1.5 p-3 bg-[#18191c] rounded-xl border border-white/5">
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="font-bold text-white uppercase">{ns.network}</span>
                                            <span className="font-extrabold text-[#a3e635]">GHS {parseFloat(ns.total_profit as any).toFixed(2)}</span>
                                        </div>
                                        <div className="text-[11px] text-slate-400 flex justify-between">
                                            <span>Orders completed:</span>
                                            <span className="text-white font-semibold">{ns.count}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AgentAnalyticsPage;
