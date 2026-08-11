import React, { useState } from 'react';
import { agentStoreService, AgentOrder } from '@/services/agentStore.service';
import { Search, CheckCircle2, Clock, ShieldCheck, Server, AlertCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export const AgentTrackingPage: React.FC = () => {
    const { toast } = useToast();
    const [searchId, setSearchId] = useState('');
    const [order, setOrder] = useState<AgentOrder | null>(null);
    const [loading, setLoading] = useState(false);

    const handleTrack = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchId.trim()) return;

        setLoading(true);
        try {
            const res = await agentStoreService.trackPublicOrder(searchId.trim());
            if (res.success && res.order) {
                setOrder(res.order);
            }
        } catch (err: any) {
            toast({ title: 'Not Found', description: 'Order ID or payment reference not found', variant: 'destructive' });
            setOrder(null);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-4 sm:space-y-6 bg-[#141518] text-white p-3.5 sm:p-6 rounded-2xl sm:rounded-3xl font-sans max-w-3xl mx-auto w-full min-w-0">
            {/* Header */}
            <div className="bg-[#202227] p-4 sm:p-6 rounded-2xl border border-white/5 space-y-4 text-center">
                <h2 className="text-xl font-bold text-white">Order Fulfillment Tracker</h2>
                <p className="text-xs text-slate-400">Enter an Order ID or Paystack Reference to trace real-time fulfillment state.</p>

                <form onSubmit={handleTrack} className="flex gap-2 max-w-md mx-auto">
                    <input
                        type="text"
                        value={searchId}
                        onChange={(e) => setSearchId(e.target.value)}
                        placeholder="e.g. AG-ORD-1723..."
                        className="flex-1 px-4 py-2.5 bg-[#18191c] border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-[#a3e635]"
                    />
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-5 py-2.5 bg-[#a3e635] hover:bg-[#b5f73c] text-black font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5"
                    >
                        <Search className="w-3.5 h-3.5" /> Track
                    </button>
                </form>
            </div>

            {/* Tracking Result Visual Steps */}
            {order && (
                <div className="bg-[#202227] p-6 rounded-2xl border border-white/5 space-y-6 shadow-xl">
                    <div className="flex justify-between items-center border-b border-white/5 pb-4 text-xs">
                        <div>
                            <span className="text-slate-400">Recipient:</span> <strong className="text-white">{order.customer_phone}</strong>
                        </div>
                        <div>
                            <span className="text-slate-400">Package:</span> <strong className="text-[#a3e635] uppercase">{order.network} {order.data_amount}</strong>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#a3e635]/20 text-[#a3e635] flex items-center justify-center font-bold text-xs">✓</div>
                            <div>
                                <h4 className="text-xs font-bold text-white">1. Payment Received</h4>
                                <p className="text-[11px] text-slate-400">Customer paid GHS {parseFloat(order.selling_price_ghc as any).toFixed(2)} via Paystack</p>
                            </div>
                        </div>
                        <div className="w-0.5 h-6 bg-[#a3e635] ml-4" />

                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#a3e635]/20 text-[#a3e635] flex items-center justify-center font-bold text-xs">✓</div>
                            <div>
                                <h4 className="text-xs font-bold text-white">2. Server Signature Verified</h4>
                                <p className="text-[11px] text-slate-400">ByteBeacon backend authenticated transaction reference</p>
                            </div>
                        </div>
                        <div className="w-0.5 h-6 bg-[#a3e635] ml-4" />

                        <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                                order.fulfillment_status === 'completed' ? 'bg-[#a3e635]/20 text-[#a3e635]' : 'bg-amber-400/20 text-amber-400'
                            }`}>
                                {order.fulfillment_status === 'completed' ? '✓' : '⏳'}
                            </div>
                            <div>
                                <h4 className="text-xs font-bold text-white">3. Data Provider Delivery</h4>
                                <p className="text-[11px] text-slate-400">
                                    Status: <span className="uppercase font-bold text-[#a3e635]">{order.fulfillment_status}</span>
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
