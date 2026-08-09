import React, { useEffect, useState } from 'react';
import { agentStoreService, AgentProduct } from '@/services/agentStore.service';
import { Tag, Save, CheckCircle2, AlertCircle, RefreshCw, Eye, EyeOff, Search } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export const AgentPricesPage: React.FC = () => {
    const { toast } = useToast();
    const [products, setProducts] = useState<AgentProduct[]>([]);
    const [pricingRules, setPricingRules] = useState<{ min_markup_ghc: number; max_markup_ghc: number }>({ min_markup_ghc: 0.50, max_markup_ghc: 50.00 });
    const [selectedNetwork, setSelectedNetwork] = useState<string>('ALL');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const loadProducts = async () => {
        setLoading(true);
        try {
            const res = await agentStoreService.getProducts();
            if (res.success) {
                setProducts(res.products);
                if (res.pricingRules) setPricingRules(res.pricingRules);
            }
        } catch (err: any) {
            toast({ title: 'Error', description: err.message || 'Failed to load store products', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadProducts();
    }, []);

    const handlePriceChange = (bundleId: string, val: string) => {
        const num = parseFloat(val);
        setProducts(prev => prev.map(p => {
            if (p.bundle_id === bundleId) {
                const newPrice = isNaN(num) ? 0 : num;
                const profit = Math.max(0, newPrice - p.base_price_ghc);
                return { ...p, agent_price_ghc: newPrice, profit_ghc: profit };
            }
            return p;
        }));
    };

    const handleToggleEnabled = (bundleId: string) => {
        setProducts(prev => prev.map(p => {
            if (p.bundle_id === bundleId) {
                return { ...p, is_enabled: !p.is_enabled };
            }
            return p;
        }));
    };

    const handleSavePrices = async () => {
        // Validate before saving
        for (const p of products) {
            if (p.is_enabled) {
                if (p.agent_price_ghc < p.base_price_ghc + pricingRules.min_markup_ghc) {
                    toast({
                        title: 'Validation Error',
                        description: `${p.network} ${p.data_amount}: Selling price must be at least GHS ${(p.base_price_ghc + pricingRules.min_markup_ghc).toFixed(2)}`,
                        variant: 'destructive'
                    });
                    return;
                }
                if (p.agent_price_ghc > p.base_price_ghc + pricingRules.max_markup_ghc) {
                    toast({
                        title: 'Validation Error',
                        description: `${p.network} ${p.data_amount}: Selling price exceeds maximum markup limit.`,
                        variant: 'destructive'
                    });
                    return;
                }
            }
        }

        setSaving(true);
        try {
            const payload = products.map(p => ({
                bundle_id: p.bundle_id,
                agent_price_ghc: p.agent_price_ghc,
                is_enabled: p.is_enabled
            }));

            const res = await agentStoreService.updateProducts(payload);
            if (res.success) {
                toast({ title: 'Saved!', description: 'Agent prices and visibility updated successfully.' });
                loadProducts();
            }
        } catch (err: any) {
            toast({ title: 'Save Failed', description: err.message || 'Failed to update prices', variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    const filteredProducts = products.filter(p => {
        const matchesNetwork = selectedNetwork === 'ALL' || p.network === selectedNetwork;
        const matchesSearch = p.data_amount.toLowerCase().includes(searchQuery.toLowerCase()) || p.network.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesNetwork && matchesSearch;
    });

    return (
        <div className="space-y-6 bg-[#141518] text-white p-6 rounded-3xl font-sans">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#202227] p-6 rounded-2xl border border-white/5">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Tag className="w-5 h-5 text-[#a3e635]" />
                        SuperAgent Pricing & Bundle Selection
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                        Select which data bundles to offer on your store and set your custom retail prices.
                    </p>
                </div>
                <button
                    onClick={handleSavePrices}
                    disabled={saving || loading}
                    className="px-6 py-2.5 bg-[#a3e635] hover:bg-[#b5f73c] text-black font-bold rounded-xl shadow-lg shadow-[#a3e635]/20 flex items-center gap-2 text-sm transition-all disabled:opacity-50"
                >
                    <Save className="w-4 h-4" />
                    {saving ? 'Saving Changes...' : 'Save Prices'}
                </button>
            </div>

            {/* Rules Banner */}
            <div className="p-4 bg-[#202227] rounded-xl border border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs text-slate-400">
                <span>Minimum Markup: <strong className="text-white">GHS {pricingRules.min_markup_ghc.toFixed(2)}</strong></span>
                <span>Maximum Markup: <strong className="text-white">GHS {pricingRules.max_markup_ghc.toFixed(2)}</strong></span>
                <span className="text-[#a3e635] font-semibold">Agent Profit = Selling Price − Base Price</span>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
                {/* Network Chips */}
                <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
                    {['ALL', 'MTN', 'TELECEL', 'AIRTELTIGO'].map(net => (
                        <button
                            key={net}
                            onClick={() => setSelectedNetwork(net)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all uppercase ${
                                selectedNetwork === net
                                    ? 'bg-[#a3e635] text-black shadow-md shadow-[#a3e635]/20'
                                    : 'bg-[#202227] text-slate-400 hover:text-white border border-white/5'
                            }`}
                        >
                            {net}
                        </button>
                    ))}
                </div>

                {/* Search Box */}
                <div className="relative w-full sm:w-64">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Search bundle..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-[#202227] border border-white/5 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#a3e635]"
                    />
                </div>
            </div>

            {/* Products Table */}
            <div className="bg-[#202227] rounded-2xl border border-white/5 overflow-hidden shadow-xl">
                {loading ? (
                    <div className="space-y-0">
                        <div className="bg-[#18191c] p-4 flex gap-6">
                            {[16, 20, 24, 20, 24, 16].map((w, i) => (
                                <div key={i} className={`h-3 w-${w} bg-[#2a2b30] rounded animate-pulse`} />
                            ))}
                        </div>
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="p-4 flex gap-6 border-b border-white/5">
                                <div className="h-3 w-8 bg-[#2a2b30] rounded animate-pulse" />
                                <div className="h-3 w-16 bg-[#2a2b30] rounded animate-pulse" />
                                <div className="h-3 w-28 bg-[#2a2b30] rounded animate-pulse" />
                                <div className="h-3 w-16 bg-[#2a2b30] rounded animate-pulse" />
                                <div className="h-3 w-20 bg-[#2a2b30] rounded animate-pulse" />
                                <div className="h-3 w-16 bg-[#2a2b30] rounded animate-pulse" />
                            </div>
                        ))}
                    </div>
                ) : filteredProducts.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 text-sm">
                        No bundles found matching your selection.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-slate-300">
                            <thead className="bg-[#18191c] text-slate-400 font-semibold uppercase tracking-wider border-b border-white/5">
                                <tr>
                                    <th className="p-4">Store Status</th>
                                    <th className="p-4">Network</th>
                                    <th className="p-4">Bundle Package</th>
                                    <th className="p-4">Base Price</th>
                                    <th className="p-4">Selling Price (GHS)</th>
                                    <th className="p-4">Your Profit</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredProducts.map(p => {
                                    const profit = Math.max(0, p.agent_price_ghc - p.base_price_ghc);
                                    const minValid = p.base_price_ghc + pricingRules.min_markup_ghc;
                                    const isValid = !p.is_enabled || p.agent_price_ghc >= minValid;

                                    return (
                                        <tr key={p.bundle_id} className={`hover:bg-white/[0.02] transition-all ${!p.is_enabled ? 'opacity-50' : ''}`}>
                                            <td className="p-4">
                                                <button
                                                    onClick={() => handleToggleEnabled(p.bundle_id)}
                                                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all ${
                                                        p.is_enabled
                                                            ? 'bg-[#a3e635]/20 text-[#a3e635] border border-[#a3e635]/30'
                                                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                                                    }`}
                                                >
                                                    {p.is_enabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                                                    {p.is_enabled ? 'Active' : 'Disabled'}
                                                </button>
                                            </td>
                                            <td className="p-4 font-bold text-white uppercase">{p.network}</td>
                                            <td className="p-4 font-semibold text-white">{p.data_amount}</td>
                                            <td className="p-4 text-slate-400">GHS {(parseFloat(p.base_price_ghc as any) || 0).toFixed(2)}</td>
                                            <td className="p-4">
                                                <input
                                                    type="number"
                                                    step="0.50"
                                                    value={p.agent_price_ghc}
                                                    onChange={(e) => handlePriceChange(p.bundle_id, e.target.value)}
                                                    disabled={!p.is_enabled}
                                                    className={`w-28 px-3 py-1.5 bg-[#18191c] border rounded-lg text-white font-bold focus:outline-none ${
                                                        !isValid ? 'border-red-500' : 'border-white/10 focus:border-[#a3e635]'
                                                    }`}
                                                />
                                            </td>
                                            <td className="p-4">
                                                <span className="font-extrabold text-[#a3e635] text-sm">
                                                    +GHS {(parseFloat(profit as any) || 0).toFixed(2)}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};
