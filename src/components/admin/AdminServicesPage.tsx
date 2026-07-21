import { useState, useEffect } from 'react';
import { api } from '@/services';
import { Card, CardContent } from '@/components/ui/card';
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
    Settings2,
    Plus,
    Edit,
    Trash2,
    Loader2,
    Power,
    DollarSign
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

interface Service {
    id: string;
    name: string;
    description: string;
    icon: string;
    is_active: boolean;
    base_price: number;
    category: string;
}

export default function AdminServicesPage() {
    const { toast } = useToast();
    const [services, setServices] = useState<Service[]>([
        { id: '1', name: 'Data Bundle Purchase', description: 'Buy data bundles for any network', icon: '📱', is_active: true, base_price: 0, category: 'Data' },
        { id: '2', name: 'Airtime Topup', description: 'Top up airtime for any network', icon: '📞', is_active: true, base_price: 0, category: 'Airtime' },
        { id: '3', name: 'Bill Payment', description: 'Pay utility bills', icon: '💡', is_active: false, base_price: 1, category: 'Bills' },
        { id: '4', name: 'TV Subscription', description: 'Renew TV subscriptions', icon: '📺', is_active: false, base_price: 2, category: 'Entertainment' },
        { id: '5', name: 'Internet Package', description: 'Home internet packages', icon: '🌐', is_active: false, base_price: 0, category: 'Internet' },
    ]);
    const [loading, setLoading] = useState(false);

    const [showModal, setShowModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [editingService, setEditingService] = useState<Service | null>(null);
    const [actionLoading, setActionLoading] = useState(false);

    const [form, setForm] = useState({
        name: '',
        description: '',
        icon: '📱',
        is_active: true,
        base_price: '0',
        category: 'Data',
    });

    const categories = ['Data', 'Airtime', 'Bills', 'Entertainment', 'Internet', 'Other'];
    const icons = ['📱', '📞', '💡', '📺', '🌐', '💳', '🎮', '🎵', '📧', '🔒'];

    const openCreateModal = () => {
        setEditingService(null);
        setForm({ name: '', description: '', icon: '📱', is_active: true, base_price: '0', category: 'Data' });
        setShowModal(true);
    };

    const openEditModal = (service: Service) => {
        setEditingService(service);
        setForm({
            name: service.name,
            description: service.description,
            icon: service.icon,
            is_active: service.is_active,
            base_price: service.base_price.toString(),
            category: service.category,
        });
        setShowModal(true);
    };

    const handleSave = () => {
        if (!form.name || !form.description) {
            toast({ title: 'Error', description: 'Please fill all required fields', variant: 'destructive' });
            return;
        }

        setActionLoading(true);
        setTimeout(() => {
            if (editingService) {
                setServices(prev => prev.map(s => s.id === editingService.id ? { ...s, ...form, base_price: parseFloat(form.base_price) } : s));
                toast({ title: 'Success', description: 'Service updated' });
            } else {
                setServices(prev => [...prev, { id: Date.now().toString(), ...form, base_price: parseFloat(form.base_price) }]);
                toast({ title: 'Success', description: 'Service created' });
            }
            setShowModal(false);
            setActionLoading(false);
        }, 500);
    };

    const handleDelete = () => {
        if (!editingService) return;
        setServices(prev => prev.filter(s => s.id !== editingService.id));
        toast({ title: 'Success', description: 'Service deleted' });
        setShowDeleteModal(false);
    };

    const toggleActive = (serviceId: string) => {
        setServices(prev => prev.map(s => s.id === serviceId ? { ...s, is_active: !s.is_active } : s));
        toast({ title: 'Updated', description: 'Service status changed' });
    };

    const activeServices = services.filter(s => s.is_active).length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Settings2 className="w-8 h-8 text-slate-400" />
                    <div>
                        <h1 className="text-2xl font-bold text-white">Services</h1>
                        <p className="text-slate-400">{activeServices} of {services.length} services active</p>
                    </div>
                </div>
                <Button onClick={openCreateModal} className="bg-emerald-500 hover:bg-emerald-600 text-white">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Service
                </Button>
            </div>

            {/* Services Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {services.map((service) => (
                    <Card key={service.id} className={cn("bg-[#1e293b] border-slate-700/50 transition-all", !service.is_active && "opacity-60")}>
                        <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-xl bg-slate-700/50 flex items-center justify-center text-2xl">
                                        {service.icon}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-white">{service.name}</p>
                                        <span className="px-2 py-0.5 text-xs bg-slate-700 rounded-full text-slate-300">
                                            {service.category}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex gap-1">
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditModal(service)}>
                                        <Edit className="w-4 h-4 text-slate-400" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingService(service); setShowDeleteModal(true); }}>
                                        <Trash2 className="w-4 h-4 text-red-400" />
                                    </Button>
                                </div>
                            </div>

                            <p className="text-sm text-slate-400 mb-4">{service.description}</p>

                            {service.base_price > 0 && (
                                <div className="flex items-center gap-2 mb-4 text-sm">
                                    <DollarSign className="w-4 h-4 text-emerald-400" />
                                    <span className="text-slate-400">Base Fee:</span>
                                    <span className="text-white font-medium">GH₵ {service.base_price.toFixed(2)}</span>
                                </div>
                            )}

                            <div className="flex items-center justify-between pt-4 border-t border-slate-700">
                                <div className="flex items-center gap-2">
                                    <Power className={cn("w-4 h-4", service.is_active ? "text-emerald-400" : "text-slate-500")} />
                                    <span className="text-sm text-slate-400">{service.is_active ? 'Active' : 'Inactive'}</span>
                                </div>
                                <Switch checked={service.is_active} onCheckedChange={() => toggleActive(service.id)} />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Create/Edit Modal */}
            <Dialog open={showModal} onOpenChange={setShowModal}>
                <DialogContent className="bg-[#1e293b] border-slate-700 text-white max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editingService ? 'Edit Service' : 'Add Service'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label className="text-slate-300">Icon</Label>
                            <div className="flex gap-2 flex-wrap">
                                {icons.map((icon) => (
                                    <button
                                        key={icon}
                                        type="button"
                                        onClick={() => setForm({ ...form, icon })}
                                        className={cn(
                                            "w-10 h-10 rounded-lg text-xl flex items-center justify-center transition-all",
                                            form.icon === icon ? "bg-emerald-500 ring-2 ring-emerald-400" : "bg-slate-700 hover:bg-slate-600"
                                        )}
                                    >
                                        {icon}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-slate-300">Name</Label>
                            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-slate-700/50 border-slate-600 text-white" placeholder="e.g., Data Bundle Purchase" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-slate-300">Description</Label>
                            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="bg-slate-700/50 border-slate-600 text-white" placeholder="e.g., Buy data bundles for any network" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-slate-300">Category</Label>
                                <Select value={form.category} onValueChange={(value) => setForm({ ...form, category: value })}>
                                    <SelectTrigger className="w-full bg-slate-700/50 border-slate-600 text-white">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-800 border-slate-600">
                                        {categories.map(cat => <SelectItem key={cat} value={cat} className="text-white hover:bg-slate-700 focus:bg-slate-700">{cat}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-slate-300">Base Price (GH₵)</Label>
                                <Input type="number" step="0.01" value={form.base_price} onChange={(e) => setForm({ ...form, base_price: e.target.value })} className="bg-slate-700/50 border-slate-600 text-white" />
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <Label className="text-slate-300">Active</Label>
                            <Switch checked={form.is_active} onCheckedChange={(checked) => setForm({ ...form, is_active: checked })} />
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
                        <DialogTitle>Delete Service</DialogTitle>
                    </DialogHeader>
                    <p className="text-slate-400">Are you sure you want to delete <span className="text-white font-medium">{editingService?.name}</span>?</p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowDeleteModal(false)} className="border-slate-600">Cancel</Button>
                        <Button onClick={handleDelete} className="bg-red-500 hover:bg-red-600">Delete</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
