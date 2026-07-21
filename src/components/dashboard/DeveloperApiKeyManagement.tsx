import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { userService } from '@/services/user.service';
import {
    Key, Eye, EyeOff, Clipboard, Check, Trash2, Plus, Loader2,
    CheckCircle, XCircle, AlertCircle, AlertTriangle,
    Globe, BookOpen, Copy, ChevronDown, ChevronUp, Zap, Server, Shield, Link2
} from 'lucide-react';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";

interface APIKey {
    id: string;
    name: string;
    api_key: string;
    is_active: boolean;
    last_used: string | null;
    created_at: string;
}

export default function DeveloperApiKeyManagement() {
    const { toast } = useToast();
    const [keys, setKeys] = useState<APIKey[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [revokingId, setRevokingId] = useState<string | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [showKeyId, setShowKeyId] = useState<string | null>(null);

    // Modal state
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newKeyName, setNewKeyName] = useState('');

    const fetchKeys = async () => {
        try {
            setLoading(true);
            const response = await userService.getApiKeys();
            if (response.success) {
                setKeys(response.apiKeys);
            }
        } catch (error) {
            console.error('Failed to load API keys:', error);
            toast({
                title: 'Error',
                description: 'Failed to retrieve your API keys.',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchKeys();
    }, []);

    const handleCreateKey = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newKeyName.trim()) return;

        setCreating(true);
        try {
            const response = await userService.createApiKey(newKeyName);
            if (response.success) {
                toast({
                    title: 'API Key Created',
                    description: response.message || 'New API key created successfully.',
                });
                setIsCreateOpen(false);
                setNewKeyName('');
                fetchKeys();
            }
        } catch (error: any) {
            console.error('Failed to create key:', error);
            toast({
                title: 'Creation Failed',
                description: error.response?.data?.error || 'Failed to generate API Key.',
                variant: 'destructive',
            });
        } finally {
            setCreating(false);
        }
    };

    const handleRevokeOrDeleteKey = async (id: string, name: string, isActive: boolean) => {
        setRevokingId(id);
        try {
            const response = await userService.deleteApiKey(id);
            if (response.success) {
                toast({
                    title: isActive ? 'API Key Revoked' : 'API Key Deleted',
                    description: response.message || `${name} has been processed.`,
                });
                fetchKeys();
            }
        } catch (error: any) {
            console.error('Failed to update key status:', error);
            toast({
                title: 'Action Failed',
                description: error.response?.data?.error || 'Operation failed. Please try again.',
                variant: 'destructive',
            });
        } finally {
            setRevokingId(null);
        }
    };

    const copyText = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        toast({
            title: 'Copied!',
            description: 'API key copied to clipboard.',
        });
        setTimeout(() => setCopiedId(null), 2000);
    };

    // Mask key format: e.g. dk_iGoTZ**************************pttr
    const getMaskedKey = (key: string) => {
        if (key.length <= 16) return key;
        return `${key.slice(0, 8)}**************************${key.slice(-4)}`;
    };

    const activeKeysCount = keys.filter(k => k.is_active).length;

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-16">
            {/* Morphic Header Panel */}
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/60 to-slate-950/80 p-8 shadow-2xl backdrop-blur-xl">
                {/* Visual Neomorphic Radial Gradients */}
                <div className="absolute -left-20 -top-20 w-72 h-72 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
                <div className="absolute -right-20 -bottom-20 w-72 h-72 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />

                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="text-left space-y-2 max-w-xl">
                        <h1 className="text-3xl md:text-5xl font-display font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-indigo-400 tracking-tight">
                            API Key Management
                        </h1>
                        <p className="text-sm text-muted-foreground font-medium leading-relaxed">
                            Securely generate and manage API keys to automate your data and airtime purchases.
                        </p>
                    </div>

                    {/* Create New Key Dialog Trigger */}
                    <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                        <DialogTrigger asChild>
                            <Button className="py-6 px-6 text-sm font-bold bg-primary hover:bg-primary/90 text-white rounded-2xl shadow-lg border border-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2">
                                <Plus className="w-4 h-4" />
                                Create New API Key
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-slate-950 border-slate-800 rounded-3xl max-w-md w-[95%] p-6">
                            <form onSubmit={handleCreateKey}>
                                <DialogHeader>
                                    <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
                                        <Key className="w-5 h-5 text-indigo-400" />
                                        Create New API Key
                                    </DialogTitle>
                                    <DialogDescription className="text-slate-400 text-xs mt-1">
                                        Give your API key a unique name (e.g. Production Web, Integration Server) to track its activities.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-6">
                                    <div className="space-y-2">
                                        <label htmlFor="keyName" className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">
                                            API Key Name
                                        </label>
                                        <Input
                                            id="keyName"
                                            placeholder="E.g., ByteBeacon API Portal"
                                            value={newKeyName}
                                            onChange={(e) => setNewKeyName(e.target.value)}
                                            required
                                            className="bg-slate-900 border-slate-800 focus:border-indigo-500/50 py-5 rounded-xl transition-all"
                                            maxLength={50}
                                        />
                                    </div>
                                </div>
                                <DialogFooter className="gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="border-slate-850 hover:bg-slate-900 rounded-xl"
                                        onClick={() => setIsCreateOpen(false)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="submit"
                                        disabled={creating || !newKeyName.trim()}
                                        className="bg-primary hover:bg-primary/90 rounded-xl"
                                    >
                                        {creating ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                                Creating...
                                            </>
                                        ) : (
                                            'Generate Key'
                                        )}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Keys Table Section (Morphic Card) */}
            <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-slate-950/40 backdrop-blur-xl p-6 shadow-xl">
                {/* Title */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4 mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
                            <Key className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="font-display font-black text-lg text-white tracking-tight uppercase">Your API Keys</h2>
                            <p className="text-xs text-muted-foreground font-medium">
                                {keys.length} {keys.length === 1 ? 'key' : 'keys'} available. Manage access and security settings.
                            </p>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center p-16 gap-3">
                        <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
                        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Fetching credentials...</span>
                    </div>
                ) : keys.length === 0 ? (
                    <div className="text-center p-16 space-y-4 border border-dashed border-white/5 rounded-2xl bg-slate-900/10">
                        <AlertCircle className="w-12 h-12 text-slate-500 mx-auto" />
                        <div>
                            <h3 className="font-bold text-white uppercase text-xs tracking-wider">No API Keys Generated</h3>
                            <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto leading-relaxed">
                                You haven't created any API keys yet. Create one to begin automated transaction integrations.
                            </p>
                        </div>
                    </div>
                ) : (
                    /* Keys Table */
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="border-b border-white/5 text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                                    <th className="pb-4 pt-2 pl-4">Name</th>
                                    <th className="pb-4 pt-2">API Key</th>
                                    <th className="pb-4 pt-2">Status</th>
                                    <th className="pb-4 pt-2">Created</th>
                                    <th className="pb-4 pt-2">Last Used</th>
                                    <th className="pb-4 pt-2 text-right pr-4">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {keys.map((key) => {
                                    const isShowing = showKeyId === key.id;
                                    return (
                                        <tr key={key.id} className="hover:bg-white/[0.02] transition-colors group">
                                            <td className="py-4 pl-4 font-bold text-white tracking-tight uppercase">
                                                {key.name}
                                            </td>
                                            <td className="py-4 font-mono">
                                                <div className="flex items-center gap-2">
                                                    <span className="bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-850 text-slate-300">
                                                        {isShowing ? key.api_key : getMaskedKey(key.api_key)}
                                                    </span>
                                                    <button
                                                        onClick={() => setShowKeyId(isShowing ? null : key.id)}
                                                        className="p-1.5 hover:bg-slate-900 border border-slate-850 rounded-lg text-slate-400 hover:text-white transition-colors"
                                                    >
                                                        {isShowing ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                                    </button>
                                                    <button
                                                        onClick={() => copyText(key.api_key, key.id)}
                                                        className="p-1.5 hover:bg-slate-900 border border-slate-850 rounded-lg text-slate-400 hover:text-white transition-colors"
                                                    >
                                                        {copiedId === key.id ? <Check className="w-3.5 h-3.5 text-emerald-400 animate-in zoom-in" /> : <Clipboard className="w-3.5 h-3.5" />}
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="py-4">
                                                {key.is_active ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                        <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                                                        Active
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase bg-red-500/10 text-red-400 border border-red-500/20">
                                                        <span className="w-1 h-1 rounded-full bg-red-400" />
                                                        Revoked
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-4 text-muted-foreground font-medium">
                                                {new Date(key.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="py-4 text-muted-foreground font-medium">
                                                {key.last_used ? new Date(key.last_used).toLocaleString() : 'Never'}
                                            </td>
                                            <td className="py-4 text-right pr-4">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    disabled={revokingId === key.id}
                                                    onClick={() => handleRevokeOrDeleteKey(key.id, key.name, key.is_active)}
                                                    className={key.is_active 
                                                        ? "text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 w-8" 
                                                        : "text-slate-500 hover:text-red-400 hover:bg-red-500/10 h-8 w-8"
                                                    }
                                                >
                                                    {revokingId === key.id ? (
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    ) : (
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    )}
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ═══════════════ Integration Guide Section ═══════════════ */}
            <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-slate-950/40 backdrop-blur-xl p-6 shadow-xl">
                <div className="absolute -right-32 -top-32 w-64 h-64 rounded-full bg-emerald-500/5 blur-3xl pointer-events-none" />
                <div className="absolute -left-32 -bottom-32 w-64 h-64 rounded-full bg-cyan-500/5 blur-3xl pointer-events-none" />

                <div className="relative z-10 space-y-6">
                    {/* Section Header */}
                    <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                        <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
                            <Globe className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="font-display font-black text-lg text-white tracking-tight uppercase">
                                How to Connect Your Key to Other Websites
                            </h2>
                            <p className="text-xs text-muted-foreground font-medium">
                                Use your API key to let external data-selling websites source bundles from ByteBeacon
                            </p>
                        </div>
                    </div>

                    {/* Quick Start Checklist */}
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/5 to-cyan-500/5 border border-emerald-500/10">
                        <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2 mb-3">
                            <Zap className="w-4 h-4" />
                            Quick Start Checklist
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {[
                                { step: '1', text: 'Create an API key above (if you haven\'t already)' },
                                { step: '2', text: 'Copy your API key (starts with dk_)' },
                                { step: '3', text: 'Go to the external website\'s API/integration settings' },
                                { step: '4', text: 'Paste your API key and set the Base URL below' },
                            ].map((item) => (
                                <div key={item.step} className="flex items-start gap-3 p-3 rounded-xl bg-slate-900/50 border border-slate-800">
                                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-black flex items-center justify-center border border-emerald-500/30">
                                        {item.step}
                                    </span>
                                    <span className="text-xs text-slate-300 font-medium leading-relaxed">{item.text}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* API Base URL */}
                    <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <Server className="w-4 h-4 text-cyan-400" />
                            API Base URL
                        </h3>
                        <p className="text-xs text-slate-400">
                            When the external website asks for an "API URL" or "Base URL", enter this:
                        </p>
                        <div className="flex items-center gap-2">
                            <code className="flex-1 px-4 py-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-sm text-cyan-400 select-all">
                                https://bytebeacon.online/api/v1
                            </code>
                            <button
                                onClick={() => copyText('https://bytebeacon.online/api/v1', 'base-url')}
                                className="p-2.5 hover:bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors"
                            >
                                {copiedId === 'base-url' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    {/* Authentication Methods */}
                    <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <Shield className="w-4 h-4 text-indigo-400" />
                            How External Websites Can Send Your Key
                        </h3>
                        <p className="text-xs text-slate-400">
                            Your API key will work no matter how the external site sends it. ByteBeacon automatically detects the key from any of these formats:
                        </p>
                        <div className="grid grid-cols-1 gap-3">
                            {[
                                {
                                    label: 'Header (Recommended)',
                                    code: 'x-api-key: dk_your_api_key_here',
                                    desc: 'Most secure. Used by professional integrations.'
                                },
                                {
                                    label: 'Authorization Bearer',
                                    code: 'Authorization: Bearer dk_your_api_key_here',
                                    desc: 'Standard HTTP auth. Common in modern APIs.'
                                },
                                {
                                    label: 'Query Parameter',
                                    code: '?api_key=dk_your_api_key_here',
                                    desc: 'Appended to the URL. Used by some SMM panels.'
                                },
                                {
                                    label: 'Request Body',
                                    code: '{ "key": "dk_your_api_key_here" }',
                                    desc: 'Sent inside the JSON body. Used by VTU/reseller scripts.'
                                }
                            ].map((method) => (
                                <div key={method.label} className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">{method.label}</span>
                                    </div>
                                    <code className="block text-xs font-mono text-emerald-400 bg-slate-900 px-3 py-2 rounded-lg border border-slate-800">
                                        {method.code}
                                    </code>
                                    <p className="text-[11px] text-slate-500">{method.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Available Endpoints */}
                    <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <Link2 className="w-4 h-4 text-amber-400" />
                            Available API Endpoints
                        </h3>
                        <p className="text-xs text-slate-400">
                            These are the endpoints the external website will call using your API key:
                        </p>

                        <div className="space-y-3">
                            {/* Fetch Plans */}
                            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                                <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 text-[9px] font-black uppercase rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/20">GET</span>
                                    <code className="text-xs font-mono text-slate-300">/api/v1/plans</code>
                                    <span className="text-[10px] text-slate-500 ml-auto">Fetch available data bundles</span>
                                </div>
                                <div className="text-[11px] text-slate-400">
                                    Returns all available data plans with prices, networks, and plan IDs. The <code className="text-cyan-400">id</code> in the response is the <code className="text-cyan-400">plan_id</code> needed to place orders.
                                </div>
                                <div className="bg-slate-900 rounded-lg border border-slate-800 p-3">
                                    <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-2">Example Response</p>
                                    <pre className="text-[11px] font-mono text-emerald-400/90 whitespace-pre overflow-x-auto">{`{
  "success": true,
  "plans": [
    {
      "id": "6b148c9a-888b-45e0-8b18-3d77cccce30c",
      "network": "MTN",
      "name": "1GB - Monthly",
      "price": 5.00
    }
  ]
}`}</pre>
                                </div>
                            </div>

                            {/* Purchase Data */}
                            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                                <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 text-[9px] font-black uppercase rounded bg-amber-500/20 text-amber-400 border border-amber-500/20">POST</span>
                                    <code className="text-xs font-mono text-slate-300">/api/v1/data/purchase</code>
                                    <span className="text-[10px] text-slate-500 ml-auto">Place a data order</span>
                                </div>
                                <div className="text-[11px] text-slate-400">
                                    Purchases a data bundle for a recipient phone number. The cost is deducted from your wallet balance.
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="bg-slate-900 rounded-lg border border-slate-800 p-3">
                                        <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-2">Request Body</p>
                                        <pre className="text-[11px] font-mono text-cyan-400/90 whitespace-pre overflow-x-auto">{`{
  "network": "MTN",
  "phone": "0546153537",
  "plan_id": "6b148c9a-..."
}`}</pre>
                                    </div>
                                    <div className="bg-slate-900 rounded-lg border border-slate-800 p-3">
                                        <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-2">Response</p>
                                        <pre className="text-[11px] font-mono text-emerald-400/90 whitespace-pre overflow-x-auto">{`{
  "success": true,
  "transaction_id": "678f4007-...",
  "status": "processing"
}`}</pre>
                                    </div>
                                </div>
                                <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
                                    <p className="text-[10px] text-amber-400 font-semibold flex items-center gap-1.5">
                                        <AlertTriangle className="w-3 h-3" />
                                        Accepted field aliases
                                    </p>
                                    <p className="text-[10px] text-slate-400 mt-1">
                                        <strong className="text-slate-300">Phone:</strong> <code className="text-cyan-400/80">phone</code>, <code className="text-cyan-400/80">recipient_phone</code>, <code className="text-cyan-400/80">phone_number</code>, <code className="text-cyan-400/80">number</code>, <code className="text-cyan-400/80">link</code>, <code className="text-cyan-400/80">recipient</code>
                                        <br />
                                        <strong className="text-slate-300">Plan:</strong> <code className="text-cyan-400/80">plan_id</code>, <code className="text-cyan-400/80">bundle_id</code>, <code className="text-cyan-400/80">plan</code>, <code className="text-cyan-400/80">service</code>, <code className="text-cyan-400/80">offer_id</code>
                                        <br />
                                        <strong className="text-slate-300">Reference:</strong> <code className="text-cyan-400/80">reference</code>, <code className="text-cyan-400/80">client_reference</code>, <code className="text-cyan-400/80">ref</code>
                                    </p>
                                </div>
                            </div>

                            {/* Check Order Status */}
                            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                                <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 text-[9px] font-black uppercase rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/20">GET</span>
                                    <code className="text-xs font-mono text-slate-300">/api/v1/transactions/:id</code>
                                    <span className="text-[10px] text-slate-500 ml-auto">Check order status</span>
                                </div>
                                <div className="text-[11px] text-slate-400">
                                    Returns the status of a specific transaction. Use the <code className="text-cyan-400">transaction_id</code> from the purchase response.
                                </div>
                            </div>

                            {/* Check Balance */}
                            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                                <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 text-[9px] font-black uppercase rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/20">GET</span>
                                    <code className="text-xs font-mono text-slate-300">/api/v1/wallet</code>
                                    <span className="text-[10px] text-slate-500 ml-auto">Check wallet balance</span>
                                </div>
                                <div className="text-[11px] text-slate-400">
                                    Returns your current wallet balance. The external site can use this to check if you have enough funds before placing an order.
                                </div>
                            </div>

                            {/* Transaction History */}
                            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                                <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 text-[9px] font-black uppercase rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/20">GET</span>
                                    <code className="text-xs font-mono text-slate-300">/api/v1/transactions</code>
                                    <span className="text-[10px] text-slate-500 ml-auto">List all transactions</span>
                                </div>
                                <div className="text-[11px] text-slate-400">
                                    Returns your full order history with statuses, timestamps, and delivery tracking.
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Common External Site Configuration Example */}
                    <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-purple-400" />
                            Example: Setting Up on an External Reseller Site
                        </h3>
                        <p className="text-xs text-slate-400">
                            Most VTU/reseller/SMM websites have a "Supplier API" or "Upstream Provider" configuration section. Here's what to fill in:
                        </p>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="border-b border-white/5 text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                                        <th className="pb-3 pt-2 pl-3">Field on External Site</th>
                                        <th className="pb-3 pt-2">What to Enter</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    <tr className="hover:bg-white/[0.02]">
                                        <td className="py-3 pl-3 text-slate-300 font-semibold">API Key / Token</td>
                                        <td className="py-3 font-mono text-cyan-400">Your dk_ key (copy from above)</td>
                                    </tr>
                                    <tr className="hover:bg-white/[0.02]">
                                        <td className="py-3 pl-3 text-slate-300 font-semibold">API URL / Base URL</td>
                                        <td className="py-3 font-mono text-cyan-400">https://bytebeacon.online/api/v1</td>
                                    </tr>
                                    <tr className="hover:bg-white/[0.02]">
                                        <td className="py-3 pl-3 text-slate-300 font-semibold">Purchase / Order Endpoint</td>
                                        <td className="py-3 font-mono text-cyan-400">/data/purchase</td>
                                    </tr>
                                    <tr className="hover:bg-white/[0.02]">
                                        <td className="py-3 pl-3 text-slate-300 font-semibold">Plans / Services Endpoint</td>
                                        <td className="py-3 font-mono text-cyan-400">/plans</td>
                                    </tr>
                                    <tr className="hover:bg-white/[0.02]">
                                        <td className="py-3 pl-3 text-slate-300 font-semibold">Balance Endpoint</td>
                                        <td className="py-3 font-mono text-cyan-400">/wallet</td>
                                    </tr>
                                    <tr className="hover:bg-white/[0.02]">
                                        <td className="py-3 pl-3 text-slate-300 font-semibold">Response Format</td>
                                        <td className="py-3 font-mono text-cyan-400">JSON</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Important Notes */}
                    <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/15 space-y-3">
                        <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" />
                            Important Notes
                        </h3>
                        <ul className="space-y-2 text-xs text-slate-400 list-none">
                            <li className="flex items-start gap-2">
                                <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                                <span><strong className="text-slate-200">Wallet Balance:</strong> Orders are deducted from your ByteBeacon wallet. Make sure you have sufficient balance before placing orders.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                                <span><strong className="text-slate-200">Order Tracking:</strong> All orders placed via API appear in your Orders page with real-time status updates.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                                <span><strong className="text-slate-200">Auto-Refund:</strong> If a delivery fails, the amount is automatically refunded back to your wallet.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <AlertCircle className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                                <span><strong className="text-slate-200">Key Safety:</strong> Never share your API key publicly. If compromised, revoke it immediately and create a new one.</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
