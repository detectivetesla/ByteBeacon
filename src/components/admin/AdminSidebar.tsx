import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
    LayoutDashboard,
    BarChart3,
    Users,
    ShoppingCart,
    Database,
    UserCog,
    Receipt,
    Percent,
    Wifi,
    Settings,
    Code,
    Mail,
    LogOut,
    ChevronDown,
    ChevronLeft,
    X,
    Activity,
    Store,
    ShieldAlert
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/services';
import { PremiumIcon, PremiumIconVariant } from '../ui/PremiumIcon';

interface AdminSidebarProps {
    isCollapsed: boolean;
    adminName: string;
    onClose?: () => void;
    isMobile?: boolean;
}

interface NavSubItem {
    label: string;
    href: string;
}

interface NavItem {
    icon: React.ElementType;
    label: string;
    href: string;
    variant: PremiumIconVariant;
    subItems?: NavSubItem[];
    showBadge?: boolean;
}

interface NavSection {
    title: string;
    items: NavItem[];
}

const navSections: NavSection[] = [
    {
        title: 'GENERAL',
        items: [
            { icon: LayoutDashboard, label: 'Dashboard', href: '/admin', variant: 'violet' },
            { icon: BarChart3, label: 'Analytics', href: '/admin/analytics', variant: 'emerald' },
        ]
    },
    {
        title: 'MANAGEMENT',
        items: [
            { icon: Users, label: 'Users', href: '/admin/users', variant: 'amber' },
            { 
                icon: ShoppingCart, 
                label: 'Orders', 
                href: '/admin/orders', 
                variant: 'rose',
                subItems: [
                    { label: 'All Orders', href: '/admin/orders/all' },
                    { label: 'MTN Orders', href: '/admin/orders/mtn' },
                    { label: 'AT Orders', href: '/admin/orders/at' },
                    { label: 'Telecel Orders', href: '/admin/orders/telecel' }
                ]
            },
            { icon: ShieldAlert, label: 'Pending MTN Approval', href: '/admin/mtn-approvals', variant: 'amber', showBadge: true },
            { icon: Database, label: 'Data Plans', href: '/admin/data-plans', variant: 'blue' },
            { icon: UserCog, label: 'Resellers/Agents', href: '/admin/agents', variant: 'indigo' },
            { icon: Store, label: 'Agent Stores', href: '/admin/agent-stores', variant: 'emerald' },
        ]
    },
    {
        title: 'FINANCE',
        items: [
            { icon: Receipt, label: 'Transactions', href: '/admin/transactions', variant: 'cyan' },
            { icon: Percent, label: 'Discounts', href: '/admin/discounts', variant: 'amber' },
        ]
    },
    {
        title: 'SYSTEM',
        items: [
            { icon: Activity, label: 'Activity Logs', href: '/admin/activity-logs', variant: 'rose' },
            { icon: Wifi, label: 'Networks', href: '/admin/networks', variant: 'blue' },
            { icon: Settings, label: 'Services', href: '/admin/services', variant: 'violet' },
            { icon: Code, label: 'API Settings', href: '/admin/api', variant: 'emerald' },
        ]
    },
    {
        title: 'COMMUNICATION',
        items: [
            { icon: Mail, label: 'Send Email', href: '/admin/email', variant: 'indigo' },
            { icon: Settings, label: 'Settings', href: '/admin/settings', variant: 'amber' },
        ]
    }
];

