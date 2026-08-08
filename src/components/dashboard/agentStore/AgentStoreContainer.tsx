import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { AgentStoreDashboard } from './AgentStoreDashboard';
import { AgentPricesPage } from './AgentPricesPage';
import { AgentOrdersPage } from './AgentOrdersPage';
import { AgentAnalyticsPage } from './AgentAnalyticsPage';

export const AgentStoreContainer: React.FC = () => {
    return (
        <Routes>
            <Route path="/" element={<AgentStoreDashboard />} />
            <Route path="/prices" element={<AgentPricesPage />} />
            <Route path="/orders" element={<AgentOrdersPage />} />
            <Route path="/analytics" element={<AgentAnalyticsPage />} />
        </Routes>
    );
};

export default AgentStoreContainer;
