import React, { useState } from 'react';
import { agentStoreService } from '@/services/agentStore.service';
import { Download, FileSpreadsheet, RefreshCw } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export const AgentReportsPage: React.FC = () => {
    const { toast } = useToast();
    const [exporting, setExporting] = useState<string | null>(null);

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

    return (
        <div className="space-y-4 sm:space-y-6 bg-[#141518] text-white p-3.5 sm:p-6 rounded-2xl sm:rounded-3xl font-sans w-full min-w-0">
            {/* Header */}
            <div className="bg-[#202227] p-4 sm:p-6 rounded-2xl border border-white/5">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-[#a3e635]" />
                    Exportable Financial & Sales Reports
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                    Download complete audit-ready CSV records for your accounting and taxation.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Orders Report */}
                <div className="bg-[#202227] p-6 rounded-2xl border border-white/5 space-y-4 shadow-xl flex flex-col justify-between">
                    <div className="space-y-2">
                        <h3 className="font-bold text-white text-base">Sales Orders Report</h3>
                        <p className="text-xs text-slate-400">
                            Includes customer phone numbers, package amounts, sale prices, and profit per order.
                        </p>
                    </div>
                    <button
                        onClick={handleExportOrders}
                        disabled={exporting === 'orders'}
                        className="w-full py-2.5 bg-[#a3e635] hover:bg-[#b5f73c] text-black font-bold rounded-xl text-xs transition-all shadow-md shadow-[#a3e635]/20 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {exporting === 'orders' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        Export Orders CSV
                    </button>
                </div>

                {/* Ledger Report */}
                <div className="bg-[#202227] p-6 rounded-2xl border border-white/5 space-y-4 shadow-xl flex flex-col justify-between">
                    <div className="space-y-2">
                        <h3 className="font-bold text-white text-base">Profit Ledger Report</h3>
                        <p className="text-xs text-slate-400">
                            Complete immutable financial ledger log showing all profit credits, refunds, and withdrawals.
                        </p>
                    </div>
                    <button
                        onClick={handleExportLedger}
                        disabled={exporting === 'ledger'}
                        className="w-full py-2.5 bg-[#a3e635] hover:bg-[#b5f73c] text-black font-bold rounded-xl text-xs transition-all shadow-md shadow-[#a3e635]/20 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {exporting === 'ledger' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        Export Ledger CSV
                    </button>
                </div>

                {/* Withdrawals Report */}
                <div className="bg-[#202227] p-6 rounded-2xl border border-white/5 space-y-4 shadow-xl flex flex-col justify-between">
                    <div className="space-y-2">
                        <h3 className="font-bold text-white text-base">Withdrawal Payouts Report</h3>
                        <p className="text-xs text-slate-400">
                            List of all MoMo and Bank payout requests, account details, and fulfillment statuses.
                        </p>
                    </div>
                    <button
                        onClick={handleExportWithdrawals}
                        disabled={exporting === 'withdrawals'}
                        className="w-full py-2.5 bg-[#a3e635] hover:bg-[#b5f73c] text-black font-bold rounded-xl text-xs transition-all shadow-md shadow-[#a3e635]/20 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {exporting === 'withdrawals' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        Export Payouts CSV
                    </button>
                </div>
            </div>
        </div>
    );
};
