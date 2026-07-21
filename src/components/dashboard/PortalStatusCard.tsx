import { useState, useEffect } from 'react';
import { api } from '@/services';
import { Hourglass, AlertCircle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PortalStatus {
  success: boolean;
  status: 'healthy' | 'warning' | 'critical';
  delayNotice: string;
  processingCount: number;
  lastCompleted: {
    trackingId: string;
    placedAt: string;
    deliveredAt: string;
  } | null;
  checkingNow: {
    trackingId: string;
  } | null;
}

export default function PortalStatusCard() {
  const [status, setStatus] = useState<PortalStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      const response = await api.get<PortalStatus>('/system/portal-status');
      setStatus(response);
    } catch (err) {
      console.error('Failed to fetch portal status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // Poll every 30 seconds for live updates
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading || !status) {
    return null;
  }

  const statusType = status.status || 'healthy';

  const styles = {
    healthy: {
      card: "bg-emerald-950/20 border-emerald-500/20 text-emerald-300 dark:text-emerald-400",
      glow: "bg-emerald-500",
      iconBg: "bg-emerald-500/10 text-emerald-400",
      icon: <CheckCircle className="w-5 h-5" />
    },
    warning: {
      card: "bg-amber-950/20 border-amber-500/20 text-amber-300 dark:text-amber-400",
      glow: "bg-amber-500",
      iconBg: "bg-amber-500/10 text-amber-400",
      icon: <Hourglass className="w-5 h-5 animate-pulse" />
    },
    critical: {
      card: "bg-rose-950/20 border-rose-500/20 text-rose-300 dark:text-rose-400",
      glow: "bg-rose-500",
      iconBg: "bg-rose-500/10 text-rose-400",
      icon: <AlertCircle className="w-5 h-5 animate-bounce" />
    }
  }[statusType] || {
    card: "bg-emerald-950/20 border-emerald-500/20 text-emerald-300 dark:text-emerald-400",
    glow: "bg-emerald-500",
    iconBg: "bg-emerald-500/10 text-emerald-400",
    icon: <CheckCircle className="w-5 h-5" />
  };

  return (
    <div className={cn(
      "w-full rounded-2xl border p-5 backdrop-blur-md transition-all duration-500 shadow-md relative overflow-hidden flex gap-4 items-start",
      styles.card
    )}>
      {/* Decorative background glow */}
      <div className={cn(
        "absolute -right-16 -top-16 w-36 h-36 rounded-full blur-3xl pointer-events-none opacity-20",
        styles.glow
      )} />

      <div className={cn(
        "p-2.5 rounded-xl flex-shrink-0 flex items-center justify-center shadow-inner",
        styles.iconBg
      )}>
        {styles.icon}
      </div>

      <div className="flex-1 space-y-2 text-sm md:text-base leading-relaxed">
        <p className="font-semibold tracking-wide">
          {status.delayNotice}
        </p>

        {status.lastCompleted && (
          <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5 flex-wrap">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
            Last delivered:{" "}
            <span className="font-bold text-foreground">
              Tracking #{status.lastCompleted.trackingId}
            </span>{" "}
            — placed at {status.lastCompleted.placedAt}, delivered at {status.lastCompleted.deliveredAt}
          </p>
        )}

        {status.checkingNow && (
          <div className="flex items-center gap-2 text-xs font-bold text-blue-500 dark:text-blue-400 animate-pulse mt-1">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" />
            Checking now: Tracking #{status.checkingNow.trackingId} works real time
          </div>
        )}
      </div>
    </div>
  );
}
