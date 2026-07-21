import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { userService } from '@/services';
import { useSocket } from '@/contexts/SocketContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
    MessageSquare,
    Search,
    Trash2,
    User,
    Loader2,
    Send,
    Plus,
    X
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

interface Message {
    id: string;
    senderId: string;
    senderName: string;
    recipientId?: string;
    recipientName?: string;
    subject: string;
    body: string;
    createdAt: string;
    isRead: boolean;
    isOutgoing?: boolean;
}

export default function MessagesPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
    const { socket } = useSocket();

    // Compose modal state
    const [showComposeModal, setShowComposeModal] = useState(false);
    const [composeSubject, setComposeSubject] = useState('');
    const [composeBody, setComposeBody] = useState('');
    const [sending, setSending] = useState(false);

    const fetchMessages = useCallback(async () => {
        setLoading(true);
        try {
            const data = await userService.getMessages();
            setMessages(data.map(m => ({
                id: m.id,
                senderId: m.senderId,
                senderName: m.senderName,
                recipientId: m.recipientId,
                recipientName: m.recipientName,
                subject: m.subject,
                body: m.body,
                createdAt: m.createdAt,
                isRead: m.isRead,
                isOutgoing: m.isOutgoing
            })));
        } catch (err) {
            console.error('Failed to fetch messages:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchMessages();
    }, [fetchMessages]);

    // Socket.IO Listener
    useEffect(() => {
        if (!socket) return;

        const handleNewMessage = (msg: Message) => {
            setMessages(prev => [msg, ...prev]);
        };

        socket.on('newMessage', handleNewMessage);
        return () => {
            socket.off('newMessage', handleNewMessage);
        };
    }, [socket]);

    const filteredMessages = messages.filter(m =>
        m.senderName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.subject.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const markAsRead = async (id: string) => {
        try {
            await userService.markMessageRead(id);
            setMessages(prev => prev.map(m =>
                m.id === id ? { ...m, isRead: true } : m
            ));
        } catch (err) {
            console.error('Failed to mark message as read:', err);
        }
    };

    const deleteMessage = async (id: string) => {
        try {
            await userService.deleteMessage(id);
            setMessages(prev => prev.filter(m => m.id !== id));
            if (selectedMessage?.id === id) {
                setSelectedMessage(null);
            }
            toast({ title: 'Message Deleted', description: 'Message has been removed' });
        } catch (err) {
            console.error('Failed to delete message:', err);
            toast({ title: 'Error', description: 'Failed to delete message', variant: 'destructive' });
        }
    };

    const handleSendMessage = async () => {
        if (!composeSubject.trim() || !composeBody.trim()) {
            toast({ title: 'Error', description: 'Please fill in subject and message', variant: 'destructive' });
            return;
        }

        setSending(true);
        try {
            await userService.sendMessage({ subject: composeSubject, body: composeBody });
            toast({ title: 'Message Sent', description: 'Your message has been sent to support' });
            setShowComposeModal(false);
            setComposeSubject('');
            setComposeBody('');
        } catch (err) {
            console.error('Failed to send message:', err);
            toast({ title: 'Error', description: 'Failed to send message', variant: 'destructive' });
        } finally {
            setSending(false);
        }
    };

    const handleReply = (message: Message) => {
        setComposeSubject(`Re: ${message.subject}`);
        setComposeBody(`\n\n--- Original Message ---\nFrom: ${message.senderName}\nDate: ${new Date(message.createdAt).toLocaleString()}\n\n${message.body}`);
        setShowComposeModal(true);
    };

    const unreadCount = messages.filter(m => !m.isRead).length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <MessageSquare className="w-8 h-8 text-muted-foreground" />
                    <div>
                        <h1 className="font-display text-2xl md:text-3xl font-bold">Messages</h1>
                        <p className="text-muted-foreground">
                            {unreadCount > 0 ? `${unreadCount} unread message${unreadCount > 1 ? 's' : ''}` : 'All messages read'}
                        </p>
                    </div>
                </div>
                <Button onClick={() => setShowComposeModal(true)} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Contact Support
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Messages List */}
                <div className="lg:col-span-1 space-y-4">
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Search messages..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9"
                        />
                    </div>

                    {/* Message List */}
                    <div className="space-y-2">
                        {loading ? (
                            <div className="space-y-2">
                                {Array.from({ length: 5 }).map((_, i) => (
                                    <Card key={i}>
                                        <CardContent className="p-4">
                                            <div className="flex items-start gap-3">
                                                <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
                                                <div className="flex-1 space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <Skeleton className="h-4 w-28" />
                                                        <Skeleton className="w-2 h-2 rounded-full" />
                                                    </div>
                                                    <Skeleton className="h-4 w-3/4" />
                                                    <Skeleton className="h-3 w-full" />
                                                    <Skeleton className="h-3 w-20" />
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        ) : filteredMessages.length === 0 ? (
                            <Card>
                                <CardContent className="py-8 text-center">
                                    <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                                    <p className="text-muted-foreground">No messages</p>
                                    <p className="text-xs text-muted-foreground mt-1">Click "Contact Support" to send a message</p>
                                </CardContent>
                            </Card>
                        ) : (
                            filteredMessages.map((message) => (
                                <Card
                                    key={message.id}
                                    className={`cursor-pointer transition-colors hover:border-primary/50 ${selectedMessage?.id === message.id ? 'border-primary' : ''
                                        } ${!message.isRead ? 'bg-primary/5' : ''}`}
                                    onClick={() => {
                                        setSelectedMessage(message);
                                        markAsRead(message.id);
                                    }}
                                >
                                    <CardContent className="p-4">
                                        <div className="flex items-start gap-3">
                                            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                                                <User className="w-5 h-5 text-primary" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2">
                                                    <p className={`font-semibold text-sm truncate ${!message.isRead ? 'text-foreground' : 'text-muted-foreground'}`}>
                                                        {message.senderName}
                                                    </p>
                                                    {!message.isRead && (
                                                        <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0"></span>
                                                    )}
                                                </div>
                                                <p className="text-sm font-medium truncate">{message.subject}</p>
                                                <p className="text-xs text-muted-foreground truncate">{message.body}</p>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    {new Date(message.createdAt).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </div>
                </div>

                {/* Message Detail */}
                <Card className="lg:col-span-2">
                    {selectedMessage ? (
                        <>
                            <CardHeader className="flex flex-row items-start justify-between">
                                <div className="flex items-start gap-3">
                                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                                        <User className="w-6 h-6 text-primary" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            {selectedMessage.subject}
                                            {selectedMessage.isOutgoing && (
                                                <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">
                                                    Sent
                                                </span>
                                            )}
                                        </CardTitle>
                                        <p className="text-sm text-muted-foreground">
                                            {selectedMessage.isOutgoing ? `To: Support Team` : `From: ${selectedMessage.senderName}`}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {new Date(selectedMessage.createdAt).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {!selectedMessage.isOutgoing && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleReply(selectedMessage)}
                                            className="gap-2"
                                        >
                                            <Send className="w-4 h-4" />
                                            Reply
                                        </Button>
                                    )}
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => deleteMessage(selectedMessage.id)}
                                    >
                                        <Trash2 className="w-4 h-4 text-red-500" />
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm leading-relaxed whitespace-pre-wrap">{selectedMessage.body}</p>
                            </CardContent>
                        </>
                    ) : (
                        <CardContent className="py-16 text-center">
                            <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                            <p className="text-muted-foreground">Select a message to read</p>
                        </CardContent>
                    )}
                </Card>
            </div>

            {/* Compose Modal */}
            <Dialog open={showComposeModal} onOpenChange={setShowComposeModal}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Send className="w-5 h-5" />
                            Contact Support
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Subject</Label>
                            <Input
                                value={composeSubject}
                                onChange={(e) => setComposeSubject(e.target.value)}
                                placeholder="What can we help you with?"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Message</Label>
                            <textarea
                                value={composeBody}
                                onChange={(e) => setComposeBody(e.target.value)}
                                className="w-full h-40 p-3 border rounded-md bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                                placeholder="Describe your issue or question in detail..."
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowComposeModal(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSendMessage} disabled={sending}>
                            {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                            Send Message
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
