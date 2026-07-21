import { useState, useEffect, useRef, useCallback } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import { useToast } from '@/hooks/use-toast';
import {
    Bell,
    Mail,
    User as UserIcon,
    LogOut,
    Moon,
    Sun,
    Check,
    Menu,
    ChevronLeft,
    LayoutDashboard,
    AlertCircle,
    CheckCircle2,
    Info,
    AlertTriangle,
    Settings as SettingsIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate, Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { userService, UserMessage, UserNotification } from '@/services/user.service';

interface DashboardHeaderProps {
    userName: string;
    isSidebarCollapsed: boolean;
    onToggleSidebar: () => void;
    isMobile: boolean;
}

export default function DashboardHeader({ userName, isSidebarCollapsed, onToggleSidebar, isMobile }: DashboardHeaderProps) {
    const { resolvedTheme, setTheme } = useTheme();
    const { signOut, user } = useAuth();
    const { socket } = useSocket();
    const { toast } = useToast();
    const navigate = useNavigate();

    const [scrolled, setScrolled] = useState(false);
    const [showMessagesDropdown, setShowMessagesDropdown] = useState(false);
    const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
    const [showProfileDropdown, setShowProfileDropdown] = useState(false);

    const messagesRef = useRef<HTMLDivElement>(null);
    const notificationsRef = useRef<HTMLDivElement>(null);
    const profileRef = useRef<HTMLDivElement>(null);

    // Real data state
    const [messages, setMessages] = useState<UserMessage[]>([]);
    const [notifications, setNotifications] = useState<UserNotification[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        try {
            const [msgs, notifs] = await Promise.all([
                userService.getMessages(),
                userService.getNotifications()
            ]);
            setMessages(msgs.slice(0, 5));
            setNotifications(notifs.slice(0, 5));
        } catch (err) {
            console.error('Error fetching header data:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
        // Polling removed in favor of Socket.IO push updates
    }, [fetchData]);

    // Socket listeners
    useEffect(() => {
        if (!socket) return;

        socket.on('newNotification', (data: UserNotification) => {
            setNotifications(prev => [data, ...prev].slice(0, 5));
            toast({
                title: data.title,
                description: data.message,
            });
        });

        socket.on('newMessage', (data: UserMessage) => {
            setMessages(prev => [data, ...prev].slice(0, 5));
            toast({
                title: `New Message: ${data.subject}`,
                description: `From ${data.senderName}`,
            });
        });

        return () => {
            socket.off('newNotification');
            socket.off('newMessage');
        };
    }, [socket, toast]);

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (messagesRef.current && !messagesRef.current.contains(event.target as Node)) {
                setShowMessagesDropdown(false);
            }
            if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
                setShowNotificationsDropdown(false);
            }
            if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
                setShowProfileDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 0);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const toggleTheme = () => {
        setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
    };

    const closeAllDropdowns = () => {
        setShowMessagesDropdown(false);
        setShowNotificationsDropdown(false);
        setShowProfileDropdown(false);
    };

    const getNotificationIcon = (type: string) => {
        switch (type) {
            case 'success': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
            case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />;
            case 'warning': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
            default: return <Info className="w-4 h-4 text-blue-500" />;
        }
    };

    const unreadMessagesCount = messages.filter(m => !m.isRead).length;
    const unreadNotificationsCount = notifications.filter(n => !n.isRead).length;

    const anyDropdownOpen = showMessagesDropdown || showNotificationsDropdown || showProfileDropdown;

    return (
        <>
            {/* Backdrop for mobile dropdowns */}
            {anyDropdownOpen && (
                <div
                    className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-40 md:hidden"
                    onClick={closeAllDropdowns}
                />
            )}
            <header className={cn(
                "sticky top-0 z-40 w-full transition-all duration-200 border-b",
                scrolled ? "bg-background/80 backdrop-blur-md border-border shadow-sm" : "bg-background border-transparent"
            )}>
                <div className="flex h-16 items-center justify-between px-4 sm:px-6 relative">
                    {/* Mobile Menu Trigger - only on mobile */}
                    <div className="flex items-center lg:hidden">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onToggleSidebar}
                            className="text-muted-foreground hover:text-foreground"
                        >
                            <Menu className="h-5 w-5" />
                        </Button>
                    </div>

                    {/* Left: Desktop Branding / Welcome */}
                    <div className="hidden lg:flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onToggleSidebar}
                            className="text-muted-foreground hover:text-foreground"
                        >
                            {isSidebarCollapsed ? <LayoutDashboard className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
                        </Button>
                        <h2 className="text-sm font-medium text-muted-foreground">Welcome back, <span className="text-foreground font-semibold">{userName}</span></h2>
                    </div>

                    {/* Center: Mobile Branding */}
                    <div className="lg:hidden absolute left-1/2 -translate-x-1/2 flex items-center gap-2 pointer-events-none">
                        <img src="/logo.png" alt="ByteBeacon" className="h-8 w-auto" />
                        <span className="font-display font-black text-lg tracking-tighter uppercase italic text-foreground hidden sm:block">
                            ByteBeacon
                        </span>
                    </div>

                    <div className="flex items-center gap-1 sm:gap-2">
                        {/* Theme Toggle */}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={toggleTheme}
                            className="text-muted-foreground hover:text-foreground hidden sm:flex"
                        >
                            {resolvedTheme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                        </Button>

                        {/* Messages Dropdown */}
                        <div className="relative" ref={messagesRef}>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="relative text-muted-foreground hover:text-foreground"
                                onClick={() => {
                                    setShowMessagesDropdown(!showMessagesDropdown);
                                    setShowNotificationsDropdown(false);
                                    setShowProfileDropdown(false);
                                }}
                            >
                                <Mail className="h-5 w-5" />
                                {unreadMessagesCount > 0 && (
                                    <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                                    </span>
                                )}
                            </Button>

                            {showMessagesDropdown && (
                                <div className="fixed inset-x-4 top-[72px] md:absolute md:right-0 md:inset-x-auto md:top-auto md:mt-2 md:w-80 bg-popover border border-border rounded-xl shadow-2xl md:shadow-lg overflow-hidden animate-in fade-in-0 zoom-in-95 duration-200 z-50">
                                    <div className="p-4 border-b border-border flex items-center justify-between">
                                        <h3 className="font-semibold text-sm">Messages</h3>
                                        <Link to="/dashboard/messages" onClick={closeAllDropdowns} className="text-xs text-primary hover:underline">
                                            View all
                                        </Link>
                                    </div>
                                    <div className="max-h-80 overflow-y-auto">
                                        {loading ? (
                                            <div className="p-4 text-center text-sm text-muted-foreground">Loading...</div>
                                        ) : messages.length === 0 ? (
                                            <div className="p-8 text-center">
                                                <Mail className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                                                <p className="text-sm text-muted-foreground">No messages yet</p>
                                            </div>
                                        ) : (
                                            messages.map((msg) => (
                                                <Link
                                                    key={msg.id}
                                                    to={`/dashboard/messages`}
                                                    onClick={closeAllDropdowns}
                                                    className={cn(
                                                        "block p-4 hover:bg-muted/50 transition-colors border-b border-border/50 last:border-0",
                                                        !msg.isRead && "bg-primary/5"
                                                    )}
                                                >
                                                    <div className="flex justify-between items-start mb-1">
                                                        <span className="font-medium text-sm truncate">{msg.senderName}</span>
                                                        {!msg.isRead && <span className="h-2 w-2 bg-blue-500 rounded-full mt-1"></span>}
                                                    </div>
                                                    <p className="text-xs font-semibold mb-1 truncate">{msg.subject}</p>
                                                    <p className="text-xs text-muted-foreground line-clamp-1">{msg.body}</p>
                                                </Link>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Notifications Dropdown */}
                        <div className="relative" ref={notificationsRef}>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="relative text-muted-foreground hover:text-foreground"
                                onClick={() => {
                                    setShowNotificationsDropdown(!showNotificationsDropdown);
                                    setShowMessagesDropdown(false);
                                    setShowProfileDropdown(false);
                                }}
                            >
                                <Bell className="h-5 w-5" />
                                {unreadNotificationsCount > 0 && (
                                    <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                    </span>
                                )}
                            </Button>

                            {showNotificationsDropdown && (
                                <div className="fixed inset-x-4 top-[72px] md:absolute md:right-0 md:inset-x-auto md:top-auto md:mt-2 md:w-80 bg-popover border border-border rounded-xl shadow-2xl md:shadow-lg overflow-hidden animate-in fade-in-0 zoom-in-95 duration-200 z-50">
                                    <div className="p-4 border-b border-border flex items-center justify-between">
                                        <h3 className="font-semibold text-sm">Notifications</h3>
                                        <Link to="/dashboard/notifications" onClick={closeAllDropdowns} className="text-xs text-primary hover:underline">
                                            View all
                                        </Link>
                                    </div>
                                    <div className="max-h-80 overflow-y-auto">
                                        {loading ? (
                                            <div className="p-4 text-center text-sm text-muted-foreground">Loading...</div>
                                        ) : notifications.length === 0 ? (
                                            <div className="p-8 text-center">
                                                <Bell className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                                                <p className="text-sm text-muted-foreground">No notifications yet</p>
                                            </div>
                                        ) : (
                                            notifications.map((notif) => (
                                                <div
                                                    key={notif.id}
                                                    className={cn(
                                                        "p-4 hover:bg-muted/50 transition-colors border-b border-border/50 last:border-0",
                                                        !notif.isRead && "bg-primary/5"
                                                    )}
                                                >
                                                    <div className="flex gap-3">
                                                        <div className="mt-0.5">
                                                            {getNotificationIcon(notif.type)}
                                                        </div>
                                                        <div className="flex-1">
                                                            <p className="text-xs font-medium">{notif.title}</p>
                                                            <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{notif.message}</p>
                                                            <p className="text-[10px] text-muted-foreground mt-1 opacity-70">
                                                                {new Date(notif.createdAt).toLocaleDateString()}
                                                            </p>
                                                        </div>
                                                        {!notif.isRead && <div className="h-2 w-2 bg-red-500 rounded-full mt-1.5"></div>}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Profile Dropdown */}
                        <div className="relative" ref={profileRef}>
                            <Button
                                variant="ghost"
                                className="flex items-center gap-2 p-1 pl-2 hover:bg-muted/50 rounded-full border border-transparent hover:border-border"
                                onClick={() => {
                                    setShowProfileDropdown(!showProfileDropdown);
                                    setShowMessagesDropdown(false);
                                    setShowNotificationsDropdown(false);
                                }}
                            >
                                <div className="hidden sm:block text-right">
                                    <p className="text-xs font-semibold">{userName}</p>
                                    <p className="text-[10px] text-muted-foreground capitalize">{user?.id ? (user as any).role : ''}</p>
                                </div>
                                <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold overflow-hidden">
                                    {userName.charAt(0)}
                                </div>
                            </Button>

                            {showProfileDropdown && (
                                <div className="absolute right-0 mt-2 w-56 bg-popover border border-border rounded-xl shadow-lg overflow-hidden animate-in fade-in-0 zoom-in-95 duration-200 z-50">
                                    <div className="p-4 border-b border-border">
                                        <p className="font-semibold text-sm">{userName}</p>
                                        <p className="text-xs text-muted-foreground truncate">{user?.id ? (user as any).email : ''}</p>
                                    </div>
                                    <div className="p-1">
                                        <Link to="/dashboard/profile" onClick={closeAllDropdowns} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted rounded-md transition-colors">
                                            <UserIcon className="h-4 w-4" />
                                            Profile
                                        </Link>
                                        <Link to="/dashboard/settings" onClick={closeAllDropdowns} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted rounded-md transition-colors">
                                            <SettingsIcon className="h-4 w-4" />
                                            Settings
                                        </Link>
                                        <div className="h-px bg-border my-1" />
                                        <button
                                            onClick={() => {
                                                signOut();
                                                closeAllDropdowns();
                                            }}
                                            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-500/10 rounded-md transition-colors"
                                        >
                                            <LogOut className="h-4 w-4" />
                                            Log out
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </header>
        </>
    );
}
