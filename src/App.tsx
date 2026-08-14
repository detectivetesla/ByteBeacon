import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { MaintenanceProvider } from "@/contexts/MaintenanceContext";
import { MaintenanceBanner } from "@/components/common/MaintenanceFeedback";
import { SocketProvider } from "@/contexts/SocketContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Admin from "./pages/Admin";
import AdminLoginPage from "@/components/admin/AdminLoginPage";
import PaymentCallback from "./pages/PaymentCallback";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import NotFound from "./pages/NotFound";
import DeveloperPortal from "./pages/DeveloperPortal";
import PublicStorefront from "./pages/PublicStorefront";
import AgentStoreLayout from "@/components/dashboard/agentStore/AgentStoreLayout";
import { useState, useEffect } from "react";
import { useAuth } from "./contexts/AuthContext";

const queryClient = new QueryClient();

const AppWithMaintenance = () => {
  const { role } = useAuth();

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

  // Check domain context
  const hostname = window.location.hostname.toLowerCase();
  const isDeveloperSubdomain = hostname.startsWith('developers.');
  const isStorefrontDomainAccess = hostname.includes('apisolutions.store');

  if (isDeveloperSubdomain) {
    return (
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <MaintenanceBanner />
        <Routes>
          <Route path="*" element={<DeveloperPortal />} />
        </Routes>
      </BrowserRouter>
    );
  }

  // Domain-specific routing for apisolutions.store (Public Storefront platform)
  if (isStorefrontDomainAccess) {
    return (
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <MaintenanceBanner />
        <Routes>
          <Route path="/store/:slug" element={<PublicStorefront />} />
          <Route path="/" element={<PublicStorefront />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <MaintenanceBanner />
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/agent/login" element={<Auth />} />
        <Route path="/agent-auth" element={<Auth />} />
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
        {/* On main domain (bytebeacon.online), /store/:slug redirects to canonical storefront on apisolutions.store */}
        <Route
          path="/store/:slug"
          element={
            hostname.includes('bytebeacon.online') ? (
              <StorefrontRedirect />
            ) : (
              <PublicStorefront />
            )
          }
        />
        <Route path="/agent-store/*" element={<AgentStoreLayout />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
};

// Redirection component for old storefront URLs on bytebeacon.online
const StorefrontRedirect = () => {
  useEffect(() => {
    const storefrontBase = (import.meta.env.VITE_STOREFRONT_URL || 'https://apisolutions.store').replace(/\/$/, '');
    const currentPath = window.location.pathname;
    const searchParams = window.location.search;
    const targetUrl = `${storefrontBase}${currentPath}${searchParams}`;
    window.location.replace(targetUrl);
  }, []);

  return (
    <div className="min-h-screen bg-[#18191c] flex items-center justify-center text-slate-300 text-sm font-medium">
      Redirecting to public storefront...
    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ThemeProvider>
        <AuthProvider>
          <MaintenanceProvider>
            <SocketProvider>
              <Toaster />
              <Sonner />
              <AppWithMaintenance />
            </SocketProvider>
          </MaintenanceProvider>
        </AuthProvider>
      </ThemeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
