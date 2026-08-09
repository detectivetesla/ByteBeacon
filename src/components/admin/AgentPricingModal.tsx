import { useState, useEffect, useCallback } from 'react';
import { adminService, AgentPricing } from '@/services/admin.service';
import { bundleService, Bundle } from '@/services/data.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { DollarSign, Save, Loader2, X, RefreshCcw } from 'lucide-react';

interface AgentPricingModalProps {
    isOpen: boolean;
    onClose: () => void;
    agentId: string;
    agentName: string;
}

const NETWORKS = ['MTN', 'Telecel', 'AirtelTigo'];

export default function AgentPricingModal({ isOpen, onClose, agentId, agentName }: AgentPricingModalProps) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [bundles, setBundles] = useState<Bundle[]>([]);
    const [customPrices, setCustomPrices] = useState<Record<string, string>>({});
    const [existingPricing, setExistingPricing] = useState<AgentPricing[]>([]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            // Fetch all bundles and existing custom pricing in parallel
            const [bundlesData, pricingData] = await Promise.all([
                bundleService.getAll(),
                adminService.getAgentPricing(agentId)
            ]);

            setBundles(bundlesData);
            setExistingPricing(pricingData);

            // Pre-populate input fields with existing custom prices
            const priceMap: Record<string, string> = {};
            pricingData.forEach(p => {
                priceMap[p.bundleId] = p.customPrice.toFixed(2);
            });
            setCustomPrices(priceMap);
        } catch (error) {
            console.error('Error fetching data:', error);
            toast({
                title: 'Error',
                description: 'Failed to load pricing data.',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    }, [agentId, toast]);

    useEffect(() => {
        if (isOpen) {
            fetchData();
        }
    }, [isOpen, fetchData]);

    const handlePriceChange = (bundleId: string, value: string) => {
        setCustomPrices(prev => ({
            ...prev,
            [bundleId]: value
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // Filter only bundles with custom prices set
            const pricing = Object.entries(customPrices)
                .filter(([_, price]) => price && price.trim() !== '')
                .map(([bundleId, price]) => ({
                    bundleId,
                    customPrice: parseFloat(price)
                }));

            if (pricing.length === 0) {
                toast({
                    title: 'No changes',
                    description: 'No custom prices were set.',
                });
                return;
            }

            await adminService.bulkSetAgentPricing(agentId, pricing);

            toast({
                title: 'Success',
                description: `Custom pricing updated for ${agentName}.`,
            });

            onClose();
        } catch (error) {
            console.error('Error saving pricing:', error);
            toast({
                title: 'Error',
                description: 'Failed to save custom pricing.',
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    };

    const handleRemovePrice = async (bundleId: string) => {
        try {
            await adminService.deleteAgentPricing(agentId, bundleId);
            setCustomPrices(prev => {
                const updated = { ...prev };
                delete updated[bundleId];
                return updated;
            });
            setExistingPricing(prev => prev.filter(p => p.bundleId !== bundleId));
            toast({
                title: 'Success',
                description: 'Custom price removed.',
            });
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to remove custom price.',
                variant: 'destructive',
            });
        }
    };

    const getBundlesByNetwork = (network: string) => {
        return bundles.filter(b => b.network.toLowerCase() === network.toLowerCase());
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-primary" />
                        Custom Agent Pricing for {agentName}
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-1">
                    {loading ? (
                        <div className="flex items-center justify-center py-10">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <Tabs defaultValue="MTN" className="w-full">
                            <TabsList className="mb-4 grid grid-cols-3 w-full">
                                {NETWORKS.map(network => (
                                    <TabsTrigger key={network} value={network}>
                                        {network}
                                    </TabsTrigger>
                                ))}
                            </TabsList>

                            {NETWORKS.map(network => (
                                <TabsContent key={network} value={network} className="space-y-2">
                                    <div className="grid gap-2">
                                        <div className="grid grid-cols-4 gap-2 text-xs font-medium text-muted-foreground px-2">
                                            <span>Data</span>
                                            <span>Standard</span>
                                            <span>Default Agent</span>
                                            <span>Custom Price</span>
                                        </div>
                                        {getBundlesByNetwork(network).map(bundle => {
                                            const existingPrice = existingPricing.find(p => p.bundleId === bundle.id);
                                            return (
                                                <div key={bundle.id} className="grid grid-cols-4 gap-2 items-center p-2 rounded-lg bg-muted/30 hover:bg-muted/50">
                                                    <span className="font-medium">{bundle.dataAmount}</span>
                                                    <span className="text-sm">GH₵ {bundle.priceGhc.toFixed(2)}</span>
                                                    <span className="text-sm text-muted-foreground">
                                                        {bundle.agentPriceGhc ? `GH₵ ${bundle.agentPriceGhc.toFixed(2)}` : '-'}
                                                    </span>
                                                    <div className="flex items-center gap-1">
                                                        <Input
                                                            type="number"
                                                            step="0.01"
                                                            placeholder="Custom"
                                                            value={customPrices[bundle.id] || ''}
                                                            onChange={(e) => handlePriceChange(bundle.id, e.target.value)}
                                                            className="h-8 text-sm"
                                                        />
                                                        {existingPrice && (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-red-500 hover:text-red-600"
                                                                onClick={() => handleRemovePrice(bundle.id)}
                                                            >
                                                                <X className="w-4 h-4" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </TabsContent>
                            ))}
                        </Tabs>
                    )}
                </div>

                <DialogFooter className="pt-4 border-t">
                    <Button variant="outline" onClick={onClose} disabled={saving}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={loading || saving}>
                        {saving ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <Save className="w-4 h-4 mr-2" />
                        )}
                        Save Pricing
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
