import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import DashboardHome from '@/components/dashboard/DashboardHome';
import WalletPage from '@/components/dashboard/WalletPage';
import DataBundlesPage from '@/components/dashboard/DataBundlesPage';
import OrdersPage from '@/components/dashboard/OrdersPage';
import TransactionsPage from '@/components/dashboard/TransactionsPage';
import DepositsPage from '@/components/dashboard/DepositsPage';
import SettingsPage from '@/components/dashboard/SettingsPage';
import ProfilePage from '@/components/dashboard/ProfilePage';
import MessagesPage from '@/components/dashboard/MessagesPage';
import NotificationsPage from '@/components/dashboard/NotificationsPage';
import ApplyAgentPage from '@/components/dashboard/ApplyAgentPage';
import PartnerConsole from '@/components/dashboard/PartnerConsole';
import DeveloperApiDocs from '@/components/dashboard/DeveloperApiDocs';
import DeveloperApiKeyManagement from '@/components/dashboard/DeveloperApiKeyManagement';
import AgentStoreUserContainer from '@/components/dashboard/agentStore/AgentStoreUserContainer';
import PendingMtnApprovalsPage from '@/components/dashboard/PendingMtnApprovalsPage';

// Route guard: only superagent and admin can access developer features
function SuperAgentGuard({ children }: { children: React.ReactNode }) {
  const { role } = useAuth();
  if (role === 'agent' || role === 'customer') {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

export default function Dashboard() {
  return (
    <DashboardLayout>
      <Routes>
        <Route path="/" element={<DashboardHome />} />
        <Route path="/agent-store/*" element={<AgentStoreUserContainer />} />
        <Route path="/wallet" element={<WalletPage />} />
        <Route path="/bundles/:network" element={<DataBundlesPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/orders/:status" element={<OrdersPage />} />
        <Route path="/transactions" element={<TransactionsPage />} />
        <Route path="/deposits" element={<DepositsPage />} />
        <Route path="/pending-mtn" element={<PendingMtnApprovalsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/apply-agent" element={<ApplyAgentPage />} />
        <Route path="/developer-api" element={<PartnerConsole />} />
        <Route path="/api-docs" element={<SuperAgentGuard><DeveloperApiDocs /></SuperAgentGuard>} />
        <Route path="/api-keys" element={<SuperAgentGuard><DeveloperApiKeyManagement /></SuperAgentGuard>} />
      </Routes>
    </DashboardLayout>
  );
}