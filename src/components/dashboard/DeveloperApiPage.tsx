import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services';
import { userService } from '@/services/user.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Copy, Eye, EyeOff, RefreshCw, Code, Key, Book, Terminal, Loader2, AlertCircle } from 'lucide-react';

export default function DeveloperApiPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [apiKey, setApiKey] = useState('');
    const [apiKeyCreatedAt, setApiKeyCreatedAt] = useState<string | null>(null);
    const [showApiKey, setShowApiKey] = useState(false);
    const [loading, setLoading] = useState(false);
    const [fetchingKey, setFetchingKey] = useState(true);

    // Fetch API key on mount
    useEffect(() => {
        const fetchApiKey = async () => {
            try {
                const data = await userService.getApiKey();
                setApiKey(data.apiKey);
                setApiKeyCreatedAt(data.createdAt);
            } catch (error) {
                console.error('Failed to fetch API key:', error);
                // Generate a temporary display key if fetch fails
                setApiKey('api_key_placeholder');
            } finally {
                setFetchingKey(false);
            }
        };
        fetchApiKey();
    }, []);

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        toast({
            title: 'Copied!',
            description: `${label} copied to clipboard.`,
        });
    };

    const regenerateApiKey = async () => {
        setLoading(true);
        try {
            const data = await userService.regenerateApiKey();
            setApiKey(data.apiKey);
            setApiKeyCreatedAt(data.createdAt);
            toast({
                title: 'API Key Regenerated',
                description: 'Your new API key has been generated. Make sure to update your applications.',
            });
        } catch (error) {
            console.error('Failed to regenerate API key:', error);
            toast({
                title: 'Error',
                description: 'Failed to regenerate API key. Please try again.',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const codeExamples = {
        curl: `# Get available data bundles
curl -X GET https://api.bytebeacon.com/api/bundles \\
  -H "Authorization: Bearer ${showApiKey ? apiKey : 'YOUR_API_KEY'}" \\
  -H "Content-Type: application/json"

# Purchase data bundle
curl -X POST https://api.bytebeacon.com/api/transactions \\
  -H "Authorization: Bearer ${showApiKey ? apiKey : 'YOUR_API_KEY'}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone": "0241234567",
    "bundleId": "bundle_uuid_here",
    "network": "MTN"
  }'

# Check wallet balance
curl -X GET https://api.bytebeacon.com/api/wallet/balance \\
  -H "Authorization: Bearer ${showApiKey ? apiKey : 'YOUR_API_KEY'}"`,
        javascript: `// Get available data bundles
const bundlesRes = await fetch('https://api.bytebeacon.com/api/bundles', {
  headers: {
    'Authorization': 'Bearer ${showApiKey ? apiKey : 'YOUR_API_KEY'}',
    'Content-Type': 'application/json',
  },
});
const { bundles } = await bundlesRes.json();

// Purchase data bundle
const purchaseRes = await fetch('https://api.bytebeacon.com/api/transactions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ${showApiKey ? apiKey : 'YOUR_API_KEY'}',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    phone: '0241234567',
    bundleId: 'bundle_uuid_here',
    network: 'MTN',
  }),
});
const result = await purchaseRes.json();
console.log('Transaction ID:', result.transactionId);

// Check wallet balance
const balanceRes = await fetch('https://api.bytebeacon.com/api/wallet/balance', {
  headers: { 'Authorization': 'Bearer ${showApiKey ? apiKey : 'YOUR_API_KEY'}' },
});
const { balance } = await balanceRes.json();
console.log('Balance: GHS', balance);`,
        python: `import requests

API_KEY = '${showApiKey ? apiKey : 'YOUR_API_KEY'}'
BASE_URL = 'https://api.bytebeacon.com/api'
headers = {
    'Authorization': f'Bearer {API_KEY}',
    'Content-Type': 'application/json',
}

# Purchase data bundle
purchase_res = requests.post(
    f'{BASE_URL}/transactions',
    headers=headers,
    json={
        'phone': '0241234567',
        'bundleId': 'bundle_uuid_here',
        'network': 'MTN',
    }
)
print(purchase_res.json())`,
        java: `import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

public class ByteBeaconApi {
    private static final String API_KEY = "${showApiKey ? apiKey : 'YOUR_API_KEY'}";
    private static final String BASE_URL = "https://api.bytebeacon.com/api";

    public static void main(String[] args) throws Exception {
        HttpClient client = HttpClient.newHttpClient();
        
        String jsonPayload = "{\\"phone\\":\\"0241234567\\",\\"bundleId\\":\\"uuid\\",\\"network\\":\\"MTN\\"}";
        
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(BASE_URL + "/transactions"))
            .header("Authorization", "Bearer " + API_KEY)
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(jsonPayload))
            .build();

        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        System.out.println("Response: " + response.body());
    }
}`,
        cpp: `#include <iostream>
#include <string>
#include <curl/curl.h>

int main() {
    CURL *curl;
    CURLcode res;
    curl = curl_easy_init();
    
    if(curl) {
        struct curl_slist *headers = NULL;
        headers = curl_slist_append(headers, "Authorization: Bearer ${showApiKey ? apiKey : 'YOUR_API_KEY'}");
        headers = curl_slist_append(headers, "Content-Type: application/json");

        const char* data = "{\\"phone\\":\\"0241234567\\",\\"bundleId\\":\\"uuid\\",\\"network\\":\\"MTN\\"}";

        curl_easy_setopt(curl, CURLOPT_URL, "https://api.bytebeacon.com/api/transactions");
        curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
        curl_easy_setopt(curl, CURLOPT_POSTFIELDS, data);

        res = curl_easy_perform(curl);
        
        if(res != CURLE_OK)
            fprintf(stderr, "Request failed: %s\\n", curl_easy_strerror(res));

        curl_easy_cleanup(curl);
    }
    return 0;
}`,
    };

    const endpoints = [
        {
            method: 'GET',
            path: '/api/bundles',
            description: 'List all available data bundles with pricing',
            response: '{ "bundles": [{ "id": "...", "name": "1GB Daily", "price_ghc": 2.50, ... }] }',
        },
        {
            method: 'GET',
            path: '/api/bundles?network=MTN',
            description: 'List bundles for a specific network (MTN, Telecel, AirtelTigo)',
            response: '{ "bundles": [...] }',
        },
        {
            method: 'POST',
            path: '/api/transactions',
            description: 'Purchase a data bundle for a phone number',
            response: '{ "success": true, "transactionId": "...", "status": "pending" }',
        },
        {
            method: 'GET',
            path: '/api/transactions',
            description: 'List your transaction history',
            response: '{ "transactions": [{ "id": "...", "status": "completed", ... }] }',
        },
        {
            method: 'GET',
            path: '/api/transactions/:id',
            description: 'Get details of a specific transaction',
            response: '{ "transaction": { "id": "...", "status": "completed", "amount": 5.00 } }',
        },
        {
            method: 'GET',
            path: '/api/wallet/balance',
            description: 'Get your current wallet balance',
            response: '{ "balance": 150.50 }',
        },
        {
            method: 'GET',
            path: '/api/user/profile',
            description: 'Get your user profile and role information',
            response: '{ "fullName": "...", "email": "...", "role": "agent" }',
        },
        {
            method: 'GET',
            path: '/api/user/api-key',
            description: 'Get your API key details',
            response: '{ "apiKey": "bb_...", "createdAt": "..." }',
        },
    ];

    const errorCodes = [
        { code: 400, message: 'Bad Request', description: 'Missing or invalid parameters' },
        { code: 401, message: 'Unauthorized', description: 'Invalid or missing API key' },
        { code: 402, message: 'Insufficient Balance', description: 'Wallet balance too low' },
        { code: 404, message: 'Not Found', description: 'Bundle or transaction not found' },
        { code: 429, message: 'Rate Limited', description: 'Too many requests, slow down' },
        { code: 500, message: 'Server Error', description: 'Internal server error' },
    ];

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Code className="w-6 h-6 text-primary" />
                    Developer API
                </h1>
                <p className="text-muted-foreground mt-1">
                    Integrate ByteBeacon data purchases into your applications
                </p>
            </div>

            {/* API Key Section */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Key className="w-5 h-5" />
                        API Key
                    </CardTitle>
                    <CardDescription>
                        Use this key to authenticate your API requests
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            {fetchingKey ? (
                                <div className="flex items-center gap-2 h-10 px-3 border rounded-lg bg-muted/50">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span className="text-sm text-muted-foreground">Loading API key...</span>
                                </div>
                            ) : (
                                <>
                                    <Input
                                        type={showApiKey ? 'text' : 'password'}
                                        value={apiKey}
                                        readOnly
                                        className="pr-20 font-mono text-sm"
                                    />
                                    <button
                                        onClick={() => setShowApiKey(!showApiKey)}
                                        className="absolute right-10 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded"
                                    >
                                        {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                    <button
                                        onClick={() => copyToClipboard(apiKey, 'API Key')}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded"
                                    >
                                        <Copy className="w-4 h-4" />
                                    </button>
                                </>
                            )}
                        </div>
                        <Button variant="outline" onClick={regenerateApiKey} disabled={loading || fetchingKey}>
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        </Button>
                    </div>
                    {apiKeyCreatedAt && (
                        <p className="text-xs text-muted-foreground">
                            Created: {new Date(apiKeyCreatedAt).toLocaleDateString()} at {new Date(apiKeyCreatedAt).toLocaleTimeString()}
                        </p>
                    )}
                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                        <p className="text-sm text-amber-600 dark:text-amber-400 flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <span>Keep your API key secret. Do not share it publicly or commit it to version control.</span>
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Documentation */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Book className="w-5 h-5" />
                        API Documentation
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="auth" className="w-full">
                        <TabsList className="grid w-full grid-cols-5">
                            <TabsTrigger value="auth">Auth</TabsTrigger>
                            <TabsTrigger value="offers">Offers</TabsTrigger>
                            <TabsTrigger value="endpoints">Endpoints</TabsTrigger>
                            <TabsTrigger value="status">Status</TabsTrigger>
                            <TabsTrigger value="code">Code</TabsTrigger>
                        </TabsList>

                        {/* Authentication Section */}
                        <TabsContent value="auth" className="mt-4 space-y-4">
                            <div className="space-y-3">
                                <h3 className="text-lg font-semibold">Authentication</h3>
                                <p className="text-sm text-muted-foreground">
                                    ByteBeacon uses API Keys to authenticate requests. You can view and manage your API keys at the top of this page.
                                </p>
                                <div className="p-4 bg-muted/30 rounded-lg border space-y-2">
                                    <p className="text-sm font-medium">Header Requirement:</p>
                                    <code className="text-sm bg-slate-800 text-emerald-400 px-3 py-2 rounded block font-mono">
                                        Authorization: Bearer YOUR_API_KEY
                                    </code>
                                </div>
                                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                                    <p className="text-xs text-amber-600 dark:text-amber-400 flex items-start gap-2">
                                        <AlertCircle className="w-4 h-4 mt-0.5" />
                                        <span>All API requests must be made over HTTPS. Calls made over plain HTTP will fail. API requests without authentication will also fail.</span>
                                    </p>
                                </div>
                            </div>
                        </TabsContent>

                        {/* Offers Section */}
                        <TabsContent value="offers" className="mt-4 space-y-4">
                            <div className="space-y-3">
                                <h3 className="text-lg font-semibold">Data Offers</h3>
                                <p className="text-sm text-muted-foreground">
                                    To fetch the latest data bundles and pricing (including your agent discounts), use the bundles endpoints.
                                </p>
                                <div className="space-y-3">
                                    <div className="p-4 bg-muted/30 rounded-lg border">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="px-2 py-0.5 bg-blue-500/10 text-blue-500 text-xs font-bold rounded">GET</span>
                                            <code className="text-sm font-mono">/v1/bundles</code>
                                        </div>
                                        <p className="text-xs text-muted-foreground">Returns all available bundles for all networks.</p>
                                    </div>
                                    <div className="p-4 bg-muted/30 rounded-lg border">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="px-2 py-0.5 bg-blue-500/10 text-blue-500 text-xs font-bold rounded">GET</span>
                                            <code className="text-sm font-mono">/v1/bundles/:network</code>
                                        </div>
                                        <p className="text-xs text-muted-foreground">Fetch bundles for a specific network (mtn, telecel, or airteltigo).</p>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        {/* Endpoints Section */}
                        <TabsContent value="endpoints" className="mt-4 space-y-4">
                            <div className="space-y-4">
                                <div className="text-sm text-muted-foreground flex items-center justify-between">
                                    <span>Base URL: <code className="bg-muted px-2 py-1 rounded">https://api.bytebeacon.com</code></span>
                                </div>
                                <div className="space-y-3">
                                    {endpoints.map((endpoint, index) => (
                                        <div
                                            key={index}
                                            className="p-4 bg-muted/30 rounded-lg border"
                                        >
                                            <div className="flex items-start gap-4">
                                                <span className={`px-2 py-1 rounded text-[10px] font-bold ${endpoint.method === 'GET'
                                                    ? 'bg-blue-500/20 text-blue-500'
                                                    : 'bg-emerald-500/20 text-emerald-500'
                                                    }`}>
                                                    {endpoint.method}
                                                </span>
                                                <div className="flex-1">
                                                    <code className="text-sm font-mono">{endpoint.path}</code>
                                                    <p className="text-xs text-muted-foreground mt-1">{endpoint.description}</p>
                                                </div>
                                            </div>
                                            {endpoint.response && (
                                                <div className="mt-2 pt-2 border-t border-border/50">
                                                    <p className="text-[10px] text-muted-foreground mb-1 font-semibold uppercase tracking-wider">Expected Response:</p>
                                                    <pre className="text-[11px] bg-slate-900 text-emerald-400 p-2 rounded block overflow-x-auto font-mono">{endpoint.response}</pre>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </TabsContent>

                        {/* Status Section */}
                        <TabsContent value="status" className="mt-4 space-y-4">
                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold">Order Status</h3>
                                <p className="text-sm text-muted-foreground">
                                    Orders flow through several states. You should poll the transaction endpoint or use webhooks to track these changes.
                                </p>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="p-3 border rounded-lg bg-yellow-500/5 border-yellow-500/20">
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className="w-2 h-2 rounded-full bg-yellow-500" />
                                            <span className="font-semibold text-sm">pending / processing</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground">The order has been received and is being sent to the telecommunications provider.</p>
                                    </div>
                                    <div className="p-3 border rounded-lg bg-emerald-500/5 border-emerald-500/20">
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                            <span className="font-semibold text-sm">delivered / completed</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground">Success! The data bundle has been successfully credited to the recipient's phone.</p>
                                    </div>
                                    <div className="p-3 border rounded-lg bg-red-500/5 border-red-500/20">
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className="w-2 h-2 rounded-full bg-red-500" />
                                            <span className="font-semibold text-sm">failed / error</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground">The order could not be completed. This may be due to invalid numbers or provider downtime.</p>
                                    </div>
                                    <div className="p-3 border rounded-lg bg-slate-500/5 border-slate-500/20">
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className="w-2 h-2 rounded-full bg-slate-500" />
                                            <span className="font-semibold text-sm">cancelled</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground">The order was manually cancelled by an administrator or the system.</p>
                                    </div>
                                </div>

                                <div className="p-4 bg-muted/30 rounded-lg border">
                                    <h4 className="text-sm font-semibold mb-2">Polling for Status</h4>
                                    <p className="text-xs text-muted-foreground mb-2">Use the following endpoint to check the current status of any transaction:</p>
                                    <code className="text-xs bg-slate-800 text-emerald-400 px-2 py-1 rounded block font-mono">
                                        GET /v1/transactions/:id
                                    </code>
                                </div>
                            </div>
                        </TabsContent>

                        {/* Code Section */}
                        <TabsContent value="code" className="mt-4 space-y-4">
                            <Tabs defaultValue="curl" className="w-full">
                                <TabsList className="bg-muted/50">
                                    <TabsTrigger value="curl">cURL</TabsTrigger>
                                    <TabsTrigger value="javascript">JS</TabsTrigger>
                                    <TabsTrigger value="python">Python</TabsTrigger>
                                    <TabsTrigger value="java">Java</TabsTrigger>
                                    <TabsTrigger value="cpp">C++</TabsTrigger>
                                </TabsList>

                                {Object.entries(codeExamples).map(([lang, code]) => (
                                    <TabsContent key={lang} value={lang} className="mt-4">
                                        <div className="relative group">
                                            <pre className="bg-slate-950 text-slate-100 p-4 rounded-lg overflow-x-auto text-sm border border-slate-800 font-mono">
                                                <code>{code}</code>
                                            </pre>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-white"
                                                onClick={() => copyToClipboard(code, 'Code')}
                                            >
                                                <Copy className="w-4 h-4" />
                                            </Button>
                                        </div>
                                        <div className="mt-4 p-4 border rounded-lg bg-muted/20">
                                            <p className="text-xs font-semibold mb-2 uppercase tracking-wide opacity-70">Implementation Guide:</p>
                                            <ul className="text-xs space-y-2 text-muted-foreground">
                                                <li>• Replace <code className="bg-muted px-1 rounded">YOUR_API_KEY</code> with your secret key from above.</li>
                                                <li>• The <code className="bg-muted px-1 rounded">bundle_id</code> can be found in the Offers tab.</li>
                                                <li>• Always store the <code className="bg-muted px-1 rounded">transaction_id</code> returned to track delivery.</li>
                                            </ul>
                                        </div>
                                    </TabsContent>
                                ))}
                            </Tabs>
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            {/* Quick Start */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Terminal className="w-5 h-5" />
                        Quick Start
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <ol className="list-decimal list-inside space-y-3 text-sm">
                        <li>Copy your API key from above</li>
                        <li>Set the <code className="bg-muted px-1 rounded">Authorization</code> header with your key</li>
                        <li>Make requests to purchase data bundles</li>
                        <li>Handle the response to confirm successful purchases</li>
                    </ol>
                    <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                        <p className="text-sm text-emerald-600 dark:text-emerald-400">
                            💡 <strong>Agent Pricing:</strong> As an agent, you automatically receive discounted rates on all API purchases.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
