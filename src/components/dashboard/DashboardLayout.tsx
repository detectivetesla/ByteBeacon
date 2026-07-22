import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/api';
import Sidebar from './Sidebar';
import DashboardHeader from './DashboardHeader';
import BottomMobileNav from './BottomMobileNav';
import FloatingWhatsApp from '../FloatingWhatsApp';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface DashboardLayoutProps {
    children: React.ReactNode;
}

interface UserProfile {
    fullName: string;
    email: string;
    phone: string;
    walletBalance?: number;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
    const { user, role, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    // Check if we're on mobile
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
        if (!authLoading && !user) {
            navigate('/auth');
            return;
        }
        // Note: Admins can now access the user dashboard too
        // They have access to both /admin/* and /dashboard/* routes
    }, [user, authLoading, navigate]);

    const fetchProfile = useCallback(async () => {
        if (!user) return;

        try {
            const data = await api.get<{
                id: string;
                fullName: string;
                email: string;
                phone: string;
                walletBalance: number;
            }>('/users/profile');

            setProfile({
                fullName: data.fullName,
                email: data.email,
                phone: data.phone,
                walletBalance: data.walletBalance || 0,
            });
        } catch (err) {
            console.error('Error fetching profile:', err);
            // Use user data from auth context as fallback
            setProfile({
                fullName: user.fullName || 'User',
                email: user.email || '',
                phone: user.phone || '',
                walletBalance: user.walletBalance || 0,
            });
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (user) {
            fetchProfile();
        }
    }, [user, fetchProfile]);

    if (authLoading || loading) {
        return (
            <div className="min-h-screen bg-background flex flex-col lg:flex-row">
                {/* Sidebar Skeleton */}
                <div className="hidden lg:flex w-64 flex-col border-r border-border/40 p-4 space-y-6 bg-card/40">
                    <div className="flex items-center gap-3 px-2">
                        <Skeleton className="w-10 h-10 rounded-xl" />
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-28" />
                            <Skeleton className="h-3 w-16" />
                        </div>
                    </div>
                    <div className="space-y-3 pt-4">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <Skeleton key={i} className="h-10 w-full rounded-xl" />
                        ))}
                    </div>
                </div>

                {/* Main Content Area Skeleton */}
                <div className="flex-1 flex flex-col min-w-0">
                    {/* Header Skeleton */}
                    <div className="h-16 border-b border-border/40 px-6 flex items-center justify-between bg-card/20">
                        <Skeleton className="h-6 w-36 rounded-lg" />
                        <div className="flex items-center gap-3">
                            <Skeleton className="w-9 h-9 rounded-full" />
                            <Skeleton className="w-9 h-9 rounded-full" />
                            <Skeleton className="w-9 h-9 rounded-full" />
                        </div>
                    </div>

                    {/* Page Body Skeleton */}
                    <div className="p-4 md:p-6 space-y-6 flex-1">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Skeleton className="h-32 rounded-2xl" />
                            <Skeleton className="h-32 rounded-2xl" />
                            <Skeleton className="h-32 rounded-2xl" />
                        </div>
                        <Skeleton className="h-48 w-full rounded-2xl" />
                        <Skeleton className="h-64 w-full rounded-2xl" />
                    </div>
                </div>
            </div>
        );
    }

    const userName = profile?.fullName || user?.fullName || 'User';
    const userEmail = profile?.email || user?.email || '';

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
        <div className="min-h-screen bg-background">
            {/* Mobile overlay */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 z-30 bg-black/50 lg:hidden"
                    onClick={closeMobileMenu}
                />
            )}

            {/* Sidebar - hidden on mobile, shown as overlay when menu is open */}
            <div className={cn(
                "lg:block",
                isMobile ? (isMobileMenuOpen ? "block" : "hidden") : "block"
            )}>
                <Sidebar
                    isCollapsed={isMobile ? false : isCollapsed}
                    userName={userName}
                    userEmail={userEmail}
                    userRole={role}
                    onClose={closeMobileMenu}
                    isMobile={isMobile}
                />
            </div>

            {/* Main content */}
            <div className={cn(
                "transition-all duration-300",
                isMobile ? "ml-0" : (isCollapsed ? "ml-16" : "ml-64")
            )}>
                <DashboardHeader
                    userName={userName}
                    isSidebarCollapsed={isCollapsed}
                    onToggleSidebar={handleToggleSidebar}
                    isMobile={isMobile}
                />
                <main className={cn(
                    "p-4 md:p-6",
                    isMobile && "pb-24" // Extra padding for bottom nav
                )}>
                    {children}
                </main>
            </div>

            {/* Bottom Mobile Navigation */}
            <BottomMobileNav
                onMenuClick={handleToggleSidebar}
                userRole={role}
            />

            {/* Floating WhatsApp - different links for customer vs agent */}
            <FloatingWhatsApp
                link={role === 'agent'
                    ? 'https://chat.whatsapp.com/IKtOgWHTkXV7fRIB9LUXTW'
                    : 'https://chat.whatsapp.com/IXbpxXZMqjXE7FeWdqWqdW'
                }
            />
        </div>
    );
}

export { type UserProfile };
