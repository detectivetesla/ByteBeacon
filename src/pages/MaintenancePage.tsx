import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Settings, RefreshCcw } from 'lucide-react';

export default function MaintenancePage() {
    useEffect(() => {
        // Auto-refresh every 60 seconds to check if maintenance is over
        const timer = setInterval(() => {
            window.location.reload();
        }, 60000);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4">
            <div className="max-w-md w-full text-center space-y-8 animate-in fade-in zoom-in duration-500">
                <div className="relative inline-block">
                    <div className="w-24 h-24 bg-primary/20 rounded-3xl flex items-center justify-center animate-pulse">
                        <Settings className="w-12 h-12 text-primary animate-spin-[reverse] duration-[3000ms]" />
                    </div>
                </div>

                <div className="space-y-4">
                    <h1 className="text-4xl font-bold text-white font-display">System Maintenance</h1>
                    <p className="text-slate-400 text-lg leading-relaxed">
                        We're currently performing some important updates to improve our services.
                        We'll be back online shortly. Thank you for your patience!
                    </p>
                </div>

                <div className="pt-4">
                    <Button
                        onClick={() => window.location.reload()}
                        className="gap-2 px-8"
                        size="lg"
                    >
                        <RefreshCcw className="w-4 h-4" />
                        Check Status
                    </Button>
                </div>

                <div className="pt-8 border-t border-slate-800">
                    <p className="text-slate-500 text-sm">
                        &copy; {new Date().getFullYear()} ByteBeacon VTU Data Hub. All rights reserved.
                    </p>
                </div>
            </div>
        </div>
    );
}
