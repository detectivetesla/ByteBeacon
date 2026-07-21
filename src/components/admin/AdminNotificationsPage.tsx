import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bell, Check, CheckCheck, Trash2, AlertCircle, Info, DollarSign, Users, ShoppingCart, Plus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { adminService, type Notification } from '@/services';
import { useSocket } from '@/contexts/SocketContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

export default function AdminNotificationsPage() {
    const { toast } = useToast();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'unread'>('all');

    // New Notification State
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createForm, setCreateForm] = useState({ title: '', message: '', type: 'info', userId: '' });
    const [sending, setSending] = useState(false);
    const { socket } = useSocket();

    const fetchNotifications = useCallback(async () => {
        setLoading(true);
        try {
            const data = await adminService.getNotifications();
            setNotifications(data);
        } catch (err) {
            console.error('Error fetching notifications:', err);
            toast({ title: 'Error', description: 'Failed to fetch notifications', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    // Socket.IO Listener
    useEffect(() => {
        if (!socket) return;

        const handleNewNotification = (notif: Notification) => {
            setNotifications(prev => [notif, ...prev]);
            toast({
                title: notif.title,
                description: notif.message.substring(0, 50) + (notif.message.length > 50 ? '...' : ''),
            });
        };

        socket.on('newNotification', handleNewNotification);
        return () => {
            socket.off('newNotification', handleNewNotification);
        };
    }, [socket, toast]);

    const handleSendNotification = async () => {
        if (!createForm.title || !createForm.message) {
            toast({ title: 'Error', description: 'Please fill in all fields', variant: 'destructive' });
            return;
        }

        setSending(true);
        try {
            await adminService.sendNotification({
                title: createForm.title,
                message: createForm.message,
                type: createForm.type,
                userId: createForm.userId || undefined
            });

            toast({ title: 'Success', description: 'Notification sent successfully' });
            setShowCreateModal(false);
            setCreateForm({ title: '', message: '', type: 'info', userId: '' });
            fetchNotifications();
        } catch (err) {
            console.error('Send notification error:', err);
            toast({ title: 'Error', description: 'Failed to send notification', variant: 'destructive' });
        } finally {
            setSending(false);
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'order': return <ShoppingCart className="w-5 h-5" />;
            case 'user': return <Users className="w-5 h-5" />;
            case 'payment': return <DollarSign className="w-5 h-5" />;
            case 'system': return <Info className="w-5 h-5" />;
            case 'error': return <AlertCircle className="w-5 h-5" />;
            default: return <Bell className="w-5 h-5" />;
        }
    };

    const getIconColor = (type: string) => {
        switch (type) {
            case 'order': return 'bg-orange-500/20 text-orange-400';
            case 'user': return 'bg-purple-500/20 text-purple-400';
            case 'payment': return 'bg-emerald-500/20 text-emerald-400';
            case 'system': return 'bg-blue-500/20 text-blue-400';
            case 'error': return 'bg-red-500/20 text-red-400';
            default: return 'bg-slate-500/20 text-slate-400';
        }
    };

    const markAsRead = async (id: string) => {
        try {
            await adminService.markNotificationRead(id);
            setNotifications(prev => prev.map(n =>
                n.id === id ? { ...n, isRead: true } : n
            ));
        } catch (err) {
            console.error('Failed to mark notification as read:', err);
            toast({ title: 'Error', description: 'Failed to update notification', variant: 'destructive' });
        }
    };

    const markAllAsRead = async () => {
        try {
            await adminService.markAllNotificationsRead();
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
            toast({
                title: 'All Marked as Read',
                description: 'All notifications have been marked as read',
            });
        } catch (err) {
            console.error('Failed to mark all as read:', err);
            toast({ title: 'Error', description: 'Failed to update notifications', variant: 'destructive' });
        }
    };

    const deleteNotification = async (id: string) => {
        try {
            await adminService.deleteNotification(id);
            setNotifications(prev => prev.filter(n => n.id !== id));
            toast({
                title: 'Notification Deleted',
                description: 'The notification has been removed',
            });
        } catch (err) {
            console.error('Failed to delete notification:', err);
            toast({ title: 'Error', description: 'Failed to delete notification', variant: 'destructive' });
        }
    };

    const clearAll = async () => {
        try {
            await adminService.clearAllNotifications();
            setNotifications([]);
            toast({
                title: 'All Cleared',
                description: 'All notifications have been cleared',
            });
        } catch (err) {
            console.error('Failed to clear notifications:', err);
            toast({ title: 'Error', description: 'Failed to clear notifications', variant: 'destructive' });
        }
    };

    const filteredNotifications = filter === 'all'
        ? notifications
        : notifications.filter(n => !n.isRead);

    const unreadCount = notifications.filter(n => !n.isRead).length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Bell className="w-8 h-8 text-slate-400" />
                    <div>
                        <h1 className="text-2xl font-bold text-white">Notifications</h1>
                        <p className="text-slate-400">{unreadCount} unread notifications</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button
                        onClick={() => setShowCreateModal(true)}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Send Update
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={markAllAsRead}
                        disabled={unreadCount === 0}
                        className="border-slate-600 text-slate-300 hover:bg-slate-700"
                    >
                        <CheckCheck className="w-4 h-4 mr-2" />
                        Mark All Read
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-2">
                <Button
                    variant={filter === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilter('all')}
                    className={cn(
                        filter === 'all'
                            ? 'bg-emerald-500 text-white'
                            : 'border-slate-600 text-slate-300'
                    )}
                >
                    All ({notifications.length})
                </Button>
                <Button
                    variant={filter === 'unread' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilter('unread')}
                    className={cn(
                        filter === 'unread'
                            ? 'bg-emerald-500 text-white'
                            : 'border-slate-600 text-slate-300'
                    )}
                >
                    Unread ({unreadCount})
                </Button>
            </div>

            {/* Notifications List */}
            <Card className="bg-[#1e293b] border-slate-700/50">
                <CardContent className="p-0">
                    {filteredNotifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                            <Bell className="w-12 h-12 mb-4 opacity-50" />
                            <p>No notifications</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-700/50">
                            {filteredNotifications.map((notification) => (
                                <div
                                    key={notification.id}
                                    className={cn(
                                        "p-4 flex items-start gap-4 transition-colors",
                                        !notification.isRead && 'bg-slate-700/20'
                                    )}
                                >
                                    <div className={cn(
                                        "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                                        getIconColor(notification.type)
                                    )}>
                                        {getIcon(notification.type)}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <p className={cn(
                                                    "font-medium",
                                                    notification.isRead ? 'text-slate-300' : 'text-white'
                                                )}>
                                                    {notification.title}
                                                </p>
                                                <p className="text-sm text-slate-400 mt-1">{notification.message}</p>
                                                <p className="text-xs text-slate-500 mt-2">
                                                    {new Date(notification.createdAt).toLocaleString()}
                                                </p>
                                            </div>

                                            <div className="flex items-center gap-1 flex-shrink-0">
                                                {!notification.isRead && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-slate-400 hover:text-emerald-400"
                                                        onClick={() => markAsRead(notification.id)}
                                                    >
                                                        <Check className="w-4 h-4" />
                                                    </Button>
                                                )}
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-slate-400 hover:text-red-400"
                                                    onClick={() => deleteNotification(notification.id)}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Create Notification Modal */}
            <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
                <DialogContent className="bg-[#1e293b] border-slate-700 text-white">
                    <DialogHeader>
                        <DialogTitle>Send Notification / Update</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label className="text-slate-300">Target User ID (Optional - leave empty for all)</Label>
                            <Input
                                value={createForm.userId}
                                onChange={(e) => setCreateForm({ ...createForm, userId: e.target.value })}
                                placeholder="User UUID..."
                                className="bg-slate-700/50 border-slate-600 text-white"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-slate-300">Title</Label>
                            <Input
                                value={createForm.title}
                                onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                                placeholder="Update Title"
                                className="bg-slate-700/50 border-slate-600 text-white"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-slate-300">Type</Label>
                            <Select value={createForm.type} onValueChange={(value) => setCreateForm({ ...createForm, type: value })}>
                                <SelectTrigger className="w-full bg-slate-700/50 border-slate-600 text-white">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-800 border-slate-600">
                                    <SelectItem value="info" className="text-white hover:bg-slate-700 focus:bg-slate-700">Info</SelectItem>
                                    <SelectItem value="success" className="text-white hover:bg-slate-700 focus:bg-slate-700">Success</SelectItem>
                                    <SelectItem value="warning" className="text-white hover:bg-slate-700 focus:bg-slate-700">Warning</SelectItem>
                                    <SelectItem value="error" className="text-white hover:bg-slate-700 focus:bg-slate-700">Error</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-slate-300">Message</Label>
                            <textarea
                                value={createForm.message}
                                onChange={(e) => setCreateForm({ ...createForm, message: e.target.value })}
                                className="w-full h-32 p-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none resize-none"
                                placeholder="Enter notification message..."
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCreateModal(false)} className="border-slate-600">
                            Cancel
                        </Button>
                        <Button onClick={handleSendNotification} disabled={sending} className="bg-emerald-500 hover:bg-emerald-600">
                            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Notification'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
