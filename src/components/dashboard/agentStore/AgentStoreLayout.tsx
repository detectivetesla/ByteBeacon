import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { agentStoreService, AgentStore } from '@/services/agentStore.service';
import { AgentStoreContainer } from './AgentStoreContainer';
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
    LogOut,
    ChevronRight,
    Sparkles
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
        { label: 'Agent Prices', href: '/agent-store/prices', icon: Tag },
        { label: 'Orders', href: '/agent-store/orders', icon: ShoppingCart },
        { label: 'Wallet & Profit', href: '/agent-store/wallet', icon: Wallet },
        { label: 'Analytics', href: '/agent-store/analytics', icon: TrendingUp },
        { label: 'Reports', href: '/agent-store/reports', icon: FileText },
        { label: 'Tracking', href: '/agent-store/tracking', icon: ShieldCheck },
    ];

    const isActive = (href: string, exact?: boolean) => {
        if (exact) {
            return location.pathname === href || location.pathname === href + '/';
        }
        return location.pathname.startsWith(href);
    };

    const getInitials = (name: string) => {
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

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
                "fixed inset-y-0 left-0 z-50 w-64 bg-[#18191c] border-r border-white/5 flex flex-col transition-transform duration-300 md:static md:translate-x-0",
                mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                {/* Store App Brand Header */}
                <div className="p-6 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-[#a3e635]/10 border border-[#a3e635]/30 flex items-center justify-center text-[#a3e635]">
                            <Store className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="font-black text-white text-base tracking-tight truncate max-w-[130px]">
                                {store?.store_name || 'Agent Store'}
                            </h2>
                            <p className="text-[10px] text-slate-400 font-medium">Reseller App Console</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setMobileMenuOpen(false)}
                        className="md:hidden text-slate-400 hover:text-white"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Store Status Indicator Card */}
                {store && (
                    <div className="mx-4 mt-4 p-3 bg-[#202227] rounded-2xl border border-white/5 space-y-1.5">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Store Status</span>
                            <span className={cn(
                                "px-2 py-0.5 rounded-full text-[10px] font-extrabold flex items-center gap-1",
                                store.effective_status === 'ACTIVE'
                                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                    : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                            )}>
                                <span className={cn(
                                    "w-1.5 h-1.5 rounded-full",
                                    store.effective_status === 'ACTIVE' ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
                                )} />
                                {store.effective_status === 'ACTIVE' ? 'Operational' : store.effective_status.replace(/_/g, ' ')}
                            </span>
                        </div>
                        <p className="text-xs font-bold text-white truncate">{store.store_name}</p>
                    </div>
                )}

                {/* Agent Store Nav Menu */}
                <nav className="flex-1 overflow-y-auto p-4 space-y-1">
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
                                    "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all",
                                    active
                                        ? "bg-[#a3e635] text-black shadow-md shadow-[#a3e635]/20 font-extrabold"
                                        : "text-slate-400 hover:text-white hover:bg-white/5"
                                )}
                            >
                                <Icon className="w-4 h-4" />
                                <span>{item.label}</span>
                            </Link>
                        );
                    })}

                    {store?.slug && (
                        <div className="pt-4 border-t border-white/5 mt-4 space-y-1">
                            <p className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Public Storefront</p>
                            <a
                                href={`/store/${store.slug}`}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-[#a3e635] bg-[#a3e635]/10 border border-[#a3e635]/20 hover:bg-[#a3e635]/20 transition-all"
                            >
                                <Globe className="w-4 h-4" />
                                <span className="truncate">View Public Shop</span>
                                <ExternalLink className="w-3.5 h-3.5 ml-auto" />
                            </a>
                        </div>
                    )}
                </nav>

                {/* Sidebar Footer: Return to Main ByteBeacon */}
                <div className="p-4 border-t border-white/5 space-y-2">
                    <Link
                        to="/dashboard"
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#202227] hover:bg-[#282a30] text-slate-300 hover:text-white border border-white/5 text-xs font-bold transition-all"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>ByteBeacon Dashboard</span>
                    </Link>
                </div>
            </aside>

            {/* Main Application Area */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Standalone Header Bar */}
                <header className="bg-[#18191c] border-b border-white/5 py-3 px-4 sm:px-6 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setMobileMenuOpen(true)}
                            className="md:hidden p-2 rounded-xl bg-[#202227] text-slate-400 hover:text-white border border-white/5"
                        >
                            <Menu className="w-5 h-5" />
                        </button>
                        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
                            <span className="font-bold text-white">Agent Store</span>
                            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                            <span className="text-[#a3e635] font-semibold">Console</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {store?.slug && (
                            <a
                                href={`/store/${store.slug}`}
                                target="_blank"
                                rel="noreferrer"
                                className="px-3.5 py-1.5 bg-[#a3e635] hover:bg-[#b5f73c] text-black font-extrabold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md shadow-[#a3e635]/20"
                            >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>+ Storefront Link</span>
                            </a>
                        )}

                        <Link
                            to="/dashboard"
                            className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#202227] text-slate-400 hover:text-white border border-white/5 text-xs font-semibold transition-all"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            <span>ByteBeacon Main</span>
                        </Link>

                        {/* User Profile Avatar */}
                        <div className="w-8 h-8 rounded-xl bg-[#a3e635]/20 text-[#a3e635] font-bold text-xs flex items-center justify-center border border-[#a3e635]/30">
                            {getInitials(user?.name || user?.email || 'AG')}
                        </div>
                    </div>
                </header>

                {/* Child Routes Container */}
                <main className="flex-1 overflow-y-auto">
                    <AgentStoreContainer />
                </main>
            </div>
        </div>
    );
};

export default AgentStoreLayout;
