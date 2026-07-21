import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { userService } from '@/services';
import { useSocket } from '@/contexts/SocketContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Bell,
    Check,
    CheckCheck,
    Trash2,
    Wallet,
    ShoppingCart,
    AlertCircle,
    Info,
    Gift,
    Loader2
} from 'lucide-react';

interface Notification {
    id: string;
    type: 'success' | 'warning' | 'info' | 'error';
    title: string;
    message: string;
    createdAt: string;
    isRead: boolean;
}

const notificationIcons = {
    success: CheckCheck,
    warning: AlertCircle,
    info: Info,
    error: AlertCircle,
};

const notificationColors = {
    success: 'bg-green-500/20 text-green-500',
    warning: 'bg-yellow-500/20 text-yellow-500',
    info: 'bg-blue-500/20 text-blue-500',
    error: 'bg-red-500/20 text-red-500',
};

export default function NotificationsPage() {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'unread'>('all');
    const { socket } = useSocket();

    const fetchNotifications = useCallback(async () => {
        setLoading(true);
        try {
            const data = await userService.getNotifications();
            setNotifications(data.map(n => ({
                id: n.id,
                type: n.type as 'success' | 'warning' | 'info' | 'error',
                title: n.title,
                message: n.message,
                createdAt: n.createdAt,
                isRead: n.isRead
            })));
        } catch (err) {
            console.error('Failed to fetch notifications:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    // Socket.IO Listener
    useEffect(() => {
        if (!socket) return;

        const handleNewNotification = (notif: any) => {
            setNotifications(prev => [{
                id: notif.id,
                type: notif.type as 'success' | 'warning' | 'info' | 'error',
                title: notif.title,
                message: notif.message,
                createdAt: notif.createdAt,
                isRead: false
            }, ...prev]);
        };

        socket.on('newNotification', handleNewNotification);
        return () => {
            socket.off('newNotification', handleNewNotification);
        };
    }, [socket]);

    const filteredNotifications = notifications.filter(n =>
        filter === 'all' || !n.isRead
    );

    const markAsRead = async (id: string) => {
        try {
            await userService.markNotificationRead(id);
            setNotifications(prev => prev.map(n =>
                n.id === id ? { ...n, isRead: true } : n
            ));
        } catch (err) {
            console.error('Failed to mark notification as read:', err);
        }
    };

    const markAllAsRead = async () => {
        try {
            await userService.markAllNotificationsRead();
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        } catch (err) {
            console.error('Failed to mark all as read:', err);
        }
    };

    const deleteNotification = async (id: string) => {
        try {
            await userService.deleteNotification(id);
            setNotifications(prev => prev.filter(n => n.id !== id));
        } catch (err) {
            console.error('Failed to delete notification:', err);
        }
    };

    const clearAll = async () => {
        try {
            await userService.clearAllNotifications();
            setNotifications([]);
        } catch (err) {
            console.error('Failed to clear notifications:', err);
        }
    };

    const unreadCount = notifications.filter(n => !n.isRead).length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Bell className="w-8 h-8 text-muted-foreground" />
                    <div>
                        <h1 className="font-display text-2xl md:text-3xl font-bold">Notifications</h1>
                        <p className="text-muted-foreground">
                            {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up!'}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={markAllAsRead} disabled={unreadCount === 0}>
                        <Check className="w-4 h-4 mr-2" />
                        Mark All Read
                    </Button>
                    <Button variant="outline" size="sm" onClick={clearAll} disabled={notifications.length === 0}>
                        <Trash2 className="w-4 h-4 mr-2" />
                        Clear All
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-2">
                <Button
                    variant={filter === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilter('all')}
                >
                    All ({notifications.length})
                </Button>
                <Button
                    variant={filter === 'unread' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilter('unread')}
                >
                    Unread ({unreadCount})
                </Button>
            </div>

            {/* Notifications List */}
            <div className="space-y-3">
                {loading ? (
                    <>
                        {Array.from({ length: 5 }).map((_, i) => (
                            <Card key={i}>
                                <CardContent className="p-4">
                                    <div className="flex items-start gap-4">
                                        <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
                                        <div className="flex-1 space-y-2">
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="space-y-1.5">
                                                    <Skeleton className="h-4 w-36" />
                                                    <Skeleton className="h-3 w-full max-w-md" />
                                                    <Skeleton className="h-3 w-24" />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Skeleton className="h-8 w-8 rounded" />
                                                    <Skeleton className="h-8 w-8 rounded" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </>
                ) : filteredNotifications.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <Bell className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                            <p className="text-muted-foreground">
                                {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    filteredNotifications.map((notification) => {
                        const Icon = notificationIcons[notification.type];
                        return (
                            <Card
                                key={notification.id}
                                className={`transition-colors ${!notification.isRead ? 'bg-primary/5 border-primary/20' : ''}`}
                            >
                                <CardContent className="p-4">
                                    <div className="flex items-start gap-4">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${notificationColors[notification.type]}`}>
                                            <Icon className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-4">
                                                <div>
                                                    <p className={`font-semibold ${!notification.isRead ? 'text-foreground' : 'text-muted-foreground'}`}>
                                                        {notification.title}
                                                    </p>
                                                    <p className="text-sm text-muted-foreground mt-1">
                                                        {notification.message}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground mt-2">
                                                        {new Date(notification.createdAt).toLocaleString()}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    {!notification.isRead && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => markAsRead(notification.id)}
                                                        >
                                                            <Check className="w-4 h-4" />
                                                        </Button>
                                                    )}
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => deleteNotification(notification.id)}
                                                    >
                                                        <Trash2 className="w-4 h-4 text-red-500" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })
                )}
            </div>
        </div>
    );
}
