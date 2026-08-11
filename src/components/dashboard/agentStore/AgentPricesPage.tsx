import React, { useEffect, useState, useMemo } from 'react';
import { agentStoreService, AgentProduct } from '@/services/agentStore.service';
import { Tag, Save, Eye, EyeOff, Search, Trash2, Plus, X, Wifi, ArrowRight, TrendingUp } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

// ─── Add Bundle Modal ─────────────────────────────────────────────
interface AddBundleModalProps {
    open: boolean;
    onClose: () => void;
    availableBundles: AgentProduct[];
    pricingRules: { min_markup_ghc: number; max_markup_ghc: number };
    onAdd: (bundleId: string, sellingPrice: number) => Promise<void>;
}

const NETWORKS = ['MTN', 'TELECEL', 'AIRTELTIGO'] as const;

const NETWORK_COLORS: Record<string, { bg: string; border: string; text: string; glow: string }> = {
    MTN: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400', glow: 'shadow-yellow-500/10' },
    TELECEL: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', glow: 'shadow-red-500/10' },
    AIRTELTIGO: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', glow: 'shadow-blue-500/10' },
};

const AddBundleModal: React.FC<AddBundleModalProps> = ({ open, onClose, availableBundles, pricingRules, onAdd }) => {
    const [selectedNetwork, setSelectedNetwork] = useState<string>('MTN');
    const [selectedBundleId, setSelectedBundleId] = useState<string>('');
    const [sellingPrice, setSellingPrice] = useState<string>('');
    const [adding, setAdding] = useState(false);

    // Reset state when modal opens
    useEffect(() => {
        if (open) {
            setSelectedNetwork('MTN');
            setSelectedBundleId('');
            setSellingPrice('');
            setAdding(false);
        }
    }, [open]);

    const networkBundles = useMemo(() => {
        return availableBundles.filter(b => b.network === selectedNetwork);
    }, [availableBundles, selectedNetwork]);

    const selectedBundle = useMemo(() => {
        return networkBundles.find(b => b.bundle_id === selectedBundleId);
    }, [networkBundles, selectedBundleId]);

    const minSellingPrice = selectedBundle ? selectedBundle.base_price_ghc + pricingRules.min_markup_ghc : 0;
    const maxSellingPrice = selectedBundle ? selectedBundle.base_price_ghc + pricingRules.max_markup_ghc : 0;
    const priceNum = parseFloat(sellingPrice);
    const profit = selectedBundle && !isNaN(priceNum) ? Math.max(0, priceNum - selectedBundle.base_price_ghc) : 0;
    const isPriceValid = selectedBundle && !isNaN(priceNum) && priceNum >= minSellingPrice && priceNum <= maxSellingPrice;

    // Auto-set minimum selling price when bundle is selected
    useEffect(() => {
        if (selectedBundle) {
            setSellingPrice((selectedBundle.base_price_ghc + pricingRules.min_markup_ghc).toFixed(2));
        }
    }, [selectedBundleId, selectedBundle, pricingRules.min_markup_ghc]);

    // Reset selected bundle when network changes
    useEffect(() => {
        setSelectedBundleId('');
        setSellingPrice('');
    }, [selectedNetwork]);

    const handleAdd = async () => {
        if (!selectedBundleId || !isPriceValid) return;
        setAdding(true);
        try {
            await onAdd(selectedBundleId, priceNum);
            onClose();
        } catch {
            // error handled by parent
        } finally {
            setAdding(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

            {/* Modal */}
            <div className="relative w-full max-w-lg bg-[#1a1b1f] rounded-2xl border border-white/10 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-[#a3e635]/10">
                            <Plus className="w-5 h-5 text-[#a3e635]" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">Add Data Bundle</h3>
                            <p className="text-xs text-slate-400">Select a bundle to add to your store</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-5 space-y-5 max-h-[65vh] overflow-y-auto">
                    {/* Step 1: Network Selection */}
                    <div>
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">
                            Step 1 — Choose Network
                        </label>
                        <div className="flex gap-2">
                            {NETWORKS.map(net => {
                                const colors = NETWORK_COLORS[net];
                                const count = availableBundles.filter(b => b.network === net).length;
                                return (
                                    <button
                                        key={net}
                                        onClick={() => setSelectedNetwork(net)}
                                        className={`flex-1 px-3 py-2.5 rounded-xl text-xs font-bold uppercase transition-all border ${
                                            selectedNetwork === net
                                                ? `${colors.bg} ${colors.border} ${colors.text} shadow-lg ${colors.glow}`
                                                : 'bg-[#202227] border-white/5 text-slate-400 hover:text-white hover:border-white/10'
                                        }`}
                                    >
                                        <div>{net}</div>
                                        <div className="text-[10px] font-normal mt-0.5 opacity-70">{count} available</div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Step 2: Bundle Selection */}
                    <div>
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">
                            Step 2 — Select Bundle
                        </label>
                        {networkBundles.length === 0 ? (
                            <div className="p-6 text-center text-slate-500 text-sm bg-[#202227] rounded-xl border border-white/5">
                                <Wifi className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                No available bundles for {selectedNetwork}.
                                <br />
                                <span className="text-xs">All bundles may already be added to your store.</span>
                            </div>
                        ) : (
                            <div className="grid gap-2 max-h-40 overflow-y-auto pr-1">
                                {networkBundles.map(b => (
                                    <button
                                        key={b.bundle_id}
                                        onClick={() => setSelectedBundleId(b.bundle_id)}
                                        className={`flex items-center justify-between px-4 py-3 rounded-xl text-left transition-all border ${
                                            selectedBundleId === b.bundle_id
                                                ? 'bg-[#a3e635]/10 border-[#a3e635]/30 text-white'
                                                : 'bg-[#202227] border-white/5 text-slate-300 hover:border-white/10 hover:bg-[#252730]'
                                        }`}
                                    >
                                        <div>
                                            <span className="font-bold text-sm">{b.data_amount}</span>
                                        </div>
                                        <span className="text-xs text-slate-400">
                                            Base: <strong className="text-white">GHS {b.base_price_ghc.toFixed(2)}</strong>
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Step 3: Set Selling Price */}
                    {selectedBundle && (
                        <div className="space-y-3">
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">
                                Step 3 — Set Your Selling Price
                            </label>

                            {/* Price Summary Card */}
                            <div className="bg-[#202227] rounded-xl border border-white/5 p-4 space-y-3">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-slate-400">Base Cost Price:</span>
                                    <span className="font-bold text-white">GHS {selectedBundle.base_price_ghc.toFixed(2)}</span>
                                </div>

                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-400 whitespace-nowrap">Selling Price:</span>
                                    <div className="flex-1 relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-semibold">GHS</span>
                                        <input
                                            type="number"
                                            step="0.50"
                                            value={sellingPrice}
                                            onChange={(e) => setSellingPrice(e.target.value)}
                                            className={`w-full pl-12 pr-4 py-2.5 bg-[#18191c] border rounded-lg text-white font-bold text-sm focus:outline-none transition-colors ${
                                                !isNaN(priceNum) && priceNum > 0 && !isPriceValid
                                                    ? 'border-red-500 focus:border-red-400'
                                                    : 'border-white/10 focus:border-[#a3e635]'
                                            }`}
                                            placeholder={minSellingPrice.toFixed(2)}
                                        />
                                    </div>
                                </div>

                                {!isNaN(priceNum) && priceNum > 0 && !isPriceValid && (
                                    <p className="text-[11px] text-red-400">
                                        Price must be between GHS {minSellingPrice.toFixed(2)} and GHS {maxSellingPrice.toFixed(2)}
                                    </p>
                                )}

                                <div className="flex items-center justify-between pt-2 border-t border-white/5">
                                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                        <TrendingUp className="w-3.5 h-3.5 text-[#a3e635]" />
                                        Your Profit:
                                    </div>
                                    <span className={`text-lg font-extrabold ${isPriceValid ? 'text-[#a3e635]' : 'text-slate-500'}`}>
                                        +GHS {profit.toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-white/5 flex items-center gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 rounded-xl bg-[#202227] text-slate-300 text-sm font-semibold hover:bg-[#2a2b30] border border-white/5 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleAdd}
                        disabled={!selectedBundleId || !isPriceValid || adding}
                        className="flex-1 px-4 py-2.5 rounded-xl bg-[#a3e635] hover:bg-[#b5f73c] text-black text-sm font-bold shadow-lg shadow-[#a3e635]/20 flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {adding ? (
                            <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                        ) : (
                            <Plus className="w-4 h-4" />
                        )}
                        {adding ? 'Adding...' : 'Add to Store'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Main Component ───────────────────────────────────────────────
export const AgentPricesPage: React.FC = () => {
    const { toast } = useToast();
    const [products, setProducts] = useState<AgentProduct[]>([]);
    const [pricingRules, setPricingRules] = useState<{ min_markup_ghc: number; max_markup_ghc: number }>({ min_markup_ghc: 0.50, max_markup_ghc: 50.00 });
    const [selectedNetwork, setSelectedNetwork] = useState<string>('ALL');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);

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

    const handleRemoveProduct = async (bundleId: string, name: string) => {
        if (!window.confirm(`Are you sure you want to remove "${name}" from your store? This will un-link it from your storefront without deleting the global data plan.`)) {
            return;
        }
        try {
            const res = await agentStoreService.deleteProduct(bundleId);
            if (res.success) {
                toast({ title: 'Removed', description: `${name} has been removed from your store.` });
                // Mark as not added instead of filtering out entirely
                setProducts(prev => prev.map(p => p.bundle_id === bundleId ? { ...p, is_added: false } : p));
            }
        } catch (err: any) {
            toast({ title: 'Error', description: err.message || 'Failed to remove product', variant: 'destructive' });
        }
    };

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
        const addedProducts = products.filter(p => p.is_added);
        // Validate before saving
        for (const p of addedProducts) {
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
            const payload = addedProducts.map(p => ({
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

    const handleAddProduct = async (bundleId: string, sellingPrice: number) => {
        try {
            const res = await agentStoreService.addProduct({ bundle_id: bundleId, agent_price_ghc: sellingPrice, is_enabled: true });
            if (res.success) {
                toast({ title: 'Bundle Added!', description: res.message || 'Data bundle added to your store successfully.' });
                loadProducts(); // Refresh the full list
            }
        } catch (err: any) {
            toast({ title: 'Add Failed', description: err.message || 'Failed to add data bundle', variant: 'destructive' });
            throw err; // Re-throw so modal knows it failed
        }
    };

    // Only show store-linked products in the main table
    const storeProducts = useMemo(() => products.filter(p => p.is_added), [products]);
    const availableBundles = useMemo(() => products.filter(p => !p.is_added), [products]);

    const filteredProducts = storeProducts.filter(p => {
        const matchesNetwork = selectedNetwork === 'ALL' || p.network === selectedNetwork;
        const matchesSearch = p.data_amount.toLowerCase().includes(searchQuery.toLowerCase()) || p.network.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesNetwork && matchesSearch;
    });

    // Network counts for chips
    const networkCounts = useMemo(() => {
        const counts: Record<string, number> = { ALL: storeProducts.length };
        for (const p of storeProducts) {
            counts[p.network] = (counts[p.network] || 0) + 1;
        }
        return counts;
    }, [storeProducts]);

    return (
        <div className="space-y-4 sm:space-y-6 bg-[#141518] text-white p-3.5 sm:p-6 rounded-2xl sm:rounded-3xl font-sans w-full min-w-0">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 bg-[#202227] p-4 sm:p-6 rounded-2xl border border-white/5">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Tag className="w-5 h-5 text-[#a3e635]" />
                        Agent Pricing & Bundle Selection
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                        Select which data bundles to offer on your store and set your custom retail prices.
                    </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={() => setShowAddModal(true)}
                        disabled={loading || availableBundles.length === 0}
                        className="px-4 py-2.5 bg-[#202227] hover:bg-[#2a2b30] text-white font-bold rounded-xl border border-[#a3e635]/30 hover:border-[#a3e635]/60 flex items-center gap-2 text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <Plus className="w-4 h-4 text-[#a3e635]" />
                        Add Data Bundle
                    </button>
                    <button
                        onClick={handleSavePrices}
                        disabled={saving || loading || storeProducts.length === 0}
                        className="px-6 py-2.5 bg-[#a3e635] hover:bg-[#b5f73c] text-black font-bold rounded-xl shadow-lg shadow-[#a3e635]/20 flex items-center gap-2 text-sm transition-all disabled:opacity-50"
                    >
                        <Save className="w-4 h-4" />
                        {saving ? 'Saving...' : 'Save Prices'}
                    </button>
                </div>
            </div>

            {/* Rules Banner */}
            <div className="p-4 bg-[#202227] rounded-xl border border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs text-slate-400">
                <span>Minimum Markup: <strong className="text-white">GHS {pricingRules.min_markup_ghc.toFixed(2)}</strong></span>
                <span>Maximum Markup: <strong className="text-white">GHS {pricingRules.max_markup_ghc.toFixed(2)}</strong></span>
                <span className="text-[#a3e635] font-semibold">Agent Profit = Selling Price − Base Price</span>
            </div>

            {/* Stats Strip */}
            <div className="flex items-center gap-3 text-xs">
                <div className="px-3 py-1.5 bg-[#a3e635]/10 rounded-lg text-[#a3e635] font-bold border border-[#a3e635]/20">
                    {storeProducts.length} in Store
                </div>
                <div className="px-3 py-1.5 bg-slate-800 rounded-lg text-slate-400 font-semibold border border-white/5">
                    {availableBundles.length} Available to Add
                </div>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center w-full min-w-0">
                {/* Network Chips */}
                <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap pb-1.5 sm:pb-0 min-w-0 max-w-full">
                    {['ALL', 'MTN', 'TELECEL', 'AIRTELTIGO'].map(net => (
                        <button
                            key={net}
                            onClick={() => setSelectedNetwork(net)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all uppercase shrink-0 ${
                                selectedNetwork === net
                                    ? 'bg-[#a3e635] text-black shadow-md shadow-[#a3e635]/20 font-extrabold'
                                    : 'bg-[#202227] text-slate-400 hover:text-white border border-white/5'
                            }`}
                        >
                            {net} {networkCounts[net] !== undefined ? `(${networkCounts[net]})` : '(0)'}
                        </button>
                    ))}
                </div>

                {/* Search Box */}
                <div className="relative w-full sm:w-64 shrink-0 min-w-0">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 shrink-0" />
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
                    <div className="p-12 text-center">
                        <Wifi className="w-10 h-10 mx-auto mb-3 text-slate-600" />
                        <p className="text-slate-400 text-sm font-medium">
                            {storeProducts.length === 0 ? "No bundles added to your store yet." : "No bundles found matching your selection."}
                        </p>
                        {storeProducts.length === 0 && availableBundles.length > 0 && (
                            <button
                                onClick={() => setShowAddModal(true)}
                                className="mt-4 px-5 py-2.5 bg-[#a3e635]/10 hover:bg-[#a3e635]/20 text-[#a3e635] font-bold rounded-xl border border-[#a3e635]/20 text-sm inline-flex items-center gap-2 transition-all"
                            >
                                <Plus className="w-4 h-4" />
                                Add Your First Data Bundle
                            </button>
                        )}
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
                                    <th className="p-4 text-right">Actions</th>
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
                                            <td className="p-4 text-right">
                                                <button
                                                    onClick={() => handleRemoveProduct(p.bundle_id, `${p.network} ${p.data_amount}`)}
                                                    className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-[11px] font-bold inline-flex items-center gap-1 transition-all"
                                                    title="Remove product from store"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                    <span>Remove</span>
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Add Bundle Modal */}
            <AddBundleModal
                open={showAddModal}
                onClose={() => setShowAddModal(false)}
                availableBundles={availableBundles}
                pricingRules={pricingRules}
                onAdd={handleAddProduct}
            />
        </div>
    );
};
