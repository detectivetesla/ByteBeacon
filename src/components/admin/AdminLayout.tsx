import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { api } from '@/services/api';
import AdminSidebar from './AdminSidebar';
import AdminHeader from './AdminHeader';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface AdminLayoutProps {
    children: React.ReactNode;
}

interface AdminProfile {
    full_name: string;
    email: string;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
    const { user, role, loading: authLoading } = useAuth();
    const { theme, resolvedTheme } = useTheme();
    const navigate = useNavigate();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [profile, setProfile] = useState<AdminProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 1024);
            if (window.innerWidth >= 1024) {
                setIsMobileMenuOpen(false);
            }
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    useEffect(() => {
        // Only redirect if auth is done loading AND we have determined the role
        if (!authLoading && !user) {
            navigate('/admin/login');
            return;
        }

        // Wait until role is actually fetched before checking admin status
        // role will be null initially, then set to 'admin' or 'customer'
        if (!authLoading && user && role !== null && role !== 'admin') {
            navigate('/dashboard');
            return;
        }
    }, [user, role, authLoading, navigate]);

    const fetchProfile = useCallback(async () => {
        if (!user) return;

        try {
            const data = await api.get<{ fullName: string; email: string }>('/users/profile');
            setProfile({
                full_name: data.fullName || 'Admin',
                email: data.email || user.email || '',
            });
        } catch (err) {
            console.error('Error fetching profile:', err);
            // Use user data from auth context as fallback
            setProfile({
                full_name: user.fullName || 'Admin',
                email: user.email || '',
            });
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (user && role === 'admin') {
            fetchProfile();
        }
    }, [user, role, fetchProfile]);

    // Show loading if: auth is loading, profile is loading, or role hasn't been fetched yet for logged-in users
    if (authLoading || loading || (user && role === null)) {
        return (
            <div className="min-h-screen flex bg-background">
                {/* Sidebar skeleton */}
                <div className="hidden lg:flex flex-col w-64 border-r border-border p-4 space-y-6">
                    <Skeleton className="h-10 w-40" />
                    <div className="space-y-2">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <Skeleton key={i} className="h-10 w-full rounded-lg" />
                        ))}
                    </div>
                </div>
                {/* Content skeleton */}
                <div className="flex-1 p-6 space-y-6">
                    {/* Header bar */}
                    <div className="flex items-center justify-between">
                        <Skeleton className="h-8 w-48" />
                        <div className="flex items-center gap-3">
                            <Skeleton className="h-8 w-8 rounded-full" />
                            <Skeleton className="h-8 w-8 rounded-full" />
                            <Skeleton className="h-10 w-10 rounded-full" />
                        </div>
                    </div>
                    {/* Stats row */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="p-5 rounded-xl border border-border">
                                <Skeleton className="h-10 w-10 rounded-xl mb-4" />
                                <Skeleton className="h-8 w-24 mb-2" />
                                <Skeleton className="h-4 w-32" />
                            </div>
                        ))}
                    </div>
                    {/* Content area */}
                    <div className="rounded-xl border border-border p-6">
                        <Skeleton className="h-6 w-40 mb-4" />
                        <div className="space-y-3">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <Skeleton className="h-8 w-8 rounded-full" />
                                    <Skeleton className="h-4 w-48" />
                                    <div className="ml-auto"><Skeleton className="h-4 w-20" /></div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const adminName = profile?.full_name || 'Admin';
    const adminEmail = profile?.email || '';

    const handleToggleSidebar = () => {
        if (isMobile) {
            setIsMobileMenuOpen(!isMobileMenuOpen);
        } else {
            setIsCollapsed(!isCollapsed);
        }
    };

    const closeMobileMenu = () => {
        setIsMobileMenuOpen(false);
    };

    return (
        <div className={cn(
            "min-h-screen bg-background",
            resolvedTheme === 'dark' ? 'admin-dark' : 'admin-light'
        )}>
            {/* Mobile overlay */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 z-30 bg-black/50 lg:hidden"
                    onClick={closeMobileMenu}
                />
            )}

            {/* Sidebar */}
            <div className={cn(
                "lg:block",
                isMobile ? (isMobileMenuOpen ? "block" : "hidden") : "block"
            )}>
                <AdminSidebar
                    isCollapsed={isMobile ? false : isCollapsed}
                    adminName={adminName}
                    onClose={closeMobileMenu}
                    isMobile={isMobile}
                />
            </div>

            {/* Main content */}
            <div className={cn(
                "transition-all duration-300",
                isMobile ? "ml-0" : (isCollapsed ? "ml-16" : "ml-64")
            )}>
                <AdminHeader
                    adminName={adminName}
                    adminEmail={adminEmail}
                    isSidebarCollapsed={isCollapsed}
                    onToggleSidebar={handleToggleSidebar}
                    isMobile={isMobile}
                />
                <main className="p-4 md:p-6">
                    {children}
                </main>
            </div>
        </div>
    );
}
