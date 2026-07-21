import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { 
    ShieldCheck, Key, Eye, EyeOff, Copy, Check, Save, 
    Network, History, DollarSign, Activity, HelpCircle, Loader2, AlertCircle 
} from 'lucide-react';
import userService from '@/services/user.service';

export default function PartnerConsole() {
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [profile, setProfile] = useState<any>(null);
    const [logs, setLogs] = useState<any>({ webhookLogs: [], apiLogs: [], ledger: [] });
    const [showSecret, setShowSecret] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // Form inputs
    const [webhookUrl, setWebhookUrl] = useState('');
    const [ipWhitelist, setIpWhitelist] = useState('');

    const fetchPartnerData = async () => {
        try {
            setLoading(true);
            const prof = await userService.getPartnerProfile();
            setProfile(prof);
            
            if (prof.hasPartnerProfile) {
                setWebhookUrl(prof.webhook_url || '');
                setIpWhitelist(prof.ip_whitelist || '');
                
                const logData = await userService.getPartnerLogs();
                setLogs(logData);
            }
        } catch (err: any) {
            console.error('Failed to load partner profile:', err);
            toast({
                title: 'Error',
                description: 'Failed to load partner integration profile.',
                variant: 'destructive'
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPartnerData();
    }, []);

    const copyText = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        toast({
            title: 'Copied!',
            description: 'Copied to clipboard.'
        });
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleSaveSettings = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await userService.updatePartnerSettings({
                webhook_url: webhookUrl,
                ip_whitelist: ipWhitelist
            });
            if (res.success) {
                toast({
                    title: 'Settings Saved',
                    description: 'Your API whitelists and webhooks have been updated.'
                });
                fetchPartnerData();
            }
        } catch (err: any) {
            toast({
                title: 'Failed to Save Settings',
                description: err.response?.data?.error || err.message || 'Verification failed.',
                variant: 'destructive'
            });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="w-10 h-10 animate-spin text-cyan-500" />
            </div>
        );
    }

    if (!profile || !profile.hasPartnerProfile) {
        return (
            <div className="max-w-4xl mx-auto p-4 space-y-6">
                <div className="flex items-center gap-2">
                    <ShieldCheck className="w-6 h-6 text-slate-400" />
                    <h1 className="text-2xl font-bold">Partner Console</h1>
                </div>
                <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-md">
                    <CardHeader>
                        <CardTitle className="text-white">API Access Restricted</CardTitle>
                        <CardDescription className="text-slate-400">
                            Reseller API integration is reserved for registered corporate partners.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 text-slate-300 text-sm">
                        <div className="p-4 rounded-xl bg-cyan-500/5 border border-cyan-500/20 flex gap-3">
                            <AlertCircle className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                            <div>
                                <h4 className="font-semibold text-white">How to apply for API Reseller Credentials:</h4>
                                <p className="text-slate-400 mt-1 text-xs leading-relaxed">
                                    If you resell bundles at high volumes and run automated sites/apps, you can apply for corporate partner credentials. Standard agent pricing maps automatically.
                                </p>
                            </div>
                        </div>
                        <p>
                            To request credentials, send a message to ByteBeacon Admin via the <span className="text-cyan-400">Messages</span> tab on your dashboard containing your business details, expected transaction volumes, and static server IP addresses.
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Determine billing mode badge
    const getBillingMode = () => {
        if (profile.allow_unlimited_purchases) return 'Trusted Partner (Unlimited)';
        if (profile.credit_enabled) return `Credit Account (Limit: ₵${parseFloat(profile.credit_limit).toFixed(2)})`;
        return 'Prepaid Wallet';
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2 text-white">
                        <ShieldCheck className="w-6 h-6 text-cyan-400" />
                        Developer Console & Reseller Hub
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">
                        Manage API integration, webhook endpoints, and ledger accounts for <span className="text-cyan-400 font-semibold">{profile.business_name}</span>
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider border ${
                        profile.status === 'active' 
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                            : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
                    }`}>
                        Status: {profile.status}
                    </span>
                </div>
            </div>

            {/* Financial Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-slate-900/60 border-slate-800/80 backdrop-blur-sm shadow-xl">
                    <CardHeader className="py-4">
                        <CardDescription className="text-slate-400 text-xs">Billing Model</CardDescription>
                        <CardTitle className="text-base text-cyan-400 flex items-center gap-1.5 mt-0.5">
                            <DollarSign className="w-4 h-4" />
                            {getBillingMode()}
                        </CardTitle>
                    </CardHeader>
                </Card>

                <Card className="bg-slate-900/60 border-slate-800/80 backdrop-blur-sm shadow-xl">
                    <CardHeader className="py-4">
                        <CardDescription className="text-slate-400 text-xs">Prepaid Balance</CardDescription>
                        <CardTitle className="text-xl text-white font-mono mt-0.5">
                            ₵{parseFloat(profile.wallet_balance).toFixed(2)}
                        </CardTitle>
                    </CardHeader>
                </Card>

                <Card className="bg-slate-900/60 border-slate-800/80 backdrop-blur-sm shadow-xl">
                    <CardHeader className="py-4">
                        <CardDescription className="text-slate-400 text-xs">Outstanding Debt</CardDescription>
                        <CardTitle className="text-xl text-slate-300 font-mono mt-0.5">
                            ₵{parseFloat(profile.outstanding_balance).toFixed(2)}
                        </CardTitle>
                    </CardHeader>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Panel: Credentials & Config */}
                <div className="lg:col-span-1 space-y-6">
                    {/* API Credentials */}
                    <Card className="bg-slate-900/40 border-slate-800 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2 text-white">
                                <Key className="w-4 h-4 text-cyan-400" />
                                API Credentials
                            </CardTitle>
                            <CardDescription className="text-xs text-slate-400">
                                Credentials required for HMAC headers signing.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] uppercase font-semibold tracking-wider text-slate-400">API Key</label>
                                <div className="flex gap-2">
                                    <Input 
                                        readOnly 
                                        value={profile.api_key} 
                                        className="bg-slate-950 border-slate-800 font-mono text-xs text-slate-300 h-9" 
                                    />
                                    <Button 
                                        variant="outline" 
                                        size="icon" 
                                        className="border-slate-800 h-9 w-9 hover:bg-slate-800"
                                        onClick={() => copyText(profile.api_key, 'key')}
                                    >
                                        {copiedId === 'key' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] uppercase font-semibold tracking-wider text-slate-400">API Secret</label>
                                <div className="flex gap-2">
                                    <Input 
                                        readOnly 
                                        type={showSecret ? 'text' : 'password'} 
                                        value={profile.api_secret || ''} 
                                        className="bg-slate-950 border-slate-800 font-mono text-xs text-slate-300 h-9" 
                                    />
                                    <Button 
                                        variant="outline" 
                                        size="icon" 
                                        className="border-slate-800 h-9 w-9 hover:bg-slate-800"
                                        onClick={() => setShowSecret(!showSecret)}
                                    >
                                        {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </Button>
                                    <Button 
                                        variant="outline" 
                                        size="icon" 
                                        className="border-slate-800 h-9 w-9 hover:bg-slate-800"
                                        onClick={() => copyText(profile.api_secret || '', 'secret')}
                                    >
                                        {copiedId === 'secret' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Integration config */}
                    <Card className="bg-slate-900/40 border-slate-800 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2 text-white">
                                <Network className="w-4 h-4 text-cyan-400" />
                                Integration Settings
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSaveSettings} className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] uppercase font-semibold tracking-wider text-slate-400 flex items-center gap-1.5">
                                        Webhook URL
                                    </label>
                                    <Input 
                                        placeholder="https://yourdomain.com/webhooks" 
                                        value={webhookUrl}
                                        onChange={e => setWebhookUrl(e.target.value)}
                                        className="bg-slate-950 border-slate-800 text-xs h-9 text-slate-200" 
                                    />
                                    <p className="text-[10px] text-slate-500 leading-normal">
                                        URL where transaction status callbacks are posted. Safe public domains only.
                                    </p>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] uppercase font-semibold tracking-wider text-slate-400">
                                        IP Whitelist
                                    </label>
                                    <Input 
                                        placeholder="e.g. 192.168.1.100, 192.168.1.101" 
                                        value={ipWhitelist}
                                        onChange={e => setIpWhitelist(e.target.value)}
                                        className="bg-slate-950 border-slate-800 text-xs h-9 text-slate-200" 
                                    />
                                    <p className="text-[10px] text-slate-500 leading-normal">
                                        Comma-separated server IPs whitelisted to make requests. Blank allows any IP.
                                    </p>
                                </div>

                                <Button type="submit" disabled={saving} className="w-full justify-center gap-2 h-9 bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs">
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    Save Configuration
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Panel: Audit Logs */}
                <div className="lg:col-span-2">
                    <Card className="bg-slate-900/40 border-slate-800 backdrop-blur-sm h-full flex flex-col">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center gap-2 text-white">
                                <History className="w-4 h-4 text-cyan-400" />
                                Integration Logs & Ledger Ledger
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex-1 flex flex-col">
                            <Tabs defaultValue="ledger" className="w-full flex-1 flex flex-col">
                                <TabsList className="bg-slate-950/80 border-slate-850 grid grid-cols-3">
                                    <TabsTrigger value="ledger" className="text-xs">Ledger</TabsTrigger>
                                    <TabsTrigger value="webhooks" className="text-xs">Webhook Logs</TabsTrigger>
                                    <TabsTrigger value="apilogs" className="text-xs">API logs</TabsTrigger>
                                </TabsList>

                                {/* 1. Ledger */}
                                <TabsContent value="ledger" className="flex-1 overflow-y-auto mt-4 max-h-[400px] pr-1">
                                    {logs.ledger.length === 0 ? (
                                        <div className="text-center py-8 text-xs text-slate-500">No ledger transactions found.</div>
                                    ) : (
                                        <div className="space-y-2">
                                            {logs.ledger.map((entry: any) => (
                                                <div key={entry.id} className="p-3 bg-slate-950/40 rounded-xl border border-slate-850 flex justify-between items-center text-xs">
                                                    <div className="space-y-1">
                                                        <div className="font-semibold text-slate-200">{entry.description}</div>
                                                        <div className="text-[10px] text-slate-500">Ref: {entry.reference || 'None'} &bull; {new Date(entry.created_at).toLocaleString()}</div>
                                                    </div>
                                                    <span className={`font-semibold font-mono ${
                                                        entry.type === 'debit' ? 'text-rose-400' : 'text-emerald-400'
                                                    }`}>
                                                        {entry.type === 'debit' ? '-' : '+'}₵{Math.abs(parseFloat(entry.amount)).toFixed(2)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </TabsContent>

                                {/* 2. Webhook Logs */}
                                <TabsContent value="webhooks" className="flex-1 overflow-y-auto mt-4 max-h-[400px] pr-1">
                                    {logs.webhookLogs.length === 0 ? (
                                        <div className="text-center py-8 text-xs text-slate-500">No webhook logs recorded.</div>
                                    ) : (
                                        <div className="space-y-2">
                                            {logs.webhookLogs.map((log: any) => (
                                                <div key={log.id} className="p-3 bg-slate-950/40 rounded-xl border border-slate-850 flex justify-between items-center text-xs">
                                                    <div className="space-y-1">
                                                        <div className="font-mono text-slate-300 text-[10px] truncate max-w-xs">{log.webhook_url}</div>
                                                        <div className="text-[10px] text-slate-500">Tx: {log.transaction_id.slice(0, 8)}... &bull; Attempt: {log.attempt} &bull; {new Date(log.created_at).toLocaleTimeString()}</div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                                                            log.status === 'success' 
                                                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                                                                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                                        }`}>
                                                            {log.status}
                                                        </span>
                                                        <span className="font-mono text-[10px] text-slate-400">[{log.response_code || 'Err'}]</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </TabsContent>

                                {/* 3. API Logs */}
                                <TabsContent value="apilogs" className="flex-1 overflow-y-auto mt-4 max-h-[400px] pr-1">
                                    {logs.apiLogs.length === 0 ? (
                                        <div className="text-center py-8 text-xs text-slate-500">No API calls logged.</div>
                                    ) : (
                                        <div className="space-y-2">
                                            {logs.apiLogs.map((log: any) => (
                                                <div key={log.id} className="p-3 bg-slate-950/40 rounded-xl border border-slate-850 flex justify-between items-center text-xs">
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                                                log.method === 'GET' ? 'bg-blue-500/10 text-blue-400' : 'bg-emerald-500/10 text-emerald-400'
                                                            }`}>{log.method}</span>
                                                            <code className="text-slate-300 font-mono text-[11px]">{log.path}</code>
                                                        </div>
                                                        <div className="text-[10px] text-slate-500">IP: {log.ip_address} &bull; {new Date(log.created_at).toLocaleString()}</div>
                                                    </div>
                                                    <span className={`font-mono font-semibold ${
                                                        log.response_code >= 200 && log.response_code < 300 
                                                            ? 'text-emerald-400' 
                                                            : 'text-rose-400'
                                                    }`}>{log.response_code}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
