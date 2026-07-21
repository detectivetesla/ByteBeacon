import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
    Code,
    Key,
    Copy,
    Eye,
    EyeOff,
    RefreshCw,
    Trash2,
    Plus,
    CheckCircle,
    ExternalLink,
    Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface APIKey {
    id: string;
    name: string;
    key: string;
    created_at: string;
    last_used: string | null;
    status: 'active' | 'revoked';
}

export default function AdminAPIPage() {
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState<'keys' | 'docs'>('keys');
    const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
    const [generating, setGenerating] = useState(false);

    const [apiKeys, setApiKeys] = useState<APIKey[]>([
        {
            id: '1',
            name: 'Production API Key',
            key: 'bb_live_sk_1234567890abcdefghijklmnop',
            created_at: '2024-01-15',
            last_used: '2024-12-27',
            status: 'active',
        },
        {
            id: '2',
            name: 'Test API Key',
            key: 'bb_test_sk_0987654321zyxwvutsrqponml',
            created_at: '2024-02-20',
            last_used: null,
            status: 'active',
        },
    ]);

    const toggleKeyVisibility = (keyId: string) => {
        setShowKeys(prev => ({ ...prev, [keyId]: !prev[keyId] }));
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast({
            title: 'Copied!',
            description: 'API key copied to clipboard',
        });
    };

    const generateNewKey = async () => {
        setGenerating(true);
        await new Promise(resolve => setTimeout(resolve, 1000));

        const newKey: APIKey = {
            id: Date.now().toString(),
            name: 'New API Key',
            key: `bb_live_sk_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`,
            created_at: new Date().toISOString().split('T')[0],
            last_used: null,
            status: 'active',
        };

        setApiKeys(prev => [...prev, newKey]);
        setGenerating(false);

        toast({
            title: 'API Key Generated',
            description: 'New API key has been created successfully',
        });
    };

    const revokeKey = (keyId: string) => {
        setApiKeys(prev => prev.map(key =>
            key.id === keyId ? { ...key, status: 'revoked' as const } : key
        ));
        toast({
            title: 'Key Revoked',
            description: 'API key has been revoked',
        });
    };

    const codeExamples = {
        curl: `# Get all users
curl -X GET https://api.bytebeacon.com/api/admin/users \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -H "Content-Type: application/json"

# Create a new user
curl -X POST https://api.bytebeacon.com/api/admin/users \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "fullName": "John Doe",
    "email": "john@example.com",
    "phone": "0241234567",
    "password": "securePassword123",
    "role": "customer"
  }'

# Approve agent application
curl -X PUT https://api.bytebeacon.com/api/admin/agent-applications/APP_ID \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"status": "approved"}'`,
        javascript: `// Get all users
const response = await fetch('https://api.bytebeacon.com/api/admin/users', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer YOUR_JWT_TOKEN',
    'Content-Type': 'application/json',
  },
});
const users = await response.json();

// Create a new bundle
const bundleResponse = await fetch('https://api.bytebeacon.com/api/admin/bundles', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_JWT_TOKEN',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    network: 'MTN',
    name: '5GB Weekly',
    data_amount: '5GB',
    price_ghc: 25.00,
    validity: '7 days',
    is_active: true,
  }),
});

// Approve agent application
const approveResponse = await fetch(
  'https://api.bytebeacon.com/api/admin/agent-applications/APP_ID',
  {
    method: 'PUT',
    headers: {
      'Authorization': 'Bearer YOUR_JWT_TOKEN',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status: 'approved' }),
  }
);`,
        python: `import requests

# Get all users
users_response = requests.get(
    'https://api.bytebeacon.com/api/admin/users',
    headers={
        'Authorization': 'Bearer YOUR_JWT_TOKEN',
        'Content-Type': 'application/json',
    }
)
users = users_response.json()

# Create a new bundle
bundle_response = requests.post(
    'https://api.bytebeacon.com/api/admin/bundles',
    headers={
        'Authorization': 'Bearer YOUR_JWT_TOKEN',
        'Content-Type': 'application/json',
    },
    json={
        'network': 'MTN',
        'name': '5GB Weekly',
        'data_amount': '5GB',
        'price_ghc': 25.00,
        'validity': '7 days',
        'is_active': True,
    }
)

# Change user role to agent
role_response = requests.put(
    'https://api.bytebeacon.com/api/admin/users/USER_ID/role',
    headers={
        'Authorization': 'Bearer YOUR_JWT_TOKEN',
        'Content-Type': 'application/json',
    },
    json={'role': 'agent'}
)
print(role_response.json())`,
    };

    const [selectedLang, setSelectedLang] = useState<'curl' | 'javascript' | 'python'>('curl');

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Code className="w-8 h-8 text-muted-foreground" />
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">API Settings</h1>
                        <p className="text-muted-foreground">Manage API keys and view documentation</p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
                <Button
                    variant={activeTab === 'keys' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setActiveTab('keys')}
                    className={cn(
                        activeTab === 'keys'
                            ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                            : 'border-border text-muted-foreground hover:bg-accent'
                    )}
                >
                    <Key className="w-4 h-4 mr-2" />
                    API Keys
                </Button>
                <Button
                    variant={activeTab === 'docs' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setActiveTab('docs')}
                    className={cn(
                        activeTab === 'docs'
                            ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                            : 'border-border text-muted-foreground hover:bg-accent'
                    )}
                >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Documentation
                </Button>
            </div>

            {/* API Keys Tab */}
            {activeTab === 'keys' && (
                <div className="space-y-4">
                    <div className="flex justify-end">
                        <Button
                            onClick={generateNewKey}
                            disabled={generating}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white"
                        >
                            {generating ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : (
                                <Plus className="w-4 h-4 mr-2" />
                            )}
                            Generate New Key
                        </Button>
                    </div>

                    {apiKeys.map((apiKey) => (
                        <Card key={apiKey.id} className="bg-card border-border">
                            <CardContent className="p-4">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <h3 className="font-semibold text-foreground">{apiKey.name}</h3>
                                            <span className={cn(
                                                "px-2 py-0.5 text-xs font-medium rounded-full",
                                                apiKey.status === 'active'
                                                    ? "bg-emerald-500/10 text-emerald-500"
                                                    : "bg-red-500/10 text-red-500"
                                            )}>
                                                {apiKey.status}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2 bg-accent/50 rounded-lg px-3 py-2">
                                            <code className="text-sm text-foreground font-mono flex-1 overflow-hidden">
                                                {showKeys[apiKey.id] ? apiKey.key : '•'.repeat(32)}
                                            </code>
                                            <button
                                                onClick={() => toggleKeyVisibility(apiKey.id)}
                                                className="p-1 hover:bg-accent rounded"
                                            >
                                                {showKeys[apiKey.id] ? (
                                                    <EyeOff className="w-4 h-4 text-slate-400" />
                                                ) : (
                                                    <Eye className="w-4 h-4 text-slate-400" />
                                                )}
                                            </button>
                                            <button
                                                onClick={() => copyToClipboard(apiKey.key)}
                                                className="p-1 hover:bg-accent rounded"
                                            >
                                                <Copy className="w-4 h-4 text-muted-foreground" />
                                            </button>
                                        </div>

                                        <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                                            <span>Created: {apiKey.created_at}</span>
                                            <span>Last used: {apiKey.last_used || 'Never'}</span>
                                        </div>
                                    </div>

                                    {apiKey.status === 'active' && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => revokeKey(apiKey.id)}
                                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                        >
                                            <Trash2 className="w-4 h-4 mr-1" />
                                            Revoke
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Documentation Tab */}
            {activeTab === 'docs' && (
                <div className="space-y-6">
                    <Tabs defaultValue="auth" className="w-full">
                        <TabsList className="grid w-full grid-cols-5 bg-accent/20">
                            <TabsTrigger value="auth">Auth</TabsTrigger>
                            <TabsTrigger value="offers">Offers</TabsTrigger>
                            <TabsTrigger value="endpoints">Endpoints</TabsTrigger>
                            <TabsTrigger value="status">Status</TabsTrigger>
                            <TabsTrigger value="code">Code</TabsTrigger>
                        </TabsList>

                        {/* Authentication */}
                        <TabsContent value="auth" className="mt-4">
                            <Card className="bg-card border-border">
                                <CardHeader>
                                    <CardTitle className="text-foreground text-lg flex items-center gap-2">
                                        <Key className="w-5 h-5 text-emerald-500" />
                                        Authentication
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <p className="text-sm text-muted-foreground">
                                        All API requests require authentication using a Bearer token in the Authorization header. Admin keys have full access to all system resources.
                                    </p>
                                    <div className="p-4 bg-accent/30 rounded-lg space-y-2">
                                        <p className="text-xs font-semibold uppercase opacity-60">Required Header:</p>
                                        <code className="text-emerald-500 font-mono bg-black/40 px-3 py-2 rounded block border border-emerald-500/20">
                                            Authorization: Bearer YOUR_API_KEY
                                        </code>
                                    </div>
                                    <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-lg">
                                        <p className="text-xs text-red-400">
                                            <strong>Warning:</strong> Admin API keys are highly sensitive. They allow full management of users, transactions, and system settings. Never expose them in client-side code.
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* Offers */}
                        <TabsContent value="offers" className="mt-4">
                            <Card className="bg-card border-border">
                                <CardHeader>
                                    <CardTitle className="text-foreground text-lg">Admin Capabilities</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <p className="text-sm text-muted-foreground">
                                        Admin API provides full system management capabilities:
                                    </p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {[
                                            { title: 'User Management', desc: 'Create, update, delete users and change roles' },
                                            { title: 'Bundle Management', desc: 'Create, edit, and manage data bundles' },
                                            { title: 'Transaction Control', desc: 'View all transactions and update statuses' },
                                            { title: 'Agent Applications', desc: 'Approve or reject agent applications' },
                                            { title: 'Notifications', desc: 'Send notifications to users' },
                                            { title: 'Analytics', desc: 'Access dashboard stats and analytics' },
                                        ].map((item, i) => (
                                            <div key={i} className="p-4 bg-accent/20 rounded-lg border border-border/50">
                                                <h4 className="font-semibold text-sm text-foreground">{item.title}</h4>
                                                <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* Endpoints */}
                        <TabsContent value="endpoints" className="mt-4">
                            <Card className="bg-card border-border">
                                <CardHeader>
                                    <CardTitle className="text-foreground text-lg">Admin API Endpoints</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="p-3 bg-accent/50 rounded-lg mb-4">
                                        <span className="text-xs text-muted-foreground font-mono">Base URL: https://api.bytebeacon.com/api/admin</span>
                                    </div>

                                    <h4 className="text-sm font-semibold text-foreground mt-4">User Management</h4>
                                    <div className="space-y-2">
                                        {[
                                            { m: 'GET', p: '/users', d: 'Get all users (supports ?role=agent filter)' },
                                            { m: 'POST', p: '/users', d: 'Create a new user' },
                                            { m: 'GET', p: '/users/:id', d: 'Get user details' },
                                            { m: 'PUT', p: '/users/:id', d: 'Update user information' },
                                            { m: 'DELETE', p: '/users/:id', d: 'Delete a user' },
                                            { m: 'PUT', p: '/users/:id/role', d: 'Change user role (customer/agent/admin)' },
                                            { m: 'PUT', p: '/users/:id/status', d: 'Toggle user active/disabled status' },
                                        ].map((ep, i) => (
                                            <div key={i} className="p-2 bg-accent/10 rounded-lg border border-border/30 flex items-center gap-3">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${ep.m === 'GET' ? 'bg-blue-500/10 text-blue-500' : ep.m === 'POST' ? 'bg-emerald-500/10 text-emerald-500' : ep.m === 'PUT' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-red-500/10 text-red-500'}`}>{ep.m}</span>
                                                <div className="flex-1">
                                                    <code className="text-xs font-mono">{ep.p}</code>
                                                    <p className="text-[10px] text-muted-foreground">{ep.d}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <h4 className="text-sm font-semibold text-foreground mt-4">Bundles</h4>
                                    <div className="space-y-2">
                                        {[
                                            { m: 'GET', p: '/bundles', d: 'Get all bundles' },
                                            { m: 'POST', p: '/bundles', d: 'Create a new bundle' },
                                            { m: 'PUT', p: '/bundles/:id', d: 'Update bundle' },
                                            { m: 'DELETE', p: '/bundles/:id', d: 'Delete bundle' },
                                        ].map((ep, i) => (
                                            <div key={i} className="p-2 bg-accent/10 rounded-lg border border-border/30 flex items-center gap-3">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${ep.m === 'GET' ? 'bg-blue-500/10 text-blue-500' : ep.m === 'POST' ? 'bg-emerald-500/10 text-emerald-500' : ep.m === 'PUT' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-red-500/10 text-red-500'}`}>{ep.m}</span>
                                                <div className="flex-1">
                                                    <code className="text-xs font-mono">{ep.p}</code>
                                                    <p className="text-[10px] text-muted-foreground">{ep.d}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <h4 className="text-sm font-semibold text-foreground mt-4">Agent Applications</h4>
                                    <div className="space-y-2">
                                        {[
                                            { m: 'GET', p: '/agent-applications', d: 'Get all applications (supports ?status=processing filter)' },
                                            { m: 'PUT', p: '/agent-applications/:id', d: 'Approve/reject application {status: "approved"|"rejected", adminNotes?: string}' },
                                        ].map((ep, i) => (
                                            <div key={i} className="p-2 bg-accent/10 rounded-lg border border-border/30 flex items-center gap-3">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${ep.m === 'GET' ? 'bg-blue-500/10 text-blue-500' : 'bg-yellow-500/10 text-yellow-500'}`}>{ep.m}</span>
                                                <div className="flex-1">
                                                    <code className="text-xs font-mono">{ep.p}</code>
                                                    <p className="text-[10px] text-muted-foreground">{ep.d}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <h4 className="text-sm font-semibold text-foreground mt-4">Transactions & Stats</h4>
                                    <div className="space-y-2">
                                        {[
                                            { m: 'GET', p: '/stats', d: 'Get dashboard statistics' },
                                            { m: 'GET', p: '/transactions', d: 'Get all transactions' },
                                            { m: 'GET', p: '/transactions/stats', d: 'Get transaction statistics' },
                                            { m: 'PUT', p: '/transactions/:id/status', d: 'Update transaction status' },
                                            { m: 'GET', p: '/analytics', d: 'Get analytics data' },
                                            { m: 'GET', p: '/activity-logs', d: 'Get system activity logs' },
                                        ].map((ep, i) => (
                                            <div key={i} className="p-2 bg-accent/10 rounded-lg border border-border/30 flex items-center gap-3">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${ep.m === 'GET' ? 'bg-blue-500/10 text-blue-500' : 'bg-yellow-500/10 text-yellow-500'}`}>{ep.m}</span>
                                                <div className="flex-1">
                                                    <code className="text-xs font-mono">{ep.p}</code>
                                                    <p className="text-[10px] text-muted-foreground">{ep.d}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* Status */}
                        <TabsContent value="status" className="mt-4">
                            <Card className="bg-card border-border">
                                <CardHeader>
                                    <CardTitle className="text-foreground text-lg">HTTP Status Codes</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <p className="text-sm text-muted-foreground">
                                        All admin API responses use standard HTTP status codes:
                                    </p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {[
                                            { code: '200', c: 'emerald', d: 'Success - Request completed' },
                                            { code: '201', c: 'emerald', d: 'Created - Resource created successfully' },
                                            { code: '400', c: 'yellow', d: 'Bad Request - Invalid input' },
                                            { code: '401', c: 'red', d: 'Unauthorized - Missing/invalid token' },
                                            { code: '403', c: 'red', d: 'Forbidden - Not an admin' },
                                            { code: '404', c: 'slate', d: 'Not Found - Resource doesn\'t exist' },
                                            { code: '500', c: 'red', d: 'Server Error - Something went wrong' },
                                        ].map((st, i) => (
                                            <div key={i} className="p-3 border rounded-lg bg-accent/10 border-border/50">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`px-2 py-0.5 text-xs font-bold rounded ${st.c === 'emerald' ? 'bg-emerald-500/20 text-emerald-500' : st.c === 'yellow' ? 'bg-yellow-500/20 text-yellow-500' : st.c === 'red' ? 'bg-red-500/20 text-red-500' : 'bg-slate-500/20 text-slate-400'}`}>{st.code}</span>
                                                </div>
                                                <p className="text-[11px] text-muted-foreground">{st.d}</p>
                                            </div>
                                        ))}
                                    </div>

                                    <h4 className="text-sm font-semibold text-foreground mt-4">Transaction Statuses</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                        {[
                                            { s: 'processing', c: 'blue' },
                                            { s: 'completed', c: 'emerald' },
                                            { s: 'failed', c: 'red' },
                                        ].map((st, i) => (
                                            <div key={i} className="p-2 text-center rounded-lg bg-accent/20">
                                                <span className={`text-xs font-semibold capitalize ${st.c === 'emerald' ? 'text-emerald-500' : st.c === 'blue' ? 'text-blue-500' : st.c === 'yellow' ? 'text-yellow-500' : 'text-red-500'}`}>{st.s}</span>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* Code */}
                        <TabsContent value="code" className="mt-4">
                            <Card className="bg-card border-border">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                                    <CardTitle className="text-foreground text-lg">Implementation Examples</CardTitle>
                                    <div className="flex gap-2">
                                        {(['curl', 'javascript', 'python'] as const).map((lang) => (
                                            <Button
                                                key={lang}
                                                variant={selectedLang === lang ? 'default' : 'outline'}
                                                size="sm"
                                                onClick={() => setSelectedLang(lang)}
                                                className={cn(
                                                    "h-7 text-[10px]",
                                                    selectedLang === lang ? 'bg-emerald-500' : ''
                                                )}
                                            >
                                                {lang}
                                            </Button>
                                        ))}
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="relative group">
                                        <pre className="bg-slate-950 p-4 rounded-lg overflow-x-auto text-[13px] border border-slate-800">
                                            <code className="text-emerald-500 font-mono whitespace-pre">
                                                {codeExamples[selectedLang]}
                                            </code>
                                        </pre>
                                        <button
                                            onClick={() => copyToClipboard(codeExamples[selectedLang])}
                                            className="absolute top-2 right-2 p-1.5 bg-slate-800 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <Copy className="w-3.5 h-3.5 text-slate-400" />
                                        </button>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>
            )}
        </div>
    );
}
