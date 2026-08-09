import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    MessageSquare,
    Search,
    Send,
    Trash2,
    Mail,
    MailOpen,
    User,
    Loader2,
    Plus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { adminService } from '@/services';
import { useSocket } from '@/contexts/SocketContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Message {
    id: string;
    senderId: string;
    senderName: string;
    senderEmail: string;
    senderRole: string;
    recipientId: string;
    recipientName: string;
    recipientEmail: string;
    recipientRole: string;
    subject: string;
    body: string;
    isRead: boolean;
    createdAt: string;
}

export default function AdminMessagesPage() {
    const { toast } = useToast();
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
    const [replyText, setReplyText] = useState('');
    const [sending, setSending] = useState(false);
    const { socket } = useSocket();

    // New Message state
    const [showNewModal, setShowNewModal] = useState(false);
    const [newMessageForm, setNewMessageForm] = useState({ recipientEmail: '', subject: '', body: '' });
    const [users, setUsers] = useState<any[]>([]);
    const [searchingUsers, setSearchingUsers] = useState(false);

    const fetchMessages = useCallback(async () => {
        setLoading(true);
        try {
            const data = await adminService.getMessages();
            setMessages(data);
        } catch (err) {
            console.error('Error fetching messages:', err);
            toast({ title: 'Error', description: 'Failed to fetch messages', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchMessages();
    }, [fetchMessages]);

    // Socket.IO Listener
    useEffect(() => {
        if (!socket) return;

        const handleNewMessage = (msg: Message) => {
            setMessages(prev => [msg, ...prev]);
            toast({
                title: 'New Message',
                description: `From ${msg.senderName}: ${msg.subject.substring(0, 30)}...`,
            });
        };

        socket.on('newMessage', handleNewMessage);
        return () => {
            socket.off('newMessage', handleNewMessage);
        };
    }, [socket, toast]);

    const fetchUsers = async () => {
        setSearchingUsers(true);
        try {
            const data = await adminService.getUsers();
            setUsers(data);
        } catch (err) {
            console.error('Failed to fetch users:', err);
        } finally {
            setSearchingUsers(false);
        }
    };

    useEffect(() => {
        if (showNewModal) {
            fetchUsers();
        }
    }, [showNewModal]);

    const filteredMessages = messages.filter(msg =>
        (msg.senderName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (msg.subject || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (msg.senderEmail || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const markAsRead = async (messageId: string) => {
        try {
            await adminService.markMessageRead(messageId);
            setMessages(prev => prev.map(msg =>
                msg.id === messageId ? { ...msg, isRead: true } : msg
            ));
        } catch (err) {
            console.error('Failed to mark message as read:', err);
        }
    };

    const deleteMessage = async (messageId: string) => {
        try {
            await adminService.deleteMessage(messageId);
            setMessages(prev => prev.filter(msg => msg.id !== messageId));
            if (selectedMessage?.id === messageId) {
                setSelectedMessage(null);
            }
            toast({
                title: 'Message Deleted',
                description: 'The message has been deleted',
            });
        } catch (err) {
            console.error('Failed to delete message:', err);
            toast({ title: 'Error', description: 'Failed to delete message', variant: 'destructive' });
        }
    };

    const sendReply = async () => {
        if (!replyText.trim() || !selectedMessage) return;

        setSending(true);
        try {
            await adminService.sendMessage({
                recipientId: selectedMessage.senderId,
                subject: `Re: ${selectedMessage.subject}`,
                body: replyText
            });

            toast({
                title: 'Reply Sent',
                description: `Reply sent to ${selectedMessage.senderName}`,
            });

            setReplyText('');
            setSending(false);
        } catch (err) {
            console.error('Send reply error:', err);
            toast({ title: 'Error', description: 'Failed to send reply', variant: 'destructive' });
            setSending(false);
        }
    };

    const handleNewMessage = async () => {
        if (!newMessageForm.recipientEmail || !newMessageForm.body) return;

        setSending(true);
        try {
            const targetUser = users.find(u => u.email === newMessageForm.recipientEmail);
            if (!targetUser) throw new Error('User not found');

            await adminService.sendMessage({
                recipientId: targetUser.id,
                subject: newMessageForm.subject || 'Direct Message from Admin',
                body: newMessageForm.body
            });

            toast({ title: 'Success', description: 'Message sent successfully' });
            setShowNewModal(false);
            setNewMessageForm({ recipientEmail: '', subject: '', body: '' });
            fetchMessages();
        } catch (err: any) {
            console.error('Send message error:', err);
            toast({ title: 'Error', description: err.message || 'Failed to send message', variant: 'destructive' });
        } finally {
            setSending(false);
        }
    };

    const selectMessage = (message: Message) => {
        setSelectedMessage(message);
        if (!message.isRead) {
            markAsRead(message.id);
        }
    };

    const getInitials = (name: string) => {
        return (name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    const getRoleBadge = (role: string) => {
        const colors: Record<string, string> = {
            admin: 'bg-purple-500/20 text-purple-400',
            superagent: 'bg-emerald-500/20 text-emerald-400',
            agent: 'bg-blue-500/20 text-blue-400',
            customer: 'bg-slate-500/20 text-slate-400',
            system: 'bg-amber-500/20 text-amber-400',
        };
        const label = role === 'superagent' ? 'SuperAgent' : role.charAt(0).toUpperCase() + role.slice(1);
        return (
            <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full ${colors[role] || colors.customer}`}>
                {label}
            </span>
        );
    };

    const unreadCount = messages.filter(m => !m.isRead).length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <MessageSquare className="w-8 h-8 text-slate-400" />
                <div>
                    <h1 className="text-2xl font-bold text-white">Messages</h1>
                    <p className="text-slate-400">{unreadCount} unread messages</p>
                </div>
                <div className="ml-auto">
                    <Button onClick={() => setShowNewModal(true)} className="bg-emerald-500 hover:bg-emerald-600">
                        <Plus className="w-4 h-4 mr-2" />
                        New Message
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Messages List */}
                <Card className="lg:col-span-1 bg-[#1e293b] border-slate-700/50">
                    <CardContent className="p-4 space-y-4">
                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <Input
                                placeholder="Search messages..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                            />
                        </div>

                        {/* Message List */}
                        <div className="space-y-2 max-h-[500px] overflow-y-auto">
                            {loading ? (
                                <div className="space-y-2">
                                    {Array.from({ length: 5 }).map((_, i) => (
                                        <div key={i} className="p-3 rounded-lg flex items-start gap-3">
                                            <Skeleton className="h-10 w-10 rounded-full bg-slate-700 flex-shrink-0" />
                                            <div className="flex-1 space-y-1.5">
                                                <div className="flex items-center justify-between">
                                                    <Skeleton className="h-4 w-28 bg-slate-700" />
                                                    <Skeleton className="h-3 w-16 bg-slate-700" />
                                                </div>
                                                <Skeleton className="h-3 w-3/4 bg-slate-700" />
                                                <Skeleton className="h-3 w-1/2 bg-slate-700" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : filteredMessages.length === 0 ? (
                                <div className="text-center py-8 text-slate-500">
                                    No messages found
                                </div>
                            ) : (
                                filteredMessages.map((message) => (
                                    <div
                                        key={message.id}
                                        onClick={() => selectMessage(message)}
                                        className={cn(
                                            "p-3 rounded-lg cursor-pointer transition-all",
                                            selectedMessage?.id === message.id
                                                ? 'bg-emerald-500/20 border border-emerald-500/50'
                                                : 'bg-slate-700/30 hover:bg-slate-700/50 border border-transparent',
                                            !message.isRead && 'border-l-4 border-l-emerald-500'
                                        )}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                                                {getInitials(message.senderName)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-1.5">
                                                        <p className={cn(
                                                            "font-medium text-sm truncate",
                                                            message.isRead ? 'text-slate-300' : 'text-white'
                                                        )}>
                                                            {message.senderName || 'Anonymous'}
                                                        </p>
                                                        {getRoleBadge(message.senderRole || 'customer')}
                                                    </div>
                                                    {!message.isRead && (
                                                        <Mail className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                                                    )}
                                                </div>
                                                <p className="text-xs text-slate-400 truncate">{message.subject}</p>
                                                <p className="text-xs text-slate-500 mt-1">
                                                    {new Date(message.createdAt).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Message Detail */}
                <Card className="lg:col-span-2 bg-[#1e293b] border-slate-700/50">
                    <CardContent className="p-6">
                        {selectedMessage ? (
                            <div className="space-y-6">
                                {/* Header */}
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-semibold">
                                            {getInitials(selectedMessage.senderName)}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="font-semibold text-white">{selectedMessage.senderName}</p>
                                                {getRoleBadge(selectedMessage.senderRole || 'customer')}
                                            </div>
                                            <p className="text-sm text-slate-400">{selectedMessage.senderEmail}</p>
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                        onClick={() => deleteMessage(selectedMessage.id)}
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </Button>
                                </div>

                                {/* Subject */}
                                <div>
                                    <h2 className="text-xl font-semibold text-white">{selectedMessage.subject}</h2>
                                    <p className="text-sm text-slate-400 mt-1">
                                        {new Date(selectedMessage.createdAt).toLocaleString()}
                                    </p>
                                </div>

                                {/* Message Body */}
                                <div className="p-4 bg-slate-700/30 rounded-lg">
                                    <p className="text-slate-300 whitespace-pre-wrap">{selectedMessage.body}</p>
                                </div>

                                {/* Reply */}
                                <div className="space-y-3">
                                    <label className="text-sm font-medium text-slate-300">Reply</label>
                                    <textarea
                                        value={replyText}
                                        onChange={(e) => setReplyText(e.target.value)}
                                        placeholder="Type your reply..."
                                        className="w-full h-32 p-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none resize-none"
                                    />
                                    <Button
                                        onClick={sendReply}
                                        disabled={!replyText.trim() || sending}
                                        className="bg-emerald-500 hover:bg-emerald-600 text-white"
                                    >
                                        {sending ? (
                                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                        ) : (
                                            <Send className="w-4 h-4 mr-2" />
                                        )}
                                        Send Reply
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-[400px] text-slate-400">
                                <MailOpen className="w-16 h-16 mb-4 opacity-50" />
                                <p>Select a message to view</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* New Message Modal */}
            <Dialog open={showNewModal} onOpenChange={setShowNewModal}>
                <DialogContent className="bg-[#1e293b] border-slate-700 text-white">
                    <DialogHeader>
                        <DialogTitle>Compose New Message</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label className="text-slate-300">Recipient User</Label>
                            <Select
                                value={newMessageForm.recipientEmail}
                                onValueChange={(val) => setNewMessageForm({ ...newMessageForm, recipientEmail: val })}
                            >
                                <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white">
                                    <SelectValue placeholder="Select a user..." />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-800 border-slate-600">
                                    {users.map(u => (
                                        <SelectItem key={u.id} value={u.email} className="text-white hover:bg-slate-700">
                                            {u.fullName} ({u.email}) — [{u.role === 'superagent' ? 'SuperAgent' : (u.role || 'customer').charAt(0).toUpperCase() + (u.role || 'customer').slice(1)}]
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-slate-300">Subject</Label>
                            <Input
                                value={newMessageForm.subject}
                                onChange={(e) => setNewMessageForm({ ...newMessageForm, subject: e.target.value })}
                                placeholder="Message Subject"
                                className="bg-slate-700/50 border-slate-600 text-white"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-slate-300">Message Content</Label>
                            <textarea
                                value={newMessageForm.body}
                                onChange={(e) => setNewMessageForm({ ...newMessageForm, body: e.target.value })}
                                className="w-full h-40 p-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none resize-none"
                                placeholder="Type your message here..."
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowNewModal(false)} className="border-slate-600">
                            Cancel
                        </Button>
                        <Button onClick={handleNewMessage} disabled={sending || !newMessageForm.recipientEmail || !newMessageForm.body} className="bg-emerald-500 hover:bg-emerald-600">
                            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Message'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
