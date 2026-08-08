import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
    LayoutDashboard,
    Wallet,
    Package,
    ShoppingCart,
    Receipt,
    CreditCard,
    Settings,
    LogOut,
    ChevronDown,
    X,
    UserPlus,
    Code,
    BookOpen,
    Key,
    Store
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PremiumIcon, PremiumIconVariant } from '../ui/PremiumIcon';

interface SidebarProps {
    isCollapsed: boolean;
    userName: string;
    userEmail: string;
    userRole?: 'customer' | 'agent' | 'superagent' | 'admin' | null;
    onClose?: () => void;
    isMobile?: boolean;
}

interface NavItem {
    icon: React.ElementType;
    label: string;
    href?: string;
    variant?: PremiumIconVariant;
    subItems?: { label: string; href: string; badge?: string }[];
    showForRoles?: ('customer' | 'agent' | 'superagent')[];
    divider?: boolean;
}

const getNavItems = (userRole: string | null | undefined): NavItem[] => {
    const baseItems: NavItem[] = [
        { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard', variant: 'violet' },
        { icon: Store, label: 'Agent Store', href: '/dashboard/agent-store', variant: 'emerald' },
        { icon: Wallet, label: 'Wallet', href: '/dashboard/wallet', variant: 'emerald' },
        {
            icon: Package,
            label: 'Data Bundles',
            variant: 'amber',
            subItems: [
                { label: 'MTN', href: '/dashboard/bundles/mtn', badge: 'MTN' },
                { label: 'Telecel', href: '/dashboard/bundles/telecel', badge: 'TC' },
                { label: 'AirtelTigo', href: '/dashboard/bundles/airteltigo', badge: 'AT' },
            ]
        },
        {
            icon: ShoppingCart,
            label: 'Orders',
            variant: 'rose',
            subItems: [
                { label: 'All Orders', href: '/dashboard/orders' },
                { label: 'Processing', href: '/dashboard/orders/processing' },
                { label: 'Completed', href: '/dashboard/orders/completed' },
            ]
        },
        { icon: Receipt, label: 'Transactions', href: '/dashboard/transactions', variant: 'blue' },
        { icon: CreditCard, label: 'Deposits', href: '/dashboard/deposits', variant: 'indigo' },
    ];

    // Add role-specific items
    if (userRole === 'agent' || userRole === 'superagent') {
        baseItems.push({
            icon: BookOpen,
            label: "API Docs",
            href: '/dashboard/api-docs',
            variant: 'cyan',
            divider: true,
        });
        baseItems.push({
            icon: Key,
            label: "API Keys",
            href: '/dashboard/api-keys',
            variant: 'indigo',
        });
    } else {
        baseItems.push({
            icon: UserPlus,
            label: 'Apply for Super Agency',
            href: '/dashboard/apply-agent',
            variant: 'violet',
        });
    }

    baseItems.push({ icon: Settings, label: 'Settings', href: '/dashboard/settings', variant: 'amber' });

    return baseItems;
};

export default function Sidebar({ isCollapsed, userName, userEmail, userRole, onClose, isMobile }: SidebarProps) {
    const location = useLocation();
    const navigate = useNavigate();
    const { signOut } = useAuth();
    const [expandedItems, setExpandedItems] = useState<string[]>(['Data Bundles', 'Orders']);

    const navItems = getNavItems(userRole);

    const handleSignOut = async () => {
        await signOut();
        navigate('/');
    };

    const toggleExpanded = (label: string) => {
        setExpandedItems(prev =>
            prev.includes(label)
                ? prev.filter(item => item !== label)
                : [...prev, label]
        );
    };

    const isActive = (href?: string) => {
        if (!href) return false;
        if (href === '/dashboard') return location.pathname === '/dashboard';
        return location.pathname === href || location.pathname.startsWith(href + '/');
    };

    const getInitials = (name: string) => {
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    const handleNavClick = () => {
        if (isMobile && onClose) {
            onClose();
        }
    };

    return (
        <aside
            className={cn(
                "fixed left-0 top-0 z-40 h-screen bg-card/65 backdrop-blur-md border-r border-border/40 transition-all duration-300 flex flex-col shadow-2xl",
                isMobile ? "w-full inset-0 border-r-0 bg-card/95" : (isCollapsed ? "w-16" : "w-64")
            )}
        >
            {/* Logo & Close button for mobile */}
            <div className={cn(
                "flex items-center justify-between gap-2 p-6 border-b border-border",
                isMobile ? "bg-muted/30" : ""
            )}>
                <div className="flex items-center gap-2">
                    {isMobile ? (
                        <h2 className="text-xl font-display font-black uppercase italic tracking-tight text-foreground">Menu</h2>
                    ) : (
                        <img
                            src="/logo.png"
                            alt="ByteBeacon"
                            className={cn(
                                "object-contain transition-all duration-300",
                                isCollapsed ? "h-10 w-10" : "h-14 w-auto"
                            )}
                        />
                    )}
                </div>
                {isMobile && onClose && (
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-2xl bg-muted/50 flex items-center justify-center hover:bg-muted transition-all duration-300"
                    >
                        <X className="w-5 h-5 text-foreground" />
                    </button>
                )}
            </div>

            {/* User Profile */}
            <div className={cn(
                "p-4 border-b border-border",
                isCollapsed ? "flex justify-center" : ""
            )}>
                <div className={cn("flex items-center gap-3", isCollapsed && "justify-center")}>
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold flex-shrink-0">
                        {getInitials(userName || 'User')}
                    </div>
                    {!isCollapsed && (
                        <div className="overflow-hidden">
                            <p className="font-semibold text-sm truncate">{userName || 'User'}</p>
                            <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
                            {(userRole === 'agent' || userRole === 'superagent') && (
                                <span className="inline-block mt-1 px-2 py-0.5 text-xs font-semibold rounded uppercase tracking-wider bg-gradient-to-r from-emerald-500 to-teal-500 text-white">
                                    SuperAgent
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto p-2 space-y-1">
                {navItems.map((item) => (
                    <div key={item.label}>
                        {item.divider && (
                            <div className="my-3 border-t border-border/40 mx-2" />
                        )}
                        {item.subItems ? (
                            <>
                                <button
                                    onClick={() => toggleExpanded(item.label)}
                                    className={cn(
                                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium group/item",
                                        "transition-all duration-300 ease-in-out",
                                        "hover:bg-primary/5 hover:text-primary active:scale-[0.98]",
                                        "text-muted-foreground",
                                        isCollapsed && "justify-center px-1"
                                    )}
                                >
                                    <PremiumIcon
                                        icon={item.icon}
                                        variant={item.variant}
                                        showBackground={false}
                                        className="!w-6 !h-6"
                                        animate={true}
                                    />
                                    {!isCollapsed && (
                                        <>
                                            <span className="flex-1 text-left">{item.label}</span>
                                            <ChevronDown
                                                className={cn(
                                                    "w-4 h-4 transition-transform duration-300",
                                                    expandedItems.includes(item.label) ? "rotate-180 text-primary" : "group-hover/item:text-primary"
                                                )}
                                            />
                                        </>
                                    )}
                                </button>
                                {!isCollapsed && expandedItems.includes(item.label) && (
                                    <div className="ml-6 mt-1 space-y-1 border-l-2 border-primary/10 pl-4 py-1">
                                        {item.subItems.map((subItem) => (
                                            <Link
                                                key={subItem.href}
                                                to={subItem.href}
                                                onClick={handleNavClick}
                                                className={cn(
                                                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-300 group/subitem border-l-2",
                                                    "active:scale-[0.98]",
                                                    isActive(subItem.href)
                                                        ? "bg-primary/10 text-primary font-semibold shadow-sm border-l-primary translate-x-1"
                                                        : "text-muted-foreground hover:text-primary hover:bg-primary/5 hover:translate-x-1 border-l-transparent"
                                                )}
                                            >
                                                {subItem.badge && (
                                                    <span className={cn(
                                                        "w-7 h-5 text-[10px] font-bold rounded flex items-center justify-center shadow-sm transition-transform group-hover/subitem:scale-110",
                                                        subItem.badge === 'MTN' && "bg-gradient-to-r from-yellow-400 to-amber-500 text-black",
                                                        subItem.badge === 'TC' && "bg-gradient-to-r from-red-500 to-rose-500 text-white",
                                                        subItem.badge === 'AT' && "bg-gradient-to-r from-blue-500 to-indigo-500 text-white"
                                                    )}>
                                                        {subItem.badge}
                                                    </span>
                                                )}
                                                <span className="relative flex items-center gap-2">
                                                    {subItem.label}
                                                    {isActive(subItem.href) && (
                                                        <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse shadow-[0_0_8px_#10b981]" />
                                                    )}
                                                </span>
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </>
                        ) : (
                            <Link
                                to={item.href!}
                                onClick={handleNavClick}
                                className={cn(
                                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium group/item border-l-2",
                                    "transition-all duration-300 ease-in-out",
                                    "active:scale-[0.98]",
                                    isActive(item.href)
                                        ? "bg-primary/10 text-primary shadow-sm border-l-primary border-t-transparent border-r-transparent border-b-transparent translate-x-1"
                                        : "text-muted-foreground hover:text-primary hover:bg-primary/5 hover:translate-x-1 border-l-transparent",
                                    isCollapsed && "justify-center px-1 border-l-0"
                                )}
                            >
                                <PremiumIcon
                                    icon={item.icon}
                                    variant={item.variant || 'ghost'}
                                    showBackground={isActive(item.href)}
                                    size="sm"
                                    className="transition-all duration-300"
                                />
                                {!isCollapsed && (
                                    <span className="relative flex-1 flex items-center justify-between">
                                        <span>{item.label}</span>
                                        {isActive(item.href) && (
                                            <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse shadow-[0_0_8px_#10b981] mr-1" />
                                        )}
                                    </span>
                                )}
                            </Link>
                        )}
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
                        "text-red-500 hover:bg-red-500/10 active:scale-[0.98]",
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
