import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Wrench, ShieldCheck, ArrowLeft, Clock, AlertCircle } from 'lucide-react';
import { useMaintenance } from '@/contexts/MaintenanceContext';

export const MaintenanceBanner: React.FC = () => {
    const { isMaintenance, message } = useMaintenance();

    if (!isMaintenance) return null;

    return (
        <div className="w-full bg-amber-500/10 dark:bg-amber-950/40 border-b border-amber-500/20 px-4 py-2.5 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-center gap-2 text-center animate-fade-in z-50">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
            <span>
                <strong className="font-semibold">Maintenance Notice:</strong> {message || "ByteBeacon is currently undergoing maintenance. Account operations and purchases are temporarily paused."}
            </span>
        </div>
    );
};

export const MaintenanceFeedbackCard: React.FC<{
    onBackHome?: () => void;
}> = ({ onBackHome }) => {
    const navigate = useNavigate();
    const { title, message, estimatedEnd } = useMaintenance();

    const handleHome = () => {
        if (onBackHome) {
            onBackHome();
        } else {
            navigate('/');
        }
    };

    return (
        <div className="min-h-[60vh] flex items-center justify-center p-4">
            <Card className="max-w-md w-full border-border/70 shadow-lg bg-card/95 backdrop-blur-md">
                <CardContent className="p-8 text-center space-y-6">
                    <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                        <Wrench className="w-8 h-8 text-amber-500 animate-pulse" />
                    </div>

                    <div className="space-y-2">
                        <h2 className="text-xl font-bold tracking-tight text-foreground">
                            {title || "We're upgrading ByteBeacon"}
                        </h2>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            {message || "ByteBeacon is taking a quick maintenance break. We're making improvements behind the scenes to give you a faster and more reliable experience."}
                        </p>
                    </div>

                    {estimatedEnd && (
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/60 text-xs font-medium text-muted-foreground border border-border">
                            <Clock className="w-3.5 h-3.5 text-primary" />
                            <span>Estimated return: <strong>{estimatedEnd}</strong></span>
                        </div>
                    )}

                    <div className="p-3.5 rounded-xl bg-muted/40 border border-border/50 text-xs text-muted-foreground flex items-center gap-2 text-left">
                        <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span>Your account, wallet balance, and order records are completely safe. We'll be back shortly.</span>
                    </div>

                    <Button
                        onClick={handleHome}
                        className="w-full h-11 font-medium gap-2 shadow-sm"
                        variant="default"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Return to Home
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
};
