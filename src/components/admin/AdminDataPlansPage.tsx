import { useState, useEffect, useCallback } from 'react';
import { adminService, bundleService } from '@/services';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Database,
    Search,
    Plus,
    Edit,
    Trash2,
    Loader2,
    Wifi
} from 'lucide-react';
import { cn, parseDataAmount } from '@/lib/utils';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';

interface DataBundle {
    id: string;
    network: string;
    data_amount: string;
    price_ghc: number;
    agent_price_ghc: number;
    validity_days: number;
    is_active: boolean;
    provider_slug?: string | null;
}

export default function AdminDataPlansPage() {
    const { toast } = useToast();
    const [bundles, setBundles] = useState<DataBundle[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [networkFilter, setNetworkFilter] = useState<string>('all');

    const [showModal, setShowModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [editingBundle, setEditingBundle] = useState<DataBundle | null>(null);
    const [actionLoading, setActionLoading] = useState(false);

    const [form, setForm] = useState({
        network: 'MTN',
        data_amount: '',
        price_ghc: '',
        agent_price_ghc: '',
        validity_days: '30',
        is_active: true,
        provider_slug: 'default'
    });

    const fetchBundles = useCallback(async () => {
        setLoading(true);
        try {
            const data = await adminService.getAllBundles();
            const bundlesFormatted = data.map(b => ({
                id: b.id,
                network: b.network,
                data_amount: b.dataAmount,
                price_ghc: b.priceGhc,
                agent_price_ghc: b.agentPriceGhc,
                validity_days: (b as any).validityDays || 30,
                is_active: b.isActive,
                provider_slug: (b as any).providerSlug || null,
            }));
            setBundles(bundlesFormatted as DataBundle[]);
        } catch (err) {
            console.error('Error fetching bundles:', err);
            toast({ title: 'Error', description: 'Failed to fetch data plans', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchBundles();
    }, [fetchBundles]);

    const filteredBundles = bundles
        .filter(bundle => {
            const matchesSearch = bundle.data_amount.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesNetwork = networkFilter === 'all' || bundle.network.toUpperCase() === networkFilter.toUpperCase();
            return matchesSearch && matchesNetwork;
        })
        .sort((a, b) => {
            // Sort by network first
            if (a.network !== b.network) {
                return a.network.localeCompare(b.network);
            }
            // Then sort by data size numerically
            return parseDataAmount(a.data_amount) - parseDataAmount(b.data_amount);
        });

    const openCreateModal = () => {
        setEditingBundle(null);
        setForm({ network: 'MTN', data_amount: '', price_ghc: '', agent_price_ghc: '', validity_days: '30', is_active: true, provider_slug: 'default' });
        setShowModal(true);
    };

    const openEditModal = (bundle: DataBundle) => {
        setEditingBundle(bundle);
        setForm({
            network: bundle.network,
            data_amount: bundle.data_amount,
            price_ghc: bundle.price_ghc.toString(),
            agent_price_ghc: (bundle.agent_price_ghc !== undefined ? bundle.agent_price_ghc : bundle.price_ghc).toString(),
            validity_days: bundle.validity_days.toString(),
            is_active: bundle.is_active,
            provider_slug: bundle.provider_slug || 'default'
        });
        setShowModal(true);
    };

    const openDeleteModal = (bundle: DataBundle) => {
        setEditingBundle(bundle);
        setShowDeleteModal(true);
    };

    const handleSave = async () => {
        if (!form.data_amount || !form.price_ghc) {
            toast({ title: 'Error', description: 'Please fill all required fields', variant: 'destructive' });
            return;
        }

        setActionLoading(true);
        try {
            const bundleData = {
                network: form.network,
                dataAmount: form.data_amount,
                priceGhc: parseFloat(form.price_ghc),
                agentPriceGhc: form.agent_price_ghc !== '' ? parseFloat(form.agent_price_ghc) : parseFloat(form.price_ghc),
                isActive: form.is_active,
                providerSlug: form.provider_slug === 'default' ? null : form.provider_slug
            };

            if (editingBundle) {
                await adminService.updateBundle(editingBundle.id, bundleData);
                toast({ title: 'Success', description: `${form.network} ${form.data_amount} updated successfully` });
            } else {
                await adminService.createBundle(bundleData);
                toast({ title: 'Success', description: `${form.network} ${form.data_amount} created successfully` });
            }

            setShowModal(false);
            fetchBundles();
        } catch (err) {
            console.error('Error saving bundle:', err);
            toast({ title: 'Error', description: 'Failed to save data plan', variant: 'destructive' });
        } finally {
            setActionLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!editingBundle) return;

        setActionLoading(true);
        try {
            await adminService.deleteBundle(editingBundle.id);
            toast({ title: 'Success', description: 'Data plan deleted successfully' });
            setShowDeleteModal(false);
            fetchBundles();
        } catch (err: any) {
            console.error('Error deleting bundle:', err);
            toast({
                title: 'Error',
                description: err.message || 'Failed to delete data plan',
                variant: 'destructive'
            });
        } finally {
            setActionLoading(false);
        }
    };

    const toggleActive = async (bundle: DataBundle) => {
        try {
            await adminService.updateBundle(bundle.id, { isActive: !bundle.is_active });
            fetchBundles();
            toast({ title: 'Success', description: `${bundle.network} ${bundle.data_amount} has been ${bundle.is_active ? 'disabled' : 'enabled'}.` });
        } catch (err) {
            toast({ title: 'Error', description: `Failed to update ${bundle.network} ${bundle.data_amount}. Please try again.`, variant: 'destructive' });
        }
    };

    const getNetworkColor = (network: string) => {
        const net = network.toUpperCase();
        switch (net) {
            case 'MTN': return 'bg-yellow-400 text-black';
            case 'TELECEL': return 'bg-red-600 text-white';
            case 'AIRTELTIGO': return 'bg-blue-600 text-white';
            default: return 'bg-slate-500 text-white';
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Database className="w-8 h-8 text-slate-400" />
                    <div>
                        <h1 className="text-2xl font-bold text-white">Data Plans</h1>
                        <p className="text-slate-400">Manage data bundle offerings</p>
                    </div>
                </div>
                <Button onClick={openCreateModal} className="bg-emerald-500 hover:bg-emerald-600 text-white">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Data Plan
                </Button>
            </div>

            {/* Filters */}
            <Card className="bg-[#1e293b] border-slate-700/50">
                <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <Input
                                placeholder="Search data plans..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                            />
                        </div>
                        <div className="flex gap-2 flex-wrap">
                            {['all', 'MTN', 'Telecel', 'AirtelTigo'].map((network) => (
                                <Button
                                    key={network}
                                    variant={networkFilter === network ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setNetworkFilter(network)}
                                    className={cn(
                                        networkFilter === network
                                            ? 'bg-emerald-500 text-white'
                                            : 'border-slate-600 text-slate-300'
                                    )}
                                >
                                    {network === 'all' ? 'All' : network}
                                </Button>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Data Plans Grid */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <Card key={i} className="bg-[#1e293b] border-slate-700/50">
                            <CardContent className="p-4 space-y-3">
                                <div className="flex items-start justify-between">
                                    <Skeleton className="h-6 w-16 rounded bg-slate-700" />
                                    <div className="flex gap-1"><Skeleton className="h-8 w-8 rounded bg-slate-700" /><Skeleton className="h-8 w-8 rounded bg-slate-700" /></div>
                                </div>
                                <div className="flex items-center gap-2"><Skeleton className="h-5 w-5 rounded bg-slate-700" /><Skeleton className="h-6 w-16 bg-slate-700" /></div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1"><Skeleton className="h-3 w-20 bg-slate-700" /><Skeleton className="h-6 w-24 bg-slate-700" /></div>
                                    <div className="space-y-1"><Skeleton className="h-3 w-20 bg-slate-700" /><Skeleton className="h-6 w-24 bg-slate-700" /></div>
                                </div>
                                <Skeleton className="h-3 w-28 bg-slate-700" />
                                <Skeleton className="h-9 w-full rounded bg-slate-700" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : filteredBundles.length === 0 ? (
                <div className="text-center py-12 text-slate-400">No data plans found</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredBundles.map((bundle) => (
                        <Card key={bundle.id} className={cn(
                            "bg-[#1e293b] border-slate-700/50 transition-all",
                            !bundle.is_active && "opacity-60"
                        )}>
                            <CardContent className="p-4">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className={cn("px-2 py-1 text-xs font-bold rounded", getNetworkColor(bundle.network))}>
                                            {bundle.network}
                                        </span>
                                        {bundle.provider_slug && (
                                            <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-slate-800 text-slate-300 border border-slate-700">
                                                {bundle.provider_slug === 'portal02' ? 'Portal-02' : bundle.provider_slug === 'datahouse' ? 'GetMorePayLess' : bundle.provider_slug}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex gap-1">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditModal(bundle)}>
                                            <Edit className="w-4 h-4 text-slate-400" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDeleteModal(bundle)}>
                                            <Trash2 className="w-4 h-4 text-red-400" />
                                        </Button>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 mb-2">
                                    <Wifi className="w-5 h-5 text-emerald-400" />
                                    <span className="text-xl font-bold text-white">{bundle.data_amount}</span>
                                </div>

                                <div className="grid grid-cols-2 gap-2 mb-2">
                                    <div>
                                        <p className="text-xs text-slate-500">Customer Price</p>
                                        <p className="text-xl font-bold text-emerald-400">
                                            GH₵ {bundle.price_ghc.toFixed(2)}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500">Agent Price</p>
                                        <p className="text-xl font-bold text-blue-400">
                                            GH₵ {bundle.agent_price_ghc.toFixed(2)}
                                        </p>
                                    </div>
                                </div>

                                <p className="text-sm text-slate-400 mb-3">
                                    Valid for {bundle.validity_days} days
                                </p>

                                <Button
                                    variant="outline"
                                    size="sm"
                                    className={cn(
                                        "w-full",
                                        bundle.is_active
                                            ? "border-red-500/50 text-red-400 hover:bg-red-500/10"
                                            : "border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10"
                                    )}
                                    onClick={() => toggleActive(bundle)}
                                >
                                    {bundle.is_active ? 'Disable' : 'Enable'}
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Create/Edit Modal */}
            <Dialog open={showModal} onOpenChange={setShowModal}>
                <DialogContent className="bg-[#1e293b] border-slate-700 text-white">
                    <DialogHeader>
                        <DialogTitle>{editingBundle ? 'Edit Data Plan' : 'Create Data Plan'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label className="text-slate-300">Network</Label>
                            <Select value={form.network} onValueChange={(value) => setForm({ ...form, network: value })}>
                                <SelectTrigger className="w-full bg-slate-700/50 border-slate-600 text-white">
                                    <SelectValue placeholder="Select network" />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-800 border-slate-600">
                                    <SelectItem value="MTN" className="text-white hover:bg-slate-700 focus:bg-slate-700">
                                        <div className="flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
                                            MTN
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="Telecel" className="text-white hover:bg-slate-700 focus:bg-slate-700">
                                        <div className="flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-red-600"></span>
                                            Telecel
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="AirtelTigo" className="text-white hover:bg-slate-700 focus:bg-slate-700">
                                        <div className="flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                                            AirtelTigo
                                        </div>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-slate-300">Data Amount</Label>
                            <Select
                                value={['500MB', '1GB', '2GB', '3GB', '5GB', '10GB', '15GB', '20GB', '25GB', '30GB', '50GB'].includes(form.data_amount) ? form.data_amount : 'custom'}
                                onValueChange={(value) => {
                                    if (value === 'custom') {
                                        setForm({ ...form, data_amount: '' });
                                    } else {
                                        setForm({ ...form, data_amount: value });
                                    }
                                }}
                            >
                                <SelectTrigger className="w-full bg-slate-700/50 border-slate-600 text-white">
                                    <SelectValue placeholder="Select data amount" />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-800 border-slate-600 max-h-60">
                                    <SelectItem value="500MB" className="text-white hover:bg-slate-700 focus:bg-slate-700">500MB</SelectItem>
                                    <SelectItem value="1GB" className="text-white hover:bg-slate-700 focus:bg-slate-700">1GB</SelectItem>
                                    <SelectItem value="2GB" className="text-white hover:bg-slate-700 focus:bg-slate-700">2GB</SelectItem>
                                    <SelectItem value="3GB" className="text-white hover:bg-slate-700 focus:bg-slate-700">3GB</SelectItem>
                                    <SelectItem value="5GB" className="text-white hover:bg-slate-700 focus:bg-slate-700">5GB</SelectItem>
                                    <SelectItem value="10GB" className="text-white hover:bg-slate-700 focus:bg-slate-700">10GB</SelectItem>
                                    <SelectItem value="15GB" className="text-white hover:bg-slate-700 focus:bg-slate-700">15GB</SelectItem>
                                    <SelectItem value="20GB" className="text-white hover:bg-slate-700 focus:bg-slate-700">20GB</SelectItem>
                                    <SelectItem value="25GB" className="text-white hover:bg-slate-700 focus:bg-slate-700">25GB</SelectItem>
                                    <SelectItem value="30GB" className="text-white hover:bg-slate-700 focus:bg-slate-700">30GB</SelectItem>
                                    <SelectItem value="50GB" className="text-white hover:bg-slate-700 focus:bg-slate-700">50GB</SelectItem>
                                    <SelectItem value="custom" className="text-white hover:bg-slate-700 focus:bg-slate-700">Other (Custom)</SelectItem>
                                </SelectContent>
                            </Select>
                            {!['500MB', '1GB', '2GB', '3GB', '5GB', '10GB', '15GB', '20GB', '25GB', '30GB', '50GB'].includes(form.data_amount) && (
                                <Input
                                    value={form.data_amount}
                                    onChange={(e) => setForm({ ...form, data_amount: e.target.value })}
                                    className="bg-slate-700/50 border-slate-600 text-white mt-2"
                                    placeholder="Enter custom amount (e.g., 7GB)"
                                />
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-slate-300">Customer Price (GH₵)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={form.price_ghc}
                                    onChange={(e) => setForm({ ...form, price_ghc: e.target.value })}
                                    className="bg-slate-700/50 border-slate-600 text-white"
                                    placeholder="0.00"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-slate-300">Agent Price (GH₵)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={form.agent_price_ghc}
                                    onChange={(e) => setForm({ ...form, agent_price_ghc: e.target.value })}
                                    className="bg-slate-700/50 border-slate-600 text-white"
                                    placeholder="0.00"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-slate-300">Validity (Days)</Label>
                            <Input
                                type="number"
                                value={form.validity_days}
                                onChange={(e) => setForm({ ...form, validity_days: e.target.value })}
                                className="bg-slate-700/50 border-slate-600 text-white"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-slate-300">Assigned Provider / API Routing</Label>
                            <Select value={form.provider_slug} onValueChange={(value) => setForm({ ...form, provider_slug: value })}>
                                <SelectTrigger className="w-full bg-slate-700/50 border-slate-600 text-white">
                                    <SelectValue placeholder="Select provider" />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-800 border-slate-600">
                                    <SelectItem value="default" className="text-white hover:bg-slate-700 focus:bg-slate-700">
                                        Global Active Provider (System Default)
                                    </SelectItem>
                                    <SelectItem value="portal02" className="text-white hover:bg-slate-700 focus:bg-slate-700">
                                        Portal-02
                                    </SelectItem>
                                    <SelectItem value="datahouse" className="text-white hover:bg-slate-700 focus:bg-slate-700">
                                        GetMorePayLess (Datahouse)
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowModal(false)} className="border-slate-600">
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={actionLoading} className="bg-emerald-500 hover:bg-emerald-600">
                            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Modal */}
            <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
                <DialogContent className="bg-[#1e293b] border-slate-700 text-white">
                    <DialogHeader>
                        <DialogTitle>Delete Data Plan</DialogTitle>
                    </DialogHeader>
                    <p className="text-slate-400">
                        Are you sure you want to delete the <span className="text-white font-medium">{editingBundle?.data_amount}</span> plan for {editingBundle?.network}?
                    </p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowDeleteModal(false)} className="border-slate-600">
                            Cancel
                        </Button>
                        <Button onClick={handleDelete} disabled={actionLoading} className="bg-red-500 hover:bg-red-600">
                            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
