import { useState, useEffect, useCallback } from 'react';
import { adminService } from '@/services';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
    Mail,
    Send,
    Users,
    Loader2,
    CheckCircle,
    Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmailTemplate {
    id: string;
    name: string;
    subject: string;
    preview: string;
}

interface SentEmail {
    id: string;
    subject: string;
    recipients: string;
    sent_at: string;
    status: 'sent' | 'pending' | 'failed';
}

export default function AdminSendEmailPage() {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [recipientType, setRecipientType] = useState<'all' | 'customers' | 'agents' | 'custom'>('all');
    const [customEmails, setCustomEmails] = useState('');
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [recipientCount, setRecipientCount] = useState(0);

    const [sentEmails, setSentEmails] = useState<SentEmail[]>([
        { id: '1', subject: 'Welcome to ByteBeacon', recipients: 'All Users (150)', sent_at: '2024-12-27T10:00:00Z', status: 'sent' },
        { id: '2', subject: 'New Features Available', recipients: 'Agents (25)', sent_at: '2024-12-26T15:30:00Z', status: 'sent' },
        { id: '3', subject: 'Holiday Promotion', recipients: 'Customers (125)', sent_at: '2024-12-25T09:00:00Z', status: 'sent' },
    ]);

    const templates: EmailTemplate[] = [
        { id: '1', name: 'Welcome', subject: 'Welcome to ByteBeacon!', preview: 'Thank you for joining our platform...' },
        { id: '2', name: 'Promotion', subject: 'Special Offer Just for You!', preview: 'We have an exclusive deal...' },
        { id: '3', name: 'Update', subject: 'Important Platform Update', preview: 'We are excited to announce...' },
        { id: '4', name: 'Maintenance', subject: 'Scheduled Maintenance Notice', preview: 'Our platform will undergo...' },
    ];

    const fetchRecipientCount = useCallback(async () => {
        try {
            if (recipientType === 'custom') {
                const emails = customEmails.split(',').filter(e => e.trim());
                setRecipientCount(emails.length);
                return;
            }

            const stats = await adminService.getStats();

            if (recipientType === 'agents') {
                // Approximate from users for now, or just show total
                // In a real scenario, we'd have a specific stat for agents
                setRecipientCount(Math.round(stats.totalUsers * 0.15)); // Mocking agent count
                return;
            } else if (recipientType === 'customers') {
                setRecipientCount(Math.round(stats.totalUsers * 0.85)); // Mocking customer count
                return;
            }

            setRecipientCount(stats.totalUsers);
        } catch (err) {
            console.error('Error fetching recipient count:', err);
        }
    }, [recipientType, customEmails]);

    useEffect(() => {
        fetchRecipientCount();
    }, [fetchRecipientCount, recipientType]);

    const applyTemplate = (template: EmailTemplate) => {
        setSubject(template.subject);
        setMessage(template.preview + '\n\n[Add your full message here...]');
        toast({ title: 'Template Applied', description: `"${template.name}" template loaded` });
    };

    const handleSend = async () => {
        if (!subject || !message) {
            toast({ title: 'Error', description: 'Please fill in subject and message', variant: 'destructive' });
            return;
        }

        if (recipientCount === 0) {
            toast({ title: 'Error', description: 'No recipients selected', variant: 'destructive' });
            return;
        }

        setLoading(true);

        try {
            // Call adminService to send email
            await adminService.sendEmail({
                to: recipientType === 'custom' ? customEmails : recipientType,
                subject,
                body: message
            });

            const recipientLabel = recipientType === 'all' ? `All Users(${recipientCount})` :
                recipientType === 'customers' ? `Customers(${recipientCount})` :
                    recipientType === 'agents' ? `Agents(${recipientCount})` : `Custom(${recipientCount})`;

            setSentEmails(prev => [{
                id: Date.now().toString(),
                subject,
                recipients: recipientLabel,
                sent_at: new Date().toISOString(),
                status: 'sent',
            }, ...prev]);

            toast({ title: 'Email Sent!', description: `Successfully sent to ${recipientCount} recipients` });
            setSubject('');
            setMessage('');
        } catch (err) {
            console.error('Send email error:', err);
            toast({ title: 'Error', description: 'Failed to send email', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <Mail className="w-8 h-8 text-slate-400" />
                <div>
                    <h1 className="text-2xl font-bold text-white">Send Email</h1>
                    <p className="text-slate-400">Send emails to customers and agents</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Compose Email */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Recipients */}
                    <Card className="bg-[#1e293b] border-slate-700/50">
                        <CardHeader>
                            <CardTitle className="text-white text-lg flex items-center gap-2">
                                <Users className="w-5 h-5" />
                                Recipients
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex gap-2 flex-wrap">
                                {(['all', 'customers', 'agents', 'custom'] as const).map((type) => (
                                    <Button
                                        key={type}
                                        variant={recipientType === type ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setRecipientType(type)}
                                        className={cn(
                                            recipientType === type
                                                ? 'bg-emerald-500 text-white'
                                                : 'border-slate-600 text-slate-300'
                                        )}
                                    >
                                        {type === 'all' ? 'All Users' : type.charAt(0).toUpperCase() + type.slice(1)}
                                    </Button>
                                ))}
                            </div>

                            {recipientType === 'custom' && (
                                <div className="space-y-2">
                                    <Label className="text-slate-300">Email Addresses (comma-separated)</Label>
                                    <Input
                                        value={customEmails}
                                        onChange={(e) => { setCustomEmails(e.target.value); fetchRecipientCount(); }}
                                        className="bg-slate-700/50 border-slate-600 text-white"
                                        placeholder="email1@example.com, email2@example.com"
                                    />
                                </div>
                            )}

                            <div className="p-3 bg-slate-700/30 rounded-lg">
                                <span className="text-sm text-slate-400">Selected Recipients: </span>
                                <span className="text-white font-medium">{recipientCount}</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Compose */}
                    <Card className="bg-[#1e293b] border-slate-700/50">
                        <CardHeader>
                            <CardTitle className="text-white text-lg">Compose Message</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-slate-300">Subject</Label>
                                <Input
                                    value={subject}
                                    onChange={(e) => setSubject(e.target.value)}
                                    className="bg-slate-700/50 border-slate-600 text-white"
                                    placeholder="Email subject..."
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-slate-300">Message</Label>
                                <textarea
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    className="w-full h-48 p-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none resize-none"
                                    placeholder="Type your message here..."
                                />
                            </div>
                            <Button
                                onClick={handleSend}
                                disabled={loading || !subject || !message || recipientCount === 0}
                                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white"
                            >
                                {loading ? (
                                    <><Loader2 className="w-4 h-4 animate-spin mr-2" />Sending...</>
                                ) : (
                                    <><Send className="w-4 h-4 mr-2" />Send to {recipientCount} Recipients</>
                                )}
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Sidebar */}
                <div className="space-y-6">
                    {/* Templates */}
                    <Card className="bg-[#1e293b] border-slate-700/50">
                        <CardHeader>
                            <CardTitle className="text-white text-lg">Quick Templates</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {templates.map((template) => (
                                <button
                                    key={template.id}
                                    onClick={() => applyTemplate(template)}
                                    className="w-full p-3 text-left bg-slate-700/30 rounded-lg hover:bg-slate-700/50 transition-colors"
                                >
                                    <p className="font-medium text-white text-sm">{template.name}</p>
                                    <p className="text-xs text-slate-400 truncate">{template.subject}</p>
                                </button>
                            ))}
                        </CardContent>
                    </Card>

                    {/* Recent Emails */}
                    <Card className="bg-[#1e293b] border-slate-700/50">
                        <CardHeader>
                            <CardTitle className="text-white text-lg">Recent Emails</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {sentEmails.slice(0, 5).map((email) => (
                                <div key={email.id} className="p-3 bg-slate-700/30 rounded-lg">
                                    <div className="flex items-start justify-between">
                                        <p className="font-medium text-white text-sm truncate flex-1">{email.subject}</p>
                                        {email.status === 'sent' ? (
                                            <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                                        ) : (
                                            <Clock className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-400 mt-1">{email.recipients}</p>
                                    <p className="text-xs text-slate-500 mt-1">
                                        {new Date(email.sent_at).toLocaleDateString()}
                                    </p>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
