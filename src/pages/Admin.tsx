import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/admin/AdminLayout';
import AdminDashboard from '@/components/admin/AdminDashboard';
import AdminAnalyticsPage from '@/components/admin/AdminAnalyticsPage';
import AdminUsersPage from '@/components/admin/AdminUsersPage';
import AdminOrdersPage from '@/components/admin/AdminOrdersPage';
import AdminDataPlansPage from '@/components/admin/AdminDataPlansPage';
import AdminAgentsPage from '@/components/admin/AdminAgentsPage';
import AdminTransactionsPage from '@/components/admin/AdminTransactionsPage';
import AdminDiscountsPage from '@/components/admin/AdminDiscountsPage';
import AdminNetworksPage from '@/components/admin/AdminNetworksPage';
import AdminServicesPage from '@/components/admin/AdminServicesPage';
import AdminAPIPage from '@/components/admin/AdminAPIPage';
import AdminSendEmailPage from '@/components/admin/AdminSendEmailPage';
import AdminSettingsPage from '@/components/admin/AdminSettingsPage';
import AdminMessagesPage from '@/components/admin/AdminMessagesPage';
import AdminNotificationsPage from '@/components/admin/AdminNotificationsPage';
import AdminProfilePage from '@/components/admin/AdminProfilePage';
import AdminActivityLogsPage from '@/components/admin/AdminActivityLogsPage';
import AdminUserDetailPage from '@/components/admin/AdminUserDetailPage';
import { Loader2 } from 'lucide-react';

export default function Admin() {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f172a]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  // If not logged in, redirect to admin login
  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }

  // If not admin, redirect to user dashboard (wait for role to be loaded)
  if (role !== null && role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <AdminLayout>
      <Routes>
        <Route path="/" element={<AdminDashboard />} />
        <Route path="/analytics" element={<AdminAnalyticsPage />} />
        <Route path="/users" element={<AdminUsersPage />} />
        <Route path="/users/:id" element={<AdminUserDetailPage />} />
        <Route path="/orders" element={<AdminOrdersPage />} />
        <Route path="/orders/all" element={<AdminOrdersPage />} />
        <Route path="/orders/processing" element={<AdminOrdersPage />} />
        <Route path="/orders/completed" element={<AdminOrdersPage />} />
        <Route path="/orders/failed" element={<AdminOrdersPage />} />

        <Route path="/data-plans" element={<AdminDataPlansPage />} />
        <Route path="/agents" element={<AdminAgentsPage />} />
        <Route path="/transactions" element={<AdminTransactionsPage />} />
        <Route path="/discounts" element={<AdminDiscountsPage />} />
        <Route path="/networks" element={<AdminNetworksPage />} />
        <Route path="/services" element={<AdminServicesPage />} />
        <Route path="/api" element={<AdminAPIPage />} />
        <Route path="/email" element={<AdminSendEmailPage />} />
        <Route path="/settings" element={<AdminSettingsPage />} />
        <Route path="/messages" element={<AdminMessagesPage />} />
        <Route path="/notifications" element={<AdminNotificationsPage />} />
        <Route path="/profile" element={<AdminProfilePage />} />
        <Route path="/activity-logs" element={<AdminActivityLogsPage />} />
      </Routes>
    </AdminLayout>
  );
}