import { useState, useEffect } from 'react';
import { bundleService } from '@/services';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
    Wifi,
    Settings,
    ToggleLeft,
    ToggleRight,
    Edit,
    Save,
    Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Network {
    id: string;
    name: string;
    code: string;
    color: string;
    enabled: boolean;
    apiEndpoint: string;
    bundleCount: number;
}

export default function AdminNetworksPage() {
    const { toast } = useToast();
    const [networks, setNetworks] = useState<Network[]>([
        {
            id: '1',
            name: 'MTN Ghana',
            code: 'MTN',
            color: 'bg-yellow-400',
            enabled: true,
            apiEndpoint: 'https://api.mtn.com/data',
            bundleCount: 0
        },
        {
            id: '2',
            name: 'Telecel Ghana',
            code: 'Telecel',
            color: 'bg-red-600',
            enabled: true,
            apiEndpoint: 'https://api.telecel.com/data',
            bundleCount: 0
        },
        {
            id: '3',
            name: 'AirtelTigo Ghana',
            code: 'AirtelTigo',
            color: 'bg-blue-600',
            enabled: true,
            apiEndpoint: 'https://api.airteltigo.com.gh/data',
            bundleCount: 0
        },
    ]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [editingNetwork, setEditingNetwork] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({ apiEndpoint: '' });

    useEffect(() => {
        fetchBundleCounts();
    }, []);

    const fetchBundleCounts = async () => {
        try {
            const data = await bundleService.getAll();

            if (data) {
                const counts: Record<string, number> = {};
                data.forEach(bundle => {
                    const network = bundle.network;
                    counts[network] = (counts[network] || 0) + 1;
                });

                setNetworks(prev => prev.map(n => ({
                    ...n,
                    bundleCount: counts[n.code.toUpperCase()] || counts[n.code] || 0
                })));
            }
        } catch (err) {
            console.error('Error fetching bundle counts:', err);
        } finally {
            setLoading(false);
        }
    };

    const toggleNetwork = (networkId: string) => {
        setNetworks(prev => prev.map(n =>
            n.id === networkId ? { ...n, enabled: !n.enabled } : n
        ));

        const network = networks.find(n => n.id === networkId);
        toast({
            title: network?.enabled ? 'Network Disabled' : 'Network Enabled',
            description: `${network?.name} has been ${network?.enabled ? 'disabled' : 'enabled'}`,
        });
    };

    const startEdit = (network: Network) => {
        setEditingNetwork(network.id);
        setEditForm({ apiEndpoint: network.apiEndpoint });
    };

    const saveEdit = async (networkId: string) => {
        setSaving(networkId);

        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 500));

        setNetworks(prev => prev.map(n =>
            n.id === networkId ? { ...n, apiEndpoint: editForm.apiEndpoint } : n
        ));

        setEditingNetwork(null);
        setSaving(null);

        toast({
            title: 'Network Updated',
            description: 'API endpoint has been updated successfully',
        });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <Wifi className="w-8 h-8 text-slate-400" />
                <div>
                    <h1 className="text-2xl font-bold text-white">Networks</h1>
                    <p className="text-slate-400">Manage network providers and their settings</p>
                </div>
            </div>

            {/* Networks Grid */}
            <div className="grid gap-4">
                {networks.map((network) => (
                    <Card key={network.id} className="bg-[#1e293b] border-slate-700/50">
                        <CardContent className="p-6">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                {/* Network Info */}
                                <div className="flex items-center gap-4">
                                    <div className={cn(
                                        "w-14 h-14 rounded-xl flex items-center justify-center",
                                        network.color
                                    )}>
                                        <span className="text-white font-bold text-lg">
                                            {network.code.slice(0, 2)}
                                        </span>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold text-white">{network.name}</h3>
                                        <p className="text-sm text-slate-400">
                                            Code: {network.code} • {network.bundleCount} bundles
                                        </p>
                                    </div>
                                </div>

                                {/* Status and Actions */}
                                <div className="flex items-center gap-4">
                                    <span className={cn(
                                        "px-3 py-1 text-sm font-medium rounded-full",
                                        network.enabled
                                            ? "bg-emerald-500/20 text-emerald-400"
                                            : "bg-red-500/20 text-red-400"
                                    )}>
                                        {network.enabled ? 'Active' : 'Disabled'}
                                    </span>

                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => toggleNetwork(network.id)}
                                        className={cn(
                                            "gap-2",
                                            network.enabled
                                                ? "text-emerald-400 hover:text-emerald-300"
                                                : "text-red-400 hover:text-red-300"
                                        )}
                                    >
                                        {network.enabled ? (
                                            <>
                                                <ToggleRight className="w-5 h-5" />
                                                Disable
                                            </>
                                        ) : (
                                            <>
                                                <ToggleLeft className="w-5 h-5" />
                                                Enable
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>

                            {/* API Endpoint */}
                            <div className="mt-4 p-4 bg-slate-700/30 rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium text-slate-300">API Endpoint</span>
                                    {editingNetwork === network.id ? (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => saveEdit(network.id)}
                                            disabled={saving === network.id}
                                            className="text-emerald-400 hover:text-emerald-300"
                                        >
                                            {saving === network.id ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <>
                                                    <Save className="w-4 h-4 mr-1" />
                                                    Save
                                                </>
                                            )}
                                        </Button>
                                    ) : (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => startEdit(network)}
                                            className="text-slate-400 hover:text-white"
                                        >
                                            <Edit className="w-4 h-4 mr-1" />
                                            Edit
                                        </Button>
                                    )}
                                </div>

                                {editingNetwork === network.id ? (
                                    <Input
                                        value={editForm.apiEndpoint}
                                        onChange={(e) => setEditForm({ apiEndpoint: e.target.value })}
                                        className="bg-slate-700/50 border-slate-600 text-white font-mono text-sm"
                                    />
                                ) : (
                                    <code className="text-sm text-emerald-400 font-mono">
                                        {network.apiEndpoint}
                                    </code>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Stats Summary */}
            <Card className="bg-[#1e293b] border-slate-700/50">
                <CardContent className="p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Network Statistics</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {networks.map(network => (
                            <div key={network.id} className="p-4 bg-slate-700/30 rounded-lg">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className={cn("w-3 h-3 rounded-full", network.color)}></div>
                                    <span className="text-sm font-medium text-white">{network.name}</span>
                                </div>
                                <p className="text-2xl font-bold text-white">{network.bundleCount}</p>
                                <p className="text-xs text-slate-400">Active bundles</p>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
