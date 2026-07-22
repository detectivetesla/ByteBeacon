import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Admin from "./pages/Admin";
import AdminLoginPage from "@/components/admin/AdminLoginPage";
import PaymentCallback from "./pages/PaymentCallback";
import MaintenancePage from "./pages/MaintenancePage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import NotFound from "./pages/NotFound";
import DeveloperPortal from "./pages/DeveloperPortal";
import { useState, useEffect } from "react";
import { adminService } from "./services/admin.service";
import { useAuth } from "./contexts/AuthContext";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

const AppWithMaintenance = () => {
  const { role } = useAuth();
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [loading, setLoading] = useState(true);

  // Admin Security: Check for secret access code (persisted per session)
  const [hasSecretAccess, setHasSecretAccess] = useState(() => {
    // 1. Check sessionStorage (persists across redirects within the same tab)
    if (sessionStorage.getItem('adminSecretAccess') === 'true') {
      return true;
    }

    // 2. Check URL query parameter
    const params = new URLSearchParams(window.location.search);
    const secretFromUrl = params.get('secret');
    // Also check for standalone secret (e.g. ?martin2005)
    const firstParam = window.location.search.substring(1).split('&')[0];

    const systemSecret = import.meta.env.VITE_ADMIN_SECRET_CODE || 'martin2005';

    const hasSecret = (secretFromUrl === systemSecret || firstParam === systemSecret);
    if (hasSecret) {
      sessionStorage.setItem('adminSecretAccess', 'true');
    }

    return hasSecret;
  });


  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const secretFromUrl = params.get('secret');
    const systemSecret = import.meta.env.VITE_ADMIN_SECRET_CODE || 'martin2005';

    if (secretFromUrl === systemSecret) {
      // Remove secret from URL for cleanliness but keep the path
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    const checkMaintenance = async () => {
      try {
        const { maintenanceMode } = await adminService.getMaintenanceStatus();
        setIsMaintenance(maintenanceMode);
      } catch (err) {
        console.error('Maintenance check failed:', err);
      } finally {
        setLoading(false);
      }
    };
    checkMaintenance();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f172a]">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  // If maintenance is active AND user is not admin AND we're not on the admin login page
  const isAdminPath = window.location.pathname.startsWith('/admin');
  const showMaintenance = isMaintenance && role !== 'admin' && !isAdminPath;

  if (showMaintenance) {
    return <MaintenancePage />;
  }

  // Check if developers subdomain is accessed
  const isDeveloperSubdomain = window.location.hostname.startsWith('developers.');

  if (isDeveloperSubdomain) {
    return (
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="*" element={<DeveloperPortal />} />
        </Routes>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
        <Route path="/dashboard/*" element={<Dashboard />} />
        <Route
          path="/admin/login"
          element={(hasSecretAccess || role === 'admin') ? <AdminLoginPage /> : <Navigate to="/" replace />}
        />
        <Route path="/admin/*" element={<Admin />} />
        <Route path="/payment-callback" element={<PaymentCallback />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms-of-service" element={<TermsOfService />} />
        <Route path="/developers" element={<DeveloperPortal />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
};

import { SocketProvider } from "@/contexts/SocketContext";

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ThemeProvider>
        <AuthProvider>
          <SocketProvider>
            <Toaster />
            <Sonner />
            <AppWithMaintenance />
          </SocketProvider>
        </AuthProvider>
      </ThemeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