export default function AdminSidebar({ isCollapsed, adminName, onClose, isMobile }: AdminSidebarProps) {
    const location = useLocation();
    const navigate = useNavigate();
    const { signOut } = useAuth();
    const [expanded, setExpanded] = useState<Record<string, boolean>>({
        'Orders': true
    });
    const [pendingMtnCount, setPendingMtnCount] = useState<number>(0);

    useEffect(() => {
        const fetchPendingCount = async () => {
            try {
                const res = await api.get<{ success: boolean; count: number }>('/admin/mtn-approvals/count');
                if (res.success) {
                    setPendingMtnCount(res.count || 0);
                }
            } catch (err) {
                // Ignore silent fetch errors
            }
        };
        fetchPendingCount();
        const interval = setInterval(fetchPendingCount, 30000); // 30s polling
        return () => clearInterval(interval);
    }, []);

    const handleSignOut = async () => {
        await signOut();
        navigate('/');
    };

    const isActive = (href: string) => {
        if (href === '/admin') {
            return location.pathname === '/admin';
        }
        return location.pathname.startsWith(href);
    };

    const toggleExpand = (label: string) => {
        setExpanded(prev => ({ ...prev, [label]: !prev[label] }));
    };

    const handleNavClick = () => {
        if (isMobile && onClose) {
            onClose();
        }
    };

    return (
        <aside
            className={cn(
                "fixed left-0 top-0 z-40 h-screen bg-background border-r border-border",
                "transition-all duration-300 flex flex-col",
                isCollapsed ? "w-16" : "w-64"
            )}
        >
            {/* Logo Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
                <div className="flex items-center gap-2">
                    <img
                        src="/logo.png"
                        alt="ByteBeacon"
                        className={cn(
                            "object-contain transition-all duration-300",
                            isCollapsed ? "h-9 w-9" : "h-10 w-auto"
                        )}
                    />
                    {!isCollapsed && (
                        <p className="text-xs text-muted-foreground">Super Admin</p>
                    )}
                </div>
                {!isCollapsed && (
                    <button className="text-muted-foreground hover:text-foreground transition-colors">
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                )}
                {isMobile && onClose && (
                    <button onClick={onClose} className="p-1 rounded hover:bg-accent transition-colors lg:hidden">
                        <X className="w-5 h-5 text-muted-foreground" />
                    </button>
                )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-4 px-2">
                {navSections.map((section) => (
                    <div key={section.title} className="mb-4">
                        {!isCollapsed && (
                            <p className="px-3 mb-2 text-xs font-medium text-muted-foreground/60 uppercase tracking-wider">
                                {section.title}
                            </p>
                        )}
                        <div className="space-y-1">
                            {section.items.map((item) => {
                                const hasSubItems = item.subItems && item.subItems.length > 0;
                                const isItemActive = isActive(item.href);

                                return (
                                    <div key={item.label} className="space-y-1">
                                        {hasSubItems ? (
                                            <>
                                                <button
                                                    onClick={() => toggleExpand(item.label)}
                                                    className={cn(
                                                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium group/item",
                                                        "transition-all duration-300 ease-in-out",
                                                        isItemActive
                                                            ? "bg-primary/10 text-primary border border-primary/20"
                                                            : "text-muted-foreground hover:text-primary hover:bg-primary/5",
                                                        isCollapsed && "justify-center px-1"
                                                    )}
                                                >
                                                    <PremiumIcon
                                                        icon={item.icon}
                                                        variant={item.variant}
                                                        showBackground={isItemActive}
                                                        size="sm"
                                                    />
                                                    {!isCollapsed && (
                                                        <>
                                                            <span className="flex-1 text-left">{item.label}</span>
                                                            <ChevronDown 
                                                                className={cn(
                                                                    "w-4 h-4 transition-transform duration-200 text-muted-foreground/75 group-hover/item:text-primary",
                                                                    expanded[item.label] && "rotate-180 text-primary"
                                                                )} 
                                                            />
                                                        </>
                                                    )}
                                                </button>
                                                {!isCollapsed && expanded[item.label] && (
                                                    <div className="pl-6 space-y-1 mt-1 border-l border-border/60 ml-5">
                                                        {item.subItems?.map((sub) => {
                                                            const isSubActive = location.pathname === sub.href;
                                                            return (
                                                                <Link
                                                                    key={sub.href}
                                                                    to={sub.href}
                                                                    onClick={handleNavClick}
                                                                    className={cn(
                                                                        "block px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200",
                                                                        isSubActive
                                                                            ? "text-primary bg-primary/10 shadow-sm border border-primary/25"
                                                                            : "text-muted-foreground hover:text-primary hover:bg-primary/5"
                                                                    )}
                                                                >
                                                                    {sub.label}
                                                                </Link>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <Link
                                                to={item.href}
                                                onClick={handleNavClick}
                                                className={cn(
                                                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium group/item",
                                                    "transition-all duration-300 ease-in-out",
                                                    isItemActive
                                                        ? "bg-primary/10 text-primary shadow-sm border border-primary/20"
                                                        : "text-muted-foreground hover:text-primary hover:bg-primary/5 hover:translate-x-1",
                                                    isCollapsed && "justify-center px-1"
                                                )}
                                            >
                                                <PremiumIcon
                                                    icon={item.icon}
                                                    variant={item.variant}
                                                    showBackground={isItemActive}
                                                    size="sm"
                                                    className={cn(
                                                        "transition-all duration-300",
                                                        !isItemActive && "group-hover:translate-x-1"
                                                    )}
                                                />
                                                 {!isCollapsed && (
                                                     <span className="relative flex-1 flex items-center justify-between">
                                                         <span>{item.label}</span>
                                                         {item.showBadge && pendingMtnCount > 0 && (
                                                             <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-black shadow-sm">
                                                                 {pendingMtnCount}
                                                             </span>
                                                         )}
                                                         {isItemActive && (
                                                             <div className="absolute -left-12 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-primary rounded-full" />
                                                         )}
                                                     </span>
                                                 )}
                                            </Link>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </nav>

            {/* Logout Button */}
            <div className="p-2 border-t border-border">
                <button
                    onClick={handleSignOut}
                    className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium",
                        "transition-all duration-200 ease-in-out",
                        "text-red-500 hover:bg-red-500/10",
                        isCollapsed && "justify-center px-2"
                    )}
                >
                    <LogOut className="w-5 h-5 flex-shrink-0" />
                    {!isCollapsed && <span>Logout</span>}
                </button>
            </div>
        </aside>
    );
}

