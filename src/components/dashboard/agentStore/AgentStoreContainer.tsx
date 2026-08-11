import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AgentStoreDashboard } from './AgentStoreDashboard';
import { AgentPricesPage } from './AgentPricesPage';
import { AgentOrdersPage } from './AgentOrdersPage';
import { AgentWalletPage } from './AgentWalletPage';
import { AgentAnalyticsPage } from './AgentAnalyticsPage';
import { AgentCustomersPage } from './AgentCustomersPage';
import { AgentSettingsPage } from './AgentSettingsPage';

export const AgentStoreContainer: React.FC = () => {
    return (
        <Routes>
            <Route path="/" element={<AgentStoreDashboard />} />
            <Route path="/products" element={<AgentPricesPage />} />
            <Route path="/prices" element={<Navigate to="/agent-store/products" replace />} />
            <Route path="/orders" element={<AgentOrdersPage />} />
            <Route path="/tracking" element={<Navigate to="/agent-store/orders" replace />} />
            <Route path="/wallet" element={<AgentWalletPage />} />
            <Route path="/customers" element={<AgentCustomersPage />} />
            <Route path="/analytics" element={<AgentAnalyticsPage />} />
            <Route path="/reports" element={<Navigate to="/agent-store/analytics" replace />} />
            <Route path="/settings" element={<AgentSettingsPage />} />
        </Routes>
    );
};

export default AgentStoreContainer;
