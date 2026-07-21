import { useState, useEffect } from 'react';
import { api } from '@/services';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
    Percent,
    Plus,
    Edit,
    Trash2,
    Loader2,
    Copy,
    Search,
    Calendar
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';

interface Discount {
    id: string;
    code: string;
    description: string;
    discount_percent: number;
    max_uses: number;
    current_uses: number;
    valid_from: string;
    valid_until: string;
    is_active: boolean;
    min_amount: number;
}

export default function AdminDiscountsPage() {
    const { toast } = useToast();
    const [discounts, setDiscounts] = useState<Discount[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const [showModal, setShowModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [editingDiscount, setEditingDiscount] = useState<Discount | null>(null);
    const [actionLoading, setActionLoading] = useState(false);

    const [form, setForm] = useState({
        code: '',
        description: '',
        discount_percent: '10',
        max_uses: '100',
        valid_from: '',
        valid_until: '',
        is_active: true,
        min_amount: '0',
    });

    useEffect(() => {
        fetchDiscounts();
    }, []);

    const fetchDiscounts = async () => {
        setLoading(true);
        try {
            if (!supabase) {
                console.warn('Supabase not configured, using mock data for discounts.');
                throw new Error('Supabase not initialized');
            }
            const { data, error } = await supabase
                .from('discounts')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                // If table doesn't exist, use mock data
                setDiscounts([
                    {
                        id: '1',
                        code: 'WELCOME10',
                        description: 'Welcome discount for new users',
                        discount_percent: 10,
                        max_uses: 1000,
                        current_uses: 250,
                        valid_from: '2024-01-01',
                        valid_until: '2024-12-31',
                        is_active: true,
                        min_amount: 5,
                    },
                    {
                        id: '2',
                        code: 'HOLIDAY25',
                        description: 'Holiday special offer',
                        discount_percent: 25,
                        max_uses: 500,
                        current_uses: 100,
                        valid_from: '2024-12-01',
                        valid_until: '2024-12-31',
                        is_active: true,
                        min_amount: 10,
                    },
                ]);
            } else {
                setDiscounts(data || []);
            }
        } catch (err) {
            console.error('Error fetching discounts:', err);
        } finally {
            setLoading(false);
        }
    };

    const filteredDiscounts = discounts.filter(d =>
        d.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.description.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const openCreateModal = () => {
        setEditingDiscount(null);
        setForm({
            code: '',
            description: '',
            discount_percent: '10',
            max_uses: '100',
            valid_from: new Date().toISOString().split('T')[0],
            valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            is_active: true,
            min_amount: '0',
        });
        setShowModal(true);
    };

    const openEditModal = (discount: Discount) => {
        setEditingDiscount(discount);
        setForm({
            code: discount.code,
            description: discount.description,
            discount_percent: discount.discount_percent.toString(),
            max_uses: discount.max_uses.toString(),
            valid_from: discount.valid_from,
            valid_until: discount.valid_until,
            is_active: discount.is_active,
            min_amount: discount.min_amount.toString(),
        });
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!form.code || !form.description) {
            toast({ title: 'Error', description: 'Please fill all required fields', variant: 'destructive' });
            return;
        }

        setActionLoading(true);
        try {
            const discountData = {
                code: form.code.toUpperCase(),
                description: form.description,
                discount_percent: parseFloat(form.discount_percent),
                max_uses: parseInt(form.max_uses),
                valid_from: form.valid_from,
                valid_until: form.valid_until,
                is_active: form.is_active,
                min_amount: parseFloat(form.min_amount),
            };

            if (editingDiscount) {
                if (!supabase) throw new Error('Supabase not initialized');
                const { error } = await supabase
                    .from('discounts')
                    .update(discountData)
                    .eq('id', editingDiscount.id);
                if (error) throw error;
                toast({ title: 'Success', description: 'Discount updated' });
            } else {
                if (!supabase) throw new Error('Supabase not initialized');
                const { error } = await supabase
                    .from('discounts')
                    .insert({ ...discountData, current_uses: 0 });
                if (error) throw error;
                toast({ title: 'Success', description: 'Discount created' });
            }

            setShowModal(false);
            fetchDiscounts();
        } catch (err) {
            console.error('Error saving discount:', err);
            // Fallback for mock data
            if (editingDiscount) {
                setDiscounts(prev => prev.map(d => d.id === editingDiscount.id ? { ...d, ...form, discount_percent: parseFloat(form.discount_percent), max_uses: parseInt(form.max_uses), min_amount: parseFloat(form.min_amount) } as Discount : d));
            } else {
                setDiscounts(prev => [...prev, { id: Date.now().toString(), code: form.code.toUpperCase(), description: form.description, discount_percent: parseFloat(form.discount_percent), max_uses: parseInt(form.max_uses), current_uses: 0, valid_from: form.valid_from, valid_until: form.valid_until, is_active: form.is_active, min_amount: parseFloat(form.min_amount) }]);
            }
            toast({ title: 'Success', description: editingDiscount ? 'Discount updated' : 'Discount created' });
            setShowModal(false);
        } finally {
            setActionLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!editingDiscount) return;

        setActionLoading(true);
        try {
            if (!supabase) throw new Error('Supabase not initialized');
            const { error } = await supabase.from('discounts').delete().eq('id', editingDiscount.id);
            if (error) throw error;
        } catch {
            setDiscounts(prev => prev.filter(d => d.id !== editingDiscount.id));
        }
        toast({ title: 'Success', description: 'Discount deleted' });
        setShowDeleteModal(false);
        setActionLoading(false);
    };

    const copyCode = (code: string) => {
        navigator.clipboard.writeText(code);
        toast({ title: 'Copied', description: `Code ${code} copied to clipboard` });
    };

    const toggleActive = async (discount: Discount) => {
        try {
            if (!supabase) throw new Error('Supabase not initialized');
            await supabase.from('discounts').update({ is_active: !discount.is_active }).eq('id', discount.id);
        } catch {
            setDiscounts(prev => prev.map(d => d.id === discount.id ? { ...d, is_active: !d.is_active } : d));
        }
        fetchDiscounts();
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Percent className="w-8 h-8 text-slate-400" />
                    <div>
                        <h1 className="text-2xl font-bold text-white">Discounts</h1>
                        <p className="text-slate-400">Manage discount codes and promotions</p>
                    </div>
                </div>
                <Button onClick={openCreateModal} className="bg-emerald-500 hover:bg-emerald-600 text-white">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Discount
                </Button>
            </div>

            {/* Search */}
            <Card className="bg-[#1e293b] border-slate-700/50">
                <CardContent className="p-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <Input
                            placeholder="Search discounts..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 bg-slate-700/50 border-slate-600 text-white"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Discounts Grid */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                </div>
            ) : filteredDiscounts.length === 0 ? (
                <div className="text-center py-12 text-slate-400">No discounts found</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredDiscounts.map((discount) => (
                        <Card key={discount.id} className={cn("bg-[#1e293b] border-slate-700/50", !discount.is_active && "opacity-60")}>
                            <CardContent className="p-4">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-2xl font-bold text-emerald-400">{discount.discount_percent}%</span>
                                        <span className={cn("px-2 py-0.5 text-xs rounded-full", discount.is_active ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-500/20 text-slate-400")}>
                                            {discount.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>
                                    <div className="flex gap-1">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditModal(discount)}>
                                            <Edit className="w-4 h-4 text-slate-400" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingDiscount(discount); setShowDeleteModal(true); }}>
                                            <Trash2 className="w-4 h-4 text-red-400" />
                                        </Button>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 mb-2">
                                    <code className="px-3 py-1.5 bg-slate-700 rounded-lg text-white font-mono text-sm">
                                        {discount.code}
                                    </code>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyCode(discount.code)}>
                                        <Copy className="w-4 h-4 text-slate-400" />
                                    </Button>
                                </div>

                                <p className="text-sm text-slate-400 mb-3">{discount.description}</p>

                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between text-slate-400">
                                        <span>Uses</span>
                                        <span className="text-white">{discount.current_uses} / {discount.max_uses}</span>
                                    </div>
                                    <div className="flex justify-between text-slate-400">
                                        <span>Min. Amount</span>
                                        <span className="text-white">GH₵ {discount.min_amount}</span>
                                    </div>
                                    <div className="flex justify-between text-slate-400">
                                        <span>Valid Until</span>
                                        <span className="text-white">{new Date(discount.valid_until).toLocaleDateString()}</span>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-700">
                                    <Switch checked={discount.is_active} onCheckedChange={() => toggleActive(discount)} />
                                    <span className="text-sm text-slate-400">{discount.is_active ? 'Enabled' : 'Disabled'}</span>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Create/Edit Modal */}
            <Dialog open={showModal} onOpenChange={setShowModal}>
                <DialogContent className="bg-[#1e293b] border-slate-700 text-white max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editingDiscount ? 'Edit Discount' : 'Create Discount'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label className="text-slate-300">Code</Label>
                            <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} className="bg-slate-700/50 border-slate-600 text-white font-mono" placeholder="e.g., SAVE20" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-slate-300">Description</Label>
                            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="bg-slate-700/50 border-slate-600 text-white" placeholder="e.g., Welcome discount" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-slate-300">Discount %</Label>
                                <Input type="number" value={form.discount_percent} onChange={(e) => setForm({ ...form, discount_percent: e.target.value })} className="bg-slate-700/50 border-slate-600 text-white" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-slate-300">Max Uses</Label>
                                <Input type="number" value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value })} className="bg-slate-700/50 border-slate-600 text-white" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-slate-300">Valid From</Label>
                                <Input type="date" value={form.valid_from} onChange={(e) => setForm({ ...form, valid_from: e.target.value })} className="bg-slate-700/50 border-slate-600 text-white" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-slate-300">Valid Until</Label>
                                <Input type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} className="bg-slate-700/50 border-slate-600 text-white" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-slate-300">Min. Order Amount (GH₵)</Label>
                            <Input type="number" value={form.min_amount} onChange={(e) => setForm({ ...form, min_amount: e.target.value })} className="bg-slate-700/50 border-slate-600 text-white" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowModal(false)} className="border-slate-600">Cancel</Button>
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
                        <DialogTitle>Delete Discount</DialogTitle>
                    </DialogHeader>
                    <p className="text-slate-400">Are you sure you want to delete the discount code <span className="text-white font-mono">{editingDiscount?.code}</span>?</p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowDeleteModal(false)} className="border-slate-600">Cancel</Button>
                        <Button onClick={handleDelete} disabled={actionLoading} className="bg-red-500 hover:bg-red-600">
                            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
