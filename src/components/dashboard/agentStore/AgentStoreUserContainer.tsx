import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { agentStoreService, AgentStore } from '@/services/agentStore.service';
import { AgentStoreLanding } from './AgentStoreLanding';
import { RefreshCw } from 'lucide-react';

export const AgentStoreUserContainer: React.FC = () => {
    const navigate = useNavigate();
    const [store, setStore] = useState<AgentStore | null>(null);
    const [hasStore, setHasStore] = useState<boolean>(false);
    const [loading, setLoading] = useState(true);

    const checkStore = async () => {
        setLoading(true);
        try {
            const res = await agentStoreService.getMyStore();
            if (res.success && res.hasStore && res.store) {
                setStore(res.store);
                setHasStore(true);

                // If store is already fully active, redirect to standalone Agent Store app shell
                if (res.store.effective_status === 'ACTIVE') {
                    navigate('/agent-store', { replace: true });
                    return;
                }
            } else {
                setHasStore(false);
            }
        } catch (err) {
            console.error('Error checking store status in User Container:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        checkStore();
    }, []);

    if (loading) {
        return (
            <div className="p-8 text-center text-slate-400 flex flex-col items-center justify-center min-h-[400px] space-y-3 font-sans">
                <RefreshCw className="w-8 h-8 animate-spin text-[#a3e635]" />
                <span className="text-sm font-bold text-white">Checking Agent Store registration status...</span>
            </div>
        );
    }

    // Render registration and activation landing inside ByteBeacon User Dashboard
    return (
        <div className="space-y-6">
            <AgentStoreLanding existingStore={store} onStoreCreated={checkStore} />
        </div>
    );
};

export default AgentStoreUserContainer;
