import { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import { useToast } from '@/hooks/use-toast';
import { adminService } from '@/services';
import { Button } from '@/components/ui/button';
import {
    Bell,
    MessageSquare,
    Moon,
    Sun,
    User,
    Settings,
    LogOut,
    Menu,
    ChevronLeft,
    Check,
    Shield,
    Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AdminHeaderProps {
    adminName: string;
    adminEmail: string;
    isSidebarCollapsed: boolean;
    onToggleSidebar: () => void;
    isMobile?: boolean;
}

export default function AdminHeader({
    adminName,
    adminEmail,
    isSidebarCollapsed,
    onToggleSidebar,
    isMobile
}: AdminHeaderProps) {
    const { resolvedTheme, setTheme } = useTheme();
    const { signOut } = useAuth();
    const { socket } = useSocket();
    const { toast } = useToast();
    const navigate = useNavigate();

    const [showMessagesDropdown, setShowMessagesDropdown] = useState(false);
    const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
    const [showProfileDropdown, setShowProfileDropdown] = useState(false);

    const messagesRef = useRef<HTMLDivElement>(null);
    const notificationsRef = useRef<HTMLDivElement>(null);
    const profileRef = useRef<HTMLDivElement>(null);

    // Real data state
    const [messages, setMessages] = useState<Array<{ id: string; recipientName: string; subject: string; body: string; isRead: boolean; createdAt: string }>>([]);
    const [notifications, setNotifications] = useState<Array<{ id: string; title: string; message: string; type: string; isRead: boolean; createdAt: string }>>([]);
    const [loadingMessages, setLoadingMessages] = useState(true);

    // Fetch messages and agent applications on mount
    const fetchData = useCallback(async () => {
        try {
            const [messagesData, applicationsData, realNotifications] = await Promise.all([
                adminService.getMessages(),
                adminService.getAgentApplications(),
                adminService.getNotifications()
            ]);
            setMessages(messagesData.slice(0, 5));

            // Convert applications to notifications
            const applicationNotifications = (applicationsData || [])
                .filter((app: any) => app.status === 'processing')
                .map((app: any) => ({
                    id: `app-${app.id}`,
                    title: 'New Agent Application',
                    message: `${app.full_name} from ${app.business_name || 'N/A'} has applied.`,
                    type: 'user',
                    isRead: false,
                    createdAt: app.created_at
                }));

            setNotifications([...applicationNotifications, ...realNotifications].slice(0, 5));
        } catch (err) {
            console.error('Error fetching admin header data:', err);
        } finally {
            setLoadingMessages(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
        // Polling removed in favor of push updates
    }, [fetchData]);

    // Socket listeners
    useEffect(() => {
        if (!socket) return;

        socket.on('newNotification', (data: any) => {
            setNotifications(prev => [data, ...prev].slice(0, 5));
            toast({
                title: data.title,
                description: data.message,
            });
        });

        socket.on('newAgentApplication', (data: any) => {
            const newNotif = {
                id: `app-${data.id}`,
                title: 'New Agent Application',
                message: `${data.userName} has applied to become an agent.`,
                type: 'user',
                isRead: false,
                createdAt: data.createdAt
            };
            setNotifications(prev => [newNotif, ...prev].slice(0, 5));
            toast({
                title: 'New Agent Application',
                description: `${data.userName} just submitted an application.`,
            });
        });

        socket.on('newMessage', (data: any) => {
            setMessages(prev => [data, ...prev].slice(0, 5));
            toast({
                title: `New Message: ${data.subject}`,
                description: `From user ${data.senderName}`,
            });
        });

        return () => {
            socket.off('newNotification');
            socket.off('newAgentApplication');
            socket.off('newMessage');
        };
    }, [socket, toast, navigate]);

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

    const getInitials = (name: string) => {
        if (!name || typeof name !== 'string') return 'AD';
        return name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'AD';
    };

    const toggleTheme = () => {
        setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
    };

    const handleSignOut = async () => {
        await signOut();
        navigate('/');
    };

    const closeAllDropdowns = () => {
        setShowMessagesDropdown(false);
        setShowNotificationsDropdown(false);
        setShowProfileDropdown(false);
    };

    return (
        <header className="sticky top-0 z-30 h-16 bg-background border-b border-border flex items-center justify-between px-4 md:px-6">
            {/* Left side */}
            <div className="flex items-center gap-4">
                {/* Toggle button */}
                <button
                    onClick={onToggleSidebar}
                    className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center
            transition-all duration-200 hover:bg-accent/80 active:scale-95"
                >
                    <Menu className="w-5 h-5 text-muted-foreground" />
                </button>

                {/* Welcome Text */}
                <div className="hidden sm:flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center">
                        <span className="text-white font-semibold text-sm">{getInitials(adminName)}</span>
                    </div>
                    <div>
                        <p className="text-foreground font-medium text-sm">
                            Welcome! <span className="font-bold">{adminName}</span>
                        </p>
                        <p className="text-muted-foreground text-xs">Security is a process, not a product.</p>
                    </div>
                </div>
            </div>

            {/* Center - Email Pill */}
            <div className="hidden md:flex items-center">
                <div className="px-4 py-2 bg-accent rounded-full text-sm text-muted-foreground border border-border">
                    {adminEmail}
                </div>
            </div>

            {/* Right side - Actions */}
            <div className="flex items-center gap-1 md:gap-2">
                {/* Messages Dropdown */}
                <div className="relative" ref={messagesRef}>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="relative w-10 h-10 text-muted-foreground hover:text-foreground hover:bg-accent"
                        onClick={() => {
                            setShowMessagesDropdown(!showMessagesDropdown);
                            setShowNotificationsDropdown(false);
                            setShowProfileDropdown(false);
                        }}
                    >
                        <MessageSquare className="w-5 h-5" />
                        {messages.filter(m => !m.isRead).length > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-emerald-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                                {messages.filter(m => !m.isRead).length}
                            </span>
                        )}
                    </Button>

                    {showMessagesDropdown && (
                        <div className="absolute right-0 mt-2 w-72 md:w-80 bg-popover border border-border rounded-lg shadow-lg overflow-hidden z-50 animate-in fade-in-0 zoom-in-95 duration-200">
                            <div className="p-3 border-b border-border flex items-center justify-between">
                                <h3 className="font-semibold text-sm text-foreground">Messages</h3>
                                <Link to="/admin/messages" className="text-xs text-emerald-500 hover:underline" onClick={closeAllDropdowns}>
                                    View All
                                </Link>
                            </div>
                            <div className="max-h-64 overflow-y-auto">
                                {loadingMessages ? (
                                    <div className="p-4 flex justify-center">
                                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                                    </div>
                                ) : messages.length === 0 ? (
                                    <div className="p-4 text-center text-sm text-muted-foreground">
                                        No messages yet
                                    </div>
                                ) : (
                                    messages.map((msg) => (
                                        <div
                                            key={msg.id}
                                            onClick={() => {
                                                navigate('/admin/messages');
                                                closeAllDropdowns();
                                            }}
                                            className={cn(
                                                "p-3 border-b border-border/50 hover:bg-accent/50 transition-colors cursor-pointer",
                                                !msg.isRead && "bg-accent/20"
                                            )}>
                                            <p className="text-sm font-medium text-foreground">{msg.recipientName || 'User'}</p>
                                            <p className="text-xs font-medium text-muted-foreground">{msg.subject}</p>
                                            <p className="text-xs text-muted-foreground truncate">{msg.body}</p>
                                        </div>
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
                        className="relative w-10 h-10 text-muted-foreground hover:text-foreground hover:bg-accent"
                        onClick={() => {
                            setShowNotificationsDropdown(!showNotificationsDropdown);
                            setShowMessagesDropdown(false);
                            setShowProfileDropdown(false);
                        }}
                    >
                        <Bell className="w-5 h-5" />
                        {notifications.filter(n => !n.isRead).length > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                                {notifications.filter(n => !n.isRead).length}
                            </span>
                        )}
                    </Button>

                    {showNotificationsDropdown && (
                        <div className="absolute right-0 mt-2 w-72 md:w-80 bg-popover border border-border rounded-lg shadow-lg overflow-hidden z-50 animate-in fade-in-0 zoom-in-95 duration-200">
                            <div className="p-3 border-b border-border flex items-center justify-between">
                                <h3 className="font-semibold text-sm text-foreground">Notifications</h3>
                                <Link to="/admin/notifications" className="text-xs text-emerald-500 hover:underline" onClick={closeAllDropdowns}>
                                    View All
                                </Link>
                            </div>
                            <div className="max-h-64 overflow-y-auto">
                                {notifications.length === 0 ? (
                                    <div className="p-4 text-center text-sm text-muted-foreground">
                                        No notifications yet
                                    </div>
                                ) : (
                                    notifications.map((notif) => (
                                        <div
                                            key={notif.id}
                                            onClick={async () => {
                                                if (!notif.isRead && !notif.id.startsWith('app-')) {
                                                    try {
                                                        await adminService.markNotificationRead(notif.id);
                                                        setNotifications(prev => prev.map(n =>
                                                            n.id === notif.id ? { ...n, isRead: true } : n
                                                        ));
                                                    } catch (err) {
                                                        console.error('Failed to mark read:', err);
                                                    }
                                                }
                                                // Route agent applications to the agent applications section
                                                if (notif.id.startsWith('app-')) {
                                                    navigate('/admin/analytics');
                                                } else {
                                                    navigate('/admin/notifications');
                                                }
                                                closeAllDropdowns();
                                            }}
                                            className={cn(
                                                "p-3 border-b border-border/50 hover:bg-accent/50 transition-colors cursor-pointer",
                                                !notif.isRead && "bg-accent/20"
                                            )}>
                                            <p className="text-sm font-medium text-foreground">{notif.title}</p>
                                            <p className="text-xs text-muted-foreground">{notif.message}</p>
                                            <p className="text-[10px] text-muted-foreground mt-1 opacity-70">
                                                {new Date(notif.createdAt).toLocaleString()}
                                            </p>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Theme Toggle */}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleTheme}
                    className="w-10 h-10 text-muted-foreground hover:text-foreground hover:bg-accent"
                >
                    {resolvedTheme === 'dark' ? (
                        <Moon className="w-5 h-5" />
                    ) : (
                        <Sun className="w-5 h-5" />
                    )}
                </Button>

                {/* Profile Dropdown */}
                <div className="relative" ref={profileRef}>
                    <button
                        onClick={() => {
                            setShowProfileDropdown(!showProfileDropdown);
                            setShowMessagesDropdown(false);
                            setShowNotificationsDropdown(false);
                        }}
                        className="flex items-center gap-2 ml-2"
                    >
                        <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white font-semibold text-sm">
                            {getInitials(adminName)}
                        </div>
                        <ChevronLeft className={cn(
                            "w-4 h-4 text-muted-foreground transition-transform hidden md:block",
                            showProfileDropdown ? "rotate-90" : "-rotate-90"
                        )} />
                    </button>

                    {showProfileDropdown && (
                        <div className="absolute right-0 mt-2 w-56 bg-popover border border-border rounded-lg shadow-lg overflow-hidden z-50 animate-in fade-in-0 zoom-in-95 duration-200">
                            <div className="p-3 border-b border-border">
                                <p className="font-semibold text-sm text-foreground">{adminName}</p>
                                <p className="text-xs text-muted-foreground">Super Admin</p>
                            </div>
                            <div className="p-1">
                                <Link
                                    to="/admin/profile"
                                    className="flex items-center gap-3 px-3 py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                                    onClick={closeAllDropdowns}
                                >
                                    <User className="w-4 h-4" />
                                    <span className="text-sm">My Profile</span>
                                </Link>
                                <Link
                                    to="/admin/settings"
                                    className="flex items-center gap-3 px-3 py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                                    onClick={closeAllDropdowns}
                                >
                                    <Settings className="w-4 h-4" />
                                    <span className="text-sm">Settings</span>
                                </Link>
                                <button
                                    onClick={() => {
                                        closeAllDropdowns();
                                        handleSignOut();
                                    }}
                                    className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-red-500 hover:bg-red-500/10 transition-colors"
                                >
                                    <LogOut className="w-4 h-4" />
                                    <span className="text-sm">Logout</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
