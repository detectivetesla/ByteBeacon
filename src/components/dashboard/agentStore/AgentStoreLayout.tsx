import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { agentStoreService, AgentStore } from '@/services/agentStore.service';
import { AgentStoreContainer } from './AgentStoreContainer';
import { AgentNotificationCenter } from './AgentNotificationCenter';
import {
    Store,
    BarChart3,
    Tag,
    ShoppingCart,
    Wallet,
    TrendingUp,
    FileText,
    ShieldCheck,
    ArrowLeft,
    ExternalLink,
    Menu,
    X,
    Search,
    Bell,
    CheckCircle2,
    Clock,
    Globe,
    AlertCircle,
    ChevronRight,
    RefreshCw,
    Users,
    Settings,
    UserCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const AgentStoreLayout: React.FC = () => {
    const { user, signOut } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    const [store, setStore] = useState<AgentStore | null>(null);
    const [hasStore, setHasStore] = useState<boolean>(false);
    const [loading, setLoading] = useState(true);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const loadStore = async () => {
        setLoading(true);
        try {
            const res = await agentStoreService.getMyStore();
            if (res.success && res.hasStore && res.store) {
                setStore(res.store);
                setHasStore(true);
            } else {
                setHasStore(false);
            }
        } catch (err) {
            console.error('Error fetching store in AgentStoreLayout:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadStore();
    }, []);

    const navItems = [
        { label: 'Overview', href: '/agent-store', icon: BarChart3, exact: true },
        { label: 'Products & Prices', href: '/agent-store/products', icon: Tag },
        { label: 'Orders', href: '/agent-store/orders', icon: ShoppingCart },
        { label: 'Wallet', href: '/agent-store/wallet', icon: Wallet },
        { label: 'Customers', href: '/agent-store/customers', icon: Users },
        { label: 'Analytics', href: '/agent-store/analytics', icon: TrendingUp },
        { label: 'Store Settings', href: '/agent-store/settings', icon: Settings },
    ];

    if (user?.role === 'SUPERAGENT' || user?.role === 'ADMIN') {
        navItems.splice(5, 0, { label: 'Sub-Agents', href: '/agent-store/agents', icon: UserCheck });
    }

    const isActive = (href: string, exact?: boolean) => {
        if (exact) {
            return location.pathname === href || location.pathname === href + '/';
        }
        return location.pathname.startsWith(href);
    };

    const getInitials = (name: string) => {
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    // Fullscreen Loading State
    if (loading) {
        return (
            <div className="min-h-screen bg-[#141518] text-white flex flex-col items-center justify-center space-y-4 p-4 font-sans">
                <RefreshCw className="w-8 h-8 animate-spin text-[#a3e635]" />
                <p className="text-sm font-bold text-slate-300 tracking-wide">Verifying Agent Store Authorization...</p>
            </div>
        );
    }

    // STRICT ROUTE GUARD & ACCESS CONTROL SCREEN:
    // Only users with an ACTIVE Agent Store are permitted inside operational /agent-store/* sub-routes.
    // If the user has no store, or their store is PENDING_REVIEW, AWAITING_ACTIVATION, SUSPENDED, or REJECTED,
    // deny operational dashboard access and present an explicit status screen with the correct primary action!
    if (!hasStore || !store || store.effective_status !== 'ACTIVE') {
        const status = store ? store.effective_status : 'NO_STORE';

        return (
            <div className="min-h-screen bg-[#141518] text-white font-sans flex flex-col justify-between p-4 sm:p-8 selection:bg-[#a3e635] selection:text-black">
                {/* Header */}
                <header className="max-w-4xl w-full mx-auto flex items-center justify-between py-4 border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-[#a3e635]/10 border border-[#a3e635]/30 flex items-center justify-center text-[#a3e635]">
                            <Store className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-lg font-black text-white tracking-tight">Agent Store Portal</h1>
                            <p className="text-[11px] text-slate-400">Authorization Console</p>
                        </div>
                    </div>
                    <Link
                        to="/dashboard"
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#202227] hover:bg-[#282a30] text-slate-300 text-xs font-bold border border-white/10 transition-all"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" /> ByteBeacon Dashboard
                    </Link>
                </header>

                {/* Center Access Status Card */}
                <main className="flex-1 flex items-center justify-center py-12 px-4">
                    <div className="max-w-md w-full bg-[#202227] border border-white/10 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl text-center">
                        {status === 'NO_STORE' && (
                            <>
                                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
                                    <AlertCircle className="w-7 h-7" />
                                </div>
                                <div className="space-y-2">
                                    <h2 className="text-2xl font-black text-white">No Agent Store Found</h2>
                                    <p className="text-xs text-slate-400 leading-relaxed">
                                        You do not currently have an active Agent Store associated with this account. Create or activate your Agent Store to access this dashboard.
                                    </p>
                                </div>
                                <div className="pt-2 flex flex-col gap-3">
                                    <Link
                                        to="/dashboard/agent-store"
                                        className="w-full py-3.5 bg-[#a3e635] hover:bg-[#b5f73c] text-black font-extrabold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#a3e635]/20"
                                    >
                                        <Store className="w-4 h-4" /> Create Agent Store
                                    </Link>
                                    <Link
                                        to="/dashboard"
                                        className="w-full py-3 bg-[#18191c] hover:bg-[#26282e] text-slate-300 font-bold rounded-xl text-xs border border-white/10 transition-all"
                                    >
                                        Return to ByteBeacon
                                    </Link>
                                </div>
                            </>
                        )}

                        {status === 'PENDING_REVIEW' && (
                            <>
                                <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 mx-auto">
                                    <Clock className="w-7 h-7" />
                                </div>
                                <div className="space-y-2">
                                    <h2 className="text-2xl font-black text-white">Store Under Administrative Review</h2>
                                    <p className="text-xs text-slate-400 leading-relaxed">
                                        Your Agent Store <strong className="text-white">"{store?.store_name}"</strong> has been created and is currently undergoing administrative verification. You will be notified once it has been approved.
                                    </p>
                                </div>
                                <div className="pt-2 flex flex-col gap-3">
                                    <Link
                                        to="/dashboard/agent-store"
                                        className="w-full py-3.5 bg-[#a3e635] hover:bg-[#b5f73c] text-black font-extrabold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#a3e635]/20"
                                    >
                                        View Application Status
                                    </Link>
                                    <Link
                                        to="/dashboard"
                                        className="w-full py-3 bg-[#18191c] hover:bg-[#26282e] text-slate-300 font-bold rounded-xl text-xs border border-white/10 transition-all"
                                    >
                                        Return to ByteBeacon
                                    </Link>
                                </div>
                            </>
                        )}

                        {status === 'AWAITING_ACTIVATION' && (
                            <>
                                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
                                    <CheckCircle2 className="w-7 h-7" />
                                </div>
                                <div className="space-y-2">
                                    <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-extrabold uppercase tracking-wider">
                                        Approved • Activation Pending
                                    </span>
                                    <h2 className="text-2xl font-black text-white">Store Activation Required</h2>
                                    <p className="text-xs text-slate-400 leading-relaxed">
                                        Your Agent Store <strong className="text-white">"{store?.store_name}"</strong> is approved! Pay the one-time GHS 100.00 store activation fee to enable sales and open your reseller dashboard.
                                    </p>
                                    <div className="p-3 bg-[#18191c] rounded-2xl border border-white/5 flex items-center justify-between text-xs mt-2">
                                        <span className="text-slate-400 font-semibold">One-Time Activation Fee</span>
                                        <span className="text-base font-black text-[#a3e635]">GHS 100.00</span>
                                    </div>
                                </div>
                                <div className="pt-2 flex flex-col gap-3">
                                    <Link
                                        to="/dashboard/agent-store"
                                        className="w-full py-3.5 bg-[#a3e635] hover:bg-[#b5f73c] text-black font-extrabold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#a3e635]/20"
                                    >
                                        Activate Store Now (GHS 100.00)
                                    </Link>
                                    <Link
                                        to="/dashboard"
                                        className="w-full py-3 bg-[#18191c] hover:bg-[#26282e] text-slate-300 font-bold rounded-xl text-xs border border-white/10 transition-all"
                                    >
                                        Pay Later • Return to ByteBeacon
                                    </Link>
                                </div>
                            </>
                        )}

                        {status === 'SUSPENDED' && (
                            <>
                                <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
                                    <ShieldCheck className="w-7 h-7" />
                                </div>
                                <div className="space-y-2">
                                    <h2 className="text-2xl font-black text-white">Agent Store Suspended</h2>
                                    <p className="text-xs text-slate-400 leading-relaxed">
                                        Your Agent Store <strong className="text-white">"{store?.store_name}"</strong> has been temporarily suspended. Operational controls are disabled. Please contact customer support for resolution.
                                    </p>
                                </div>
                                <div className="pt-2 flex flex-col gap-3">
                                    <a
                                        href="https://wa.me/233000000000"
                                        target="_blank"
                                        rel="noreferrer"
                                        className="w-full py-3.5 bg-rose-500 hover:bg-rose-600 text-white font-extrabold rounded-xl text-xs flex items-center justify-center gap-2 transition-all"
                                    >
                                        Contact Support
                                    </a>
                                    <Link
                                        to="/dashboard"
                                        className="w-full py-3 bg-[#18191c] hover:bg-[#26282e] text-slate-300 font-bold rounded-xl text-xs border border-white/10 transition-all"
                                    >
                                        Return to ByteBeacon
                                    </Link>
                                </div>
                            </>
                        )}
                    </div>
                </main>

                <footer className="max-w-4xl w-full mx-auto py-4 text-center text-[11px] text-slate-600 border-t border-white/5">
                    © {new Date().getFullYear()} ByteBeacon Agent Store Authorization System
                </footer>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#141518] text-white font-sans flex flex-col md:flex-row selection:bg-[#a3e635] selection:text-black">
            {/* Sidebar Overlay for Mobile */}
            {mobileMenuOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm md:hidden"
                    onClick={() => setMobileMenuOpen(false)}
                />
            )}

            {/* Standalone Sidebar Navigation */}
            <aside className={cn(
                "fixed inset-y-0 left-0 z-50 w-[min(18rem,85vw)] md:w-64 bg-[#18191c] border-r border-white/5 flex flex-col transition-transform duration-300 md:static md:translate-x-0 shadow-2xl md:shadow-none",
                mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                {/* Store App Brand Header */}
                <div className="p-4 sm:p-5 border-b border-white/5 flex items-center justify-between gap-2 min-w-0">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-2xl bg-[#a3e635]/10 border border-[#a3e635]/30 flex items-center justify-center text-[#a3e635] shrink-0">
                            <Store className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <h2 className="font-black text-white text-sm sm:text-base tracking-tight truncate">
                                {store?.store_name || 'Agent Store'}
                            </h2>
                            <p className="text-[10px] text-slate-400 font-medium truncate">Reseller App Console</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setMobileMenuOpen(false)}
                        className="md:hidden p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-all shrink-0"
                        aria-label="Close navigation menu"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Store Status Indicator Card */}
                {store && (
                    <div className="mx-3.5 mt-3.5 p-3 bg-[#202227] rounded-2xl border border-white/5 space-y-1.5 min-w-0">
                        <div className="flex items-center justify-between flex-wrap gap-1">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Store Status</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold flex items-center gap-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                Operational
                            </span>
                        </div>
                        <p className="text-xs font-bold text-white truncate max-w-full">{store.store_name}</p>
                    </div>
                )}

                {/* Agent Store Nav Menu */}
                <nav className="flex-1 overflow-y-auto p-3.5 space-y-1 min-w-0">
                    <p className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Management</p>
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const active = isActive(item.href, item.exact);
                        return (
                            <Link
                                key={item.href}
                                to={item.href}
                                onClick={() => setMobileMenuOpen(false)}
                                className={cn(
                                    "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all min-w-0",
                                    active
                                        ? "bg-[#a3e635] text-black shadow-md shadow-[#a3e635]/20 font-extrabold"
                                        : "text-slate-400 hover:text-white hover:bg-white/5"
                                )}
                            >
                                <Icon className="w-4 h-4 shrink-0" />
                                <span className="truncate">{item.label}</span>
                            </Link>
                        );
                    })}

                    {store?.slug && (
                        <div className="pt-3.5 border-t border-white/5 mt-3.5 space-y-1 min-w-0">
                            <p className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Public Storefront</p>
                            <a
                                href={`/store/${store.slug}`}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-[#a3e635] bg-[#a3e635]/10 border border-[#a3e635]/20 hover:bg-[#a3e635]/20 transition-all min-w-0"
                            >
                                <Globe className="w-4 h-4 shrink-0" />
                                <span className="truncate">View Public Shop</span>
                                <ExternalLink className="w-3.5 h-3.5 ml-auto shrink-0" />
                            </a>
                        </div>
                    )}
                </nav>

                {/* Sidebar Footer: Return to Main ByteBeacon */}
                <div className="p-3.5 border-t border-white/5 space-y-2 shrink-0">
                    <Link
                        to="/dashboard"
                        className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#202227] hover:bg-[#282a30] text-slate-300 hover:text-white border border-white/5 text-xs font-bold transition-all min-w-0"
                    >
                        <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">ByteBeacon Dashboard</span>
                    </Link>
                </div>
            </aside>

            {/* Main Application Area */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden w-full">
                {/* Standalone Header Bar */}
                <header className="bg-[#18191c] border-b border-white/5 py-3 px-3.5 sm:px-6 flex items-center justify-between gap-3 min-w-0 w-full">
                    <div className="flex items-center gap-3 shrink-0">
                        <button
                            onClick={() => setMobileMenuOpen(true)}
                            className="md:hidden p-2 rounded-xl bg-[#202227] text-slate-400 hover:text-white border border-white/5 shrink-0"
                            aria-label="Open navigation menu"
                        >
                            <Menu className="w-5 h-5" />
                        </button>
                        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
                            <span className="font-bold text-white">Agent Store</span>
                            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                            <span className="text-[#a3e635] font-semibold">Console</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
                        {store?.slug && (
                            <a
                                href={`/store/${store.slug}`}
                                target="_blank"
                                rel="noreferrer"
                                className="px-3.5 py-1.5 bg-[#a3e635] hover:bg-[#b5f73c] text-black font-extrabold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md shadow-[#a3e635]/20 whitespace-nowrap shrink-0"
                            >
                                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                                <span className="hidden sm:inline">+ Storefront Link</span>
                                <span className="sm:hidden">Store</span>
                            </a>
                        )}

                        <Link
                            to="/dashboard"
                            className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#202227] text-slate-400 hover:text-white border border-white/5 text-xs font-semibold transition-all whitespace-nowrap shrink-0"
                        >
                            <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
                            <span>ByteBeacon Main</span>
                        </Link>

                        {/* In-App Notification Center */}
                        <AgentNotificationCenter />

                        {/* User Profile Avatar */}
                        <div className="w-8 h-8 rounded-xl bg-[#a3e635]/20 text-[#a3e635] font-bold text-xs flex items-center justify-center border border-[#a3e635]/30 shrink-0">
                            {getInitials(user?.name || user?.email || 'AG')}
                        </div>
                    </div>
                </header>

                {/* Child Routes Container */}
                <main className="flex-1 overflow-y-auto min-w-0 w-full">
                    <AgentStoreContainer />
                </main>
            </div>
        </div>
    );
};

export default AgentStoreLayout;
