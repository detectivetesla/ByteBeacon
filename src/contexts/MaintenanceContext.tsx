import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { adminService } from '@/services/admin.service';

export interface MaintenanceInfo {
    isMaintenance: boolean;
    title: string;
    message: string;
    estimatedEnd: string | null;
}

interface MaintenanceContextType extends MaintenanceInfo {
    loading: boolean;
    refreshMaintenance: () => Promise<void>;
}

const defaultMaintenance: MaintenanceInfo = {
    isMaintenance: false,
    title: "We're upgrading ByteBeacon",
    message: "A little maintenance is underway. You can still explore ByteBeacon, but account access and transactions are temporarily paused.",
    estimatedEnd: null
};

const MaintenanceContext = createContext<MaintenanceContextType>({
    ...defaultMaintenance,
    loading: true,
    refreshMaintenance: async () => {}
});

export const MaintenanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [maintenanceInfo, setMaintenanceInfo] = useState<MaintenanceInfo>(defaultMaintenance);
    const [loading, setLoading] = useState(true);

    const checkMaintenance = useCallback(async () => {
        try {
            const res = await adminService.getMaintenanceStatus();
            setMaintenanceInfo({
                isMaintenance: Boolean(res.maintenanceMode),
                title: res.title || defaultMaintenance.title,
                message: res.message || defaultMaintenance.message,
                estimatedEnd: res.estimatedEnd || null
            });
        } catch (err) {
            // Keep default on error without failing the app
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        checkMaintenance();
        // Check periodically every 60 seconds
        const interval = setInterval(checkMaintenance, 60000);
        return () => clearInterval(interval);
    }, [checkMaintenance]);

    return (
        <MaintenanceContext.Provider
            value={{
                ...maintenanceInfo,
                loading,
                refreshMaintenance: checkMaintenance
            }}
        >
            {children}
        </MaintenanceContext.Provider>
    );
};

export const useMaintenance = () => useContext(MaintenanceContext);
