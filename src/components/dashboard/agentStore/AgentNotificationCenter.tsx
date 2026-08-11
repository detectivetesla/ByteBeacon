import React, { useState, useEffect, useCallback, useRef } from 'react';
import { userService, UserNotification } from '@/services/user.service';
import { useSocket } from '@/contexts/SocketContext';
import {
    Bell,
    CheckCircle2,
    CheckCheck,
    Trash2,
    Info,
    AlertTriangle,
    DollarSign,
    ShoppingCart,
    Shield,
    X,
    Loader2,
    Store
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const AgentNotificationCenter: React.FC = () => {
    const [notifications, setNotifications] = useState<UserNotification[]>([]);
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const { socket } = useSocket();
    const dropdownRef = useRef<HTMLDivElement>(null);

    const fetchNotifications = useCallback(async () => {
        try {
            setLoading(true);
            const data = await userService.getNotifications();
            if (Array.isArray(data)) {
                setNotifications(data);
            }
        } catch (err) {
            console.error('Error fetching notifications in Agent Store:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    // Socket.IO Listener for real-time notifications
    useEffect(() => {
        if (!socket) return;

        const handleNewNotification = (notif: any) => {
            const formatted: UserNotification = {
                id: notif.id || String(Date.now()),
                title: notif.title || 'Notification',
                message: notif.message || '',
                type: notif.type || 'info',
                isRead: false,
                createdAt: notif.createdAt || new Date().toISOString()
            };
            setNotifications(prev => [formatted, ...prev]);
        };

        socket.on('newNotification', handleNewNotification);
        return () => {
            socket.off('newNotification', handleNewNotification);
        };
    }, [socket]);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const unreadCount = notifications.filter(n => !n.isRead).length;

    const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await userService.markNotificationRead(id);
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
        } catch (err) {
            console.error('Failed to mark notification read:', err);
        }
    };

    const handleMarkAllRead = async () => {
        try {
            await userService.markAllNotificationsRead();
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        } catch (err) {
            console.error('Failed to mark all notifications read:', err);
        }
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await userService.deleteNotification(id);
            setNotifications(prev => prev.filter(n => n.id !== id));
        } catch (err) {
            console.error('Failed to delete notification:', err);
        }
    };

    const getTypeIcon = (type: string) => {
        const t = (type || '').toLowerCase();
        if (t.includes('order')) return <ShoppingCart className="w-4 h-4 text-orange-400" />;
        if (t.includes('wallet') || t.includes('payment') || t.includes('withdrawal')) return <DollarSign className="w-4 h-4 text-emerald-400" />;
        if (t.includes('store')) return <Store className="w-4 h-4 text-[#a3e635]" />;
        if (t.includes('warning') || t.includes('error') || t.includes('security')) return <AlertTriangle className="w-4 h-4 text-rose-400" />;
        return <Info className="w-4 h-4 text-sky-400" />;
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Bell Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 rounded-xl bg-[#202227] text-slate-300 hover:text-white border border-white/5 transition-all focus:outline-none"
                aria-label="Open notifications"
            >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#a3e635] text-black font-black text-[9px] flex items-center justify-center shadow-lg shadow-[#a3e635]/40 animate-pulse">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Notification Popover Dropdown */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-[#18191c] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[500px] animate-in fade-in zoom-in-95 duration-200">
                    {/* Header */}
                    <div className="p-4 border-b border-white/5 flex items-center justify-between bg-[#202227]">
                        <div className="flex items-center gap-2">
                            <Bell className="w-4 h-4 text-[#a3e635]" />
                            <h3 className="text-xs font-black text-white uppercase tracking-wider">Store Notifications</h3>
                            {unreadCount > 0 && (
                                <span className="px-2 py-0.5 rounded-full bg-[#a3e635]/20 text-[#a3e635] text-[10px] font-extrabold">
                                    {unreadCount} New
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {unreadCount > 0 && (
                                <button
                                    onClick={handleMarkAllRead}
                                    className="text-[10px] font-bold text-slate-400 hover:text-[#a3e635] transition-all flex items-center gap-1"
                                >
                                    <CheckCheck className="w-3.5 h-3.5" />
                                    <span>Mark All Read</span>
                                </button>
                            )}
                            <button
                                onClick={() => setIsOpen(false)}
                                className="text-slate-400 hover:text-white p-1"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Notification List */}
                    <div className="flex-1 overflow-y-auto divide-y divide-white/5">
                        {loading && notifications.length === 0 ? (
                            <div className="py-10 text-center text-slate-400 space-y-2">
                                <Loader2 className="w-5 h-5 animate-spin mx-auto text-[#a3e635]" />
                                <p className="text-xs font-semibold">Loading notifications...</p>
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="py-12 text-center text-slate-500 space-y-2">
                                <CheckCircle2 className="w-8 h-8 mx-auto text-slate-600 opacity-50" />
                                <p className="text-xs font-bold text-slate-400">All caught up!</p>
                                <p className="text-[11px]">No notifications found.</p>
                            </div>
                        ) : (
                            notifications.map((n) => (
                                <div
                                    key={n.id}
                                    className={cn(
                                        "p-3.5 flex items-start gap-3 transition-colors hover:bg-white/[0.02]",
                                        !n.isRead ? "bg-[#a3e635]/[0.03]" : ""
                                    )}
                                >
                                    <div className="p-2 rounded-xl bg-[#202227] border border-white/5 shrink-0 mt-0.5">
                                        {getTypeIcon(n.type)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-1">
                                            <h4 className={cn("text-xs font-bold truncate", !n.isRead ? "text-white" : "text-slate-300")}>
                                                {n.title}
                                            </h4>
                                            <span className="text-[9px] text-slate-500 shrink-0">
                                                {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-slate-400 mt-1 leading-relaxed break-words">
                                            {n.message}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        {!n.isRead && (
                                            <button
                                                onClick={(e) => handleMarkAsRead(n.id, e)}
                                                className="p-1 text-slate-500 hover:text-[#a3e635] transition-all"
                                                title="Mark as read"
                                            >
                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                        <button
                                            onClick={(e) => handleDelete(n.id, e)}
                                            className="p-1 text-slate-500 hover:text-rose-400 transition-all"
                                            title="Delete notification"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AgentNotificationCenter;
