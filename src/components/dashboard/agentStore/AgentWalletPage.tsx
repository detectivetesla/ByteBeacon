import React, { useEffect, useState } from 'react';
import { agentStoreService, WalletLedgerEntry, AgentWithdrawal } from '@/services/agentStore.service';
import { Wallet, ArrowDownRight, ArrowUpRight, History, CreditCard, RefreshCw, Send, DollarSign } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface AgentWalletPageProps {
    availableBalance?: number;
    totalProfitEarned?: number;
    totalWithdrawn?: number;
    onRefresh?: () => void;
}

export const AgentWalletPage: React.FC<AgentWalletPageProps> = ({
    availableBalance: propAvailableBalance,
    totalProfitEarned: propTotalProfitEarned,
    totalWithdrawn: propTotalWithdrawn,
    onRefresh
}) => {
    const { toast } = useToast();
    const [ledger, setLedger] = useState<WalletLedgerEntry[]>([]);
    const [withdrawals, setWithdrawals] = useState<AgentWithdrawal[]>([]);
    const [loading, setLoading] = useState(true);
    const [showWithdrawModal, setShowWithdrawModal] = useState(false);

    // Internal wallet state if not passed via props
    const [wallet, setWallet] = useState<{
        available_balance: number;
        total_profit_earned: number;
        total_withdrawn: number;
    }>({
        available_balance: propAvailableBalance ?? 0,
        total_profit_earned: propTotalProfitEarned ?? 0,
        total_withdrawn: propTotalWithdrawn ?? 0,
    });

    // Form states
    const [amount, setAmount] = useState<string>('');
    const [paymentMethod, setPaymentMethod] = useState<'momo' | 'bank'>('momo');
    const [provider, setProvider] = useState<string>('mtn');
    const [accountNumber, setAccountNumber] = useState<string>('');
    const [accountName, setAccountName] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const loadFinancialData = async () => {
        setLoading(true);
        try {
            const [storeRes, txRes, wdRes] = await Promise.all([
                agentStoreService.getMyStore(),
                agentStoreService.getTransactions(),
                agentStoreService.getWithdrawalHistory()
            ]);

            if (storeRes.success && storeRes.store) {
                setWallet({
                    available_balance: parseFloat(storeRes.store.available_balance as any) || 0,
                    total_profit_earned: parseFloat(storeRes.store.total_profit_earned as any) || 0,
                    total_withdrawn: parseFloat(storeRes.store.total_withdrawn as any) || 0,
                });
            }

            if (txRes.success) setLedger(txRes.ledger || []);
            if (wdRes.success) setWithdrawals(wdRes.withdrawals || []);
        } catch (err: any) {
            toast({ title: 'Error', description: err.message || 'Failed to load financial records', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadFinancialData();
    }, []);

    const effectiveBalance = propAvailableBalance ?? wallet.available_balance;
    const effectiveProfit = propTotalProfitEarned ?? wallet.total_profit_earned;
    const effectiveWithdrawn = propTotalWithdrawn ?? wallet.total_withdrawn;

    const handleWithdrawSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const numAmount = parseFloat(amount);

        if (!numAmount || numAmount < 20) {
            toast({ title: 'Validation Error', description: 'Minimum withdrawal amount is GHS 20.00', variant: 'destructive' });
            return;
        }

        if (numAmount > effectiveBalance) {
            toast({ title: 'Insufficient Balance', description: `Your available balance is GHS ${(parseFloat(effectiveBalance as any) || 0).toFixed(2)}`, variant: 'destructive' });
            return;
        }

        if (!accountNumber || !accountName) {
            toast({ title: 'Validation Error', description: 'Account number and account name are required.', variant: 'destructive' });
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await agentStoreService.requestWithdrawal({
                amount_ghc: numAmount,
                payment_method: paymentMethod,
                account_number: accountNumber,
                account_name: accountName,
                bank_momo_provider: provider
            });

            if (res.success) {
                toast({ title: 'Withdrawal Requested!', description: 'Your payout request has been received.' });
                setShowWithdrawModal(false);
                setAmount('');
                onRefresh?.();
                loadFinancialData();
            }
        } catch (err: any) {
            toast({ title: 'Request Failed', description: err.message || 'Failed to submit withdrawal', variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-4 sm:space-y-6 bg-[#141518] text-white p-3.5 sm:p-6 rounded-2xl sm:rounded-3xl font-sans w-full min-w-0">
            {/* Header / Financial Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 w-full min-w-0">
                <div className="bg-[#202227] p-6 rounded-2xl border border-[#a3e635]/20 shadow-xl space-y-2 relative overflow-hidden">
                    <div className="flex justify-between items-center text-slate-400 text-xs">
                        <span>Available Profit</span>
                        <Wallet className="w-4 h-4 text-[#a3e635]" />
                    </div>
                    <p className="text-3xl font-extrabold text-[#a3e635]">
                        GHS {(parseFloat(effectiveBalance as any) || 0).toFixed(2)}
                    </p>
                    <button
                        onClick={() => setShowWithdrawModal(true)}
                        className="mt-3 w-full py-2 bg-[#a3e635] hover:bg-[#b5f73c] text-black font-bold rounded-xl text-xs transition-all shadow-md shadow-[#a3e635]/20 flex items-center justify-center gap-1.5"
                    >
                        <Send className="w-3.5 h-3.5" />
                        Withdraw Profit
                    </button>
                </div>

                <div className="bg-[#202227] p-6 rounded-2xl border border-white/5 shadow-xl space-y-2">
                    <div className="flex justify-between items-center text-slate-400 text-xs">
                        <span>Total Profit Earned</span>
                        <DollarSign className="w-4 h-4 text-emerald-400" />
                    </div>
                    <p className="text-3xl font-bold text-white">
                        GHS {(parseFloat(effectiveProfit as any) || 0).toFixed(2)}
                    </p>
                    <p className="text-[11px] text-slate-500 pt-2">Lifetime cumulative reseller profit</p>
                </div>

                <div className="bg-[#202227] p-6 rounded-2xl border border-white/5 shadow-xl space-y-2">
                    <div className="flex justify-between items-center text-slate-400 text-xs">
                        <span>Total Withdrawn</span>
                        <ArrowUpRight className="w-4 h-4 text-blue-400" />
                    </div>
                    <p className="text-3xl font-bold text-white">
                        GHS {(parseFloat(effectiveWithdrawn as any) || 0).toFixed(2)}
                    </p>
                    <p className="text-[11px] text-slate-500 pt-2">Successfully paid out profit</p>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Profit Ledger (2 cols) */}
                <div className="lg:col-span-2 bg-[#202227] p-6 rounded-2xl border border-white/5 space-y-4 shadow-xl">
                    <h3 className="font-bold text-white text-base flex items-center gap-2">
                        <History className="w-4 h-4 text-[#a3e635]" />
                        Financial Wallet Ledger
                    </h3>

                    {loading ? (
                        <div className="space-y-0">
                            <div className="bg-[#18191c] p-3 flex gap-4">
                                {['w-14', 'w-32', 'w-20', 'w-20', 'w-24'].map((w, i) => (
                                    <div key={i} className={`h-3 ${w} bg-[#2a2b30] rounded animate-pulse`} />
                                ))}
                            </div>
                            {Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="p-3 flex gap-4 border-b border-white/5">
                                    <div className="h-3 w-16 bg-[#2a2b30] rounded animate-pulse" />
                                    <div className="h-3 w-36 bg-[#2a2b30] rounded animate-pulse" />
                                    <div className="h-3 w-20 bg-[#2a2b30] rounded animate-pulse" />
                                    <div className="h-3 w-20 bg-[#2a2b30] rounded animate-pulse" />
                                    <div className="h-3 w-24 bg-[#2a2b30] rounded animate-pulse" />
                                </div>
                            ))}
                        </div>
                    ) : ledger.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 text-xs">No ledger entries recorded yet.</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs text-slate-300">
                                <thead className="bg-[#18191c] text-slate-400 font-semibold uppercase tracking-wider border-b border-white/5">
                                    <tr>
                                        <th className="p-3">Type</th>
                                        <th className="p-3">Description</th>
                                        <th className="p-3">Amount</th>
                                        <th className="p-3">Balance After</th>
                                        <th className="p-3">Date</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {ledger.map(entry => (
                                        <tr key={entry.id} className="hover:bg-white/[0.02]">
                                            <td className="p-3">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                    entry.type === 'SALE_PROFIT' ? 'bg-[#a3e635]/20 text-[#a3e635]' :
                                                    entry.type === 'WITHDRAWAL' ? 'bg-blue-400/20 text-blue-400' :
                                                    'bg-amber-400/20 text-amber-400'
                                                }`}>
                                                    {entry.type}
                                                </span>
                                            </td>
                                            <td className="p-3 text-white max-w-xs truncate">{entry.description}</td>
                                            <td className={`p-3 font-bold ${parseFloat(entry.amount_ghc as any) >= 0 ? 'text-[#a3e635]' : 'text-red-400'}`}>
                                                {parseFloat(entry.amount_ghc as any) >= 0 ? '+' : ''}GHS {(parseFloat(entry.amount_ghc as any) || 0).toFixed(2)}
                                            </td>
                                            <td className="p-3 font-semibold text-slate-300">GHS {(parseFloat(entry.balance_after as any) || 0).toFixed(2)}</td>
                                            <td className="p-3 text-slate-500">{new Date(entry.created_at).toLocaleDateString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Withdrawals Log (1 col) */}
                <div className="bg-[#202227] p-6 rounded-2xl border border-white/5 space-y-4 shadow-xl">
                    <h3 className="font-bold text-white text-base flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-emerald-400" />
                        Payout History
                    </h3>

                    {withdrawals.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 text-xs">No withdrawal history.</div>
                    ) : (
                        <div className="space-y-3">
                            {withdrawals.map(w => (
                                <div key={w.id} className="p-3 bg-[#18191c] rounded-xl border border-white/5 space-y-1 text-xs">
                                    <div className="flex justify-between items-center">
                                        <span className="font-bold text-white">GHS {(parseFloat(w.amount_ghc as any) || 0).toFixed(2)}</span>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                            w.status === 'COMPLETED' ? 'bg-[#a3e635] text-black' :
                                            w.status === 'REQUESTED' || w.status === 'PENDING' ? 'bg-amber-400/20 text-amber-400' :
                                            'bg-red-400/20 text-red-400'
                                        }`}>
                                            {w.status}
                                        </span>
                                    </div>
                                    <p className="text-slate-400 text-[11px]">{w.bank_momo_provider.toUpperCase()} • {w.account_number}</p>
                                    <p className="text-slate-500 text-[10px]">{new Date(w.created_at).toLocaleString()}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Withdrawal Modal */}
            {showWithdrawModal && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-[#202227] border border-white/10 rounded-3xl p-6 max-w-md w-full space-y-5 shadow-2xl text-white">
                        <div className="flex justify-between items-center border-b border-white/5 pb-3">
                            <h3 className="font-bold text-lg">Request Profit Withdrawal</h3>
                            <button onClick={() => setShowWithdrawModal(false)} className="text-slate-400 hover:text-white text-xl">✕</button>
                        </div>

                        <form onSubmit={handleWithdrawSubmit} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs text-slate-300">Amount to Withdraw (GHS)</label>
                                <input
                                    type="number"
                                    step="1"
                                    min="20"
                                    max={effectiveBalance}
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder="Min: GHS 20.00"
                                    required
                                    className="w-full px-4 py-2.5 bg-[#18191c] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-[#a3e635]"
                                />
                                <p className="text-[11px] text-slate-500">Available: GHS {(parseFloat(effectiveBalance as any) || 0).toFixed(2)}</p>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs text-slate-300">Payout Method</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => { setPaymentMethod('momo'); setProvider('mtn'); }}
                                        className={`py-2 rounded-xl text-xs font-bold ${paymentMethod === 'momo' ? 'bg-[#a3e635] text-black' : 'bg-[#18191c] text-slate-400'}`}
                                    >
                                        Mobile Money
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setPaymentMethod('bank'); setProvider('gcb'); }}
                                        className={`py-2 rounded-xl text-xs font-bold ${paymentMethod === 'bank' ? 'bg-[#a3e635] text-black' : 'bg-[#18191c] text-slate-400'}`}
                                    >
                                        Bank Account
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs text-slate-300">Provider / Bank Name</label>
                                <select
                                    value={provider}
                                    onChange={(e) => setProvider(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-[#18191c] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-[#a3e635]"
                                >
                                    {paymentMethod === 'momo' ? (
                                        <>
                                            <option value="mtn">MTN Mobile Money</option>
                                            <option value="telecel">Telecel Cash</option>
                                            <option value="airteltigo">AirtelTigo Money</option>
                                        </>
                                    ) : (
                                        <>
                                            <option value="gcb">GCB Bank</option>
                                            <option value="ecobank">Ecobank Ghana</option>
                                            <option value="fidelity">Fidelity Bank</option>
                                            <option value="absa">Absa Bank</option>
                                            <option value="stanbic">Stanbic Bank</option>
                                        </>
                                    )}
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs text-slate-300">Account Number / Phone</label>
                                <input
                                    type="text"
                                    value={accountNumber}
                                    onChange={(e) => setAccountNumber(e.target.value)}
                                    placeholder="024XXXXXXXX"
                                    required
                                    className="w-full px-4 py-2.5 bg-[#18191c] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-[#a3e635]"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs text-slate-300">Account Registered Name</label>
                                <input
                                    type="text"
                                    value={accountName}
                                    onChange={(e) => setAccountName(e.target.value)}
                                    placeholder="Account Holder Name"
                                    required
                                    className="w-full px-4 py-2.5 bg-[#18191c] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-[#a3e635]"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full py-3 bg-[#a3e635] hover:bg-[#b5f73c] text-black font-bold rounded-xl shadow-md text-sm transition-all disabled:opacity-50 mt-2"
                            >
                                {isSubmitting ? 'Submitting Request...' : 'Submit Withdrawal Request'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AgentWalletPage;
