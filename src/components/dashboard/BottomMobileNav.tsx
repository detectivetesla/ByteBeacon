import { Link, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    Wallet,
    Package,
    ShoppingCart,
    Menu
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface BottomMobileNavProps {
    onMenuClick: () => void;
    userRole?: string | null;
}

export default function BottomMobileNav({ onMenuClick, userRole }: BottomMobileNavProps) {
    const location = useLocation();

    const navItems = [
        { icon: LayoutDashboard, label: 'Home', href: '/dashboard' },
        { icon: Wallet, label: 'Wallet', href: '/dashboard/wallet' },
        { icon: Package, label: 'Data', href: '/dashboard/bundles/mtn' }, // Default to MTN
        { icon: ShoppingCart, label: 'Orders', href: '/dashboard/orders' },
    ];

    const isActive = (href: string) => {
        if (href === '/dashboard') return location.pathname === '/dashboard';
        return location.pathname === href || location.pathname.startsWith(href);
    };

    return (
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-xl border-t border-border px-4 pb-safe-area-inset-bottom pt-2 select-none shadow-[0_-8px_30px_rgb(0,0,0,0.12)]">
            <div className="flex items-center justify-between max-w-lg mx-auto">
                {navItems.map((item) => (
                    <Link
                        key={item.label}
                        to={item.href}
                        className={cn(
                            "flex flex-col items-center justify-center gap-1 min-w-[64px] py-1 transition-all duration-300 relative group",
                            isActive(item.href) ? "text-emerald-500" : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        {/* Active indicator dot */}
                        {isActive(item.href) && (
                            <span className="absolute -top-2 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.8)] animate-in fade-in zoom-in duration-300" />
                        )}

                        <div className={cn(
                            "w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-300",
                            isActive(item.href) ? "bg-emerald-500/10 shadow-inner" : "group-hover:bg-muted"
                        )}>
                            <item.icon className={cn(
                                "w-6 h-6 transition-transform duration-300",
                                isActive(item.href) ? "scale-110" : "group-hover:scale-105"
                            )} />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest">{item.label}</span>
                    </Link>
                ))}

                {/* Menu Button to trigger sidebar */}
                <button
                    onClick={onMenuClick}
                    className="flex flex-col items-center justify-center gap-1 min-w-[64px] py-1 text-muted-foreground hover:text-foreground transition-all duration-300 group"
                >
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center group-hover:bg-muted transition-all duration-300">
                        <Menu className="w-6 h-6 group-hover:scale-110 transition-transform duration-300" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest">Menu</span>
                </button>
            </div>
        </nav>
    );
}
