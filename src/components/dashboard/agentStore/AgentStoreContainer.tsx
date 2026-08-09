import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { AgentStoreDashboard } from './AgentStoreDashboard';
import { AgentPricesPage } from './AgentPricesPage';
import { AgentOrdersPage } from './AgentOrdersPage';
import { AgentWalletPage } from './AgentWalletPage';
import { AgentAnalyticsPage } from './AgentAnalyticsPage';
import { AgentReportsPage } from './AgentReportsPage';
import { AgentTrackingPage } from './AgentTrackingPage';

export const AgentStoreContainer: React.FC = () => {
    return (
        <Routes>
            <Route path="/" element={<AgentStoreDashboard />} />
            <Route path="/prices" element={<AgentPricesPage />} />
            <Route path="/orders" element={<AgentOrdersPage />} />
            <Route path="/wallet" element={<AgentWalletPage />} />
            <Route path="/analytics" element={<AgentAnalyticsPage />} />
            <Route path="/reports" element={<AgentReportsPage />} />
            <Route path="/tracking" element={<AgentTrackingPage />} />
        </Routes>
    );
};

export default AgentStoreContainer;
