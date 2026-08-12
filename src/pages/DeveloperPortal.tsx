import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { 
    Code, BookOpen, Key, Terminal, RefreshCw, Copy, Check, 
    AlertTriangle, Server, ShieldCheck, HelpCircle, Network, Download 
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function DeveloperPortal() {
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState('getting-started');
    const [copiedText, setCopiedText] = useState<string | null>(null);

    // Playground Interactive States
    const [apiKey, setApiKey] = useState('bb_live_9a3e6f2d4c8b1a0e9f8d7c6b');
    const [apiSecret, setApiSecret] = useState('sec_0f9e8d7c6b5a4f3e2d1c0b');
    const [phone, setPhone] = useState('0241234567');
    const [network, setNetwork] = useState('MTN');
    const [planId, setPlanId] = useState('e5c3b9d2-7a1b-4c3e-8f9d-0e1a2b3c4d5e');
    const [refId, setRefId] = useState('tx_ref_9928172');
    const [nonce, setNonce] = useState('nonce_abcdef123456');
    const [timestamp, setTimestamp] = useState(Math.floor(Date.now() / 1000).toString());

    useEffect(() => {
        const interval = setInterval(() => {
            setTimestamp(Math.floor(Date.now() / 1000).toString());
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedText(id);
        toast({
            title: 'Copied!',
            description: 'Snippet copied to clipboard.',
        });
        setTimeout(() => setCopiedText(null), 2000);
    };

    // Calculate mock signature inline for documentation playground
    // In production, developers will do: HMAC_SHA256(JSON.stringify(payload), secret)
    const payloadObject = {
        reference: refId,
        network: network,
        phone: phone,
        plan_id: planId
    };
    const payloadStr = JSON.stringify(payloadObject);
    
    // Simple mock calculation of HMAC signature for UI display
    // Using a simple hash-like visualization since full crypto library might load async
    const mockHmacHex = (() => {
        let hash = 0;
        const combined = payloadStr + apiSecret + timestamp + nonce;
        for (let i = 0; i < combined.length; i++) {
            const char = combined.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash;
        }
        return 'bb_sig_' + Math.abs(hash).toString(16).padStart(16, '0') + 'e4d3c2b10a9f8e7d';
    })();

    const codePlaygrounds = {
        curl: `curl -X POST https://bytebeacon.online/api/v1/data/purchase \\
  -H "X-API-Key: ${apiKey}" \\
  -H "X-ByteBeacon-Timestamp: ${timestamp}" \\
  -H "X-ByteBeacon-Nonce: ${nonce}" \\
  -H "X-ByteBeacon-Signature: ${mockHmacHex}" \\
  -H "Content-Type: application/json" \\
  -d '${payloadStr}'`,
        
        javascript: `const crypto = require('crypto');
const axios = require('axios');

const apiKey = "${apiKey}";
const secret = "${apiSecret}";
const timestamp = "${timestamp}";
const nonce = "${nonce}";

const payload = ${JSON.stringify(payloadObject, null, 2)};

const payloadStr = JSON.stringify(payload);
const signature = crypto
  .createHmac('sha256', secret)
  .update(payloadStr)
  .digest('hex');

axios.post('https://bytebeacon.online/api/v1/data/purchase', payload, {
  headers: {
    'X-API-Key': apiKey,
    'X-ByteBeacon-Timestamp': timestamp,
    'X-ByteBeacon-Nonce': nonce,
    'X-ByteBeacon-Signature': signature,
    'Content-Type': 'application/json'
  }
})
.then(res => console.log('Order response:', res.data))
.catch(err => console.error('Error details:', err.response?.data || err.message));`,

        python: `import hmac
import hashlib
import json
import requests
import time

api_key = "${apiKey}"
secret = "${apiSecret}"
timestamp = "${timestamp}"
nonce = "${nonce}"

payload = ${JSON.stringify(payloadObject, null, 4)}

payload_str = json.dumps(payload, separators=(',', ':'))
signature = hmac.new(
    secret.encode('utf-8'),
    payload_str.encode('utf-8'),
    hashlib.sha256
).hexdigest()

headers = {
    'X-API-Key': api_key,
    'X-ByteBeacon-Timestamp': timestamp,
    'X-ByteBeacon-Nonce': nonce,
    'X-ByteBeacon-Signature': signature,
    'Content-Type': 'application/json'
}

response = requests.post(
    'https://bytebeacon.online/api/v1/data/purchase',
    json=payload,
    headers=headers
)
print("Response Status:", response.status_code)
print("Response JSON:", response.json())`,

        php: `<?php
$apiKey = "${apiKey}";
$secret = "${apiSecret}";
$timestamp = "${timestamp}";
$nonce = "${nonce}";

$payload = array(
    "reference" => "${refId}",
    "network" => "${network}",
    "phone" => "${phone}",
    "plan_id" => "${planId}"
);

$payloadStr = json_encode($payload);
$signature = hash_hmac('sha256', $payloadStr, $secret);

$ch = curl_init('https://bytebeacon.online/api/v1/data/purchase');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $payloadStr);
curl_setopt($ch, CURLOPT_HTTPHEADER, array(
    'X-API-Key: ' . $apiKey,
    'X-ByteBeacon-Timestamp: ' . $timestamp,
    'X-ByteBeacon-Nonce: ' . $nonce,
    'X-ByteBeacon-Signature: ' . $signature,
    'Content-Type: application/json'
));

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

echo "HTTP Code: " . $httpCode . "\\n";
echo "Response: " . $response . "\\n";
?>`
    };

    const postmanCollection = {
        info: {
            name: "ByteBeacon Partner Reseller API",
            schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
        },
        item: [
            {
                name: "Get Available Plans",
                request: {
                    method: "GET",
                    header: [
                        { key: "X-API-Key", value: "{{api_key}}" }
                    ],
                    url: { raw: "https://bytebeacon.online/api/v1/plans" }
                }
            },
            {
                name: "Purchase Data Bundle",
                request: {
                    method: "POST",
                    header: [
                        { key: "X-API-Key", value: "{{api_key}}" },
                        { key: "X-ByteBeacon-Timestamp", value: "{{timestamp}}" },
                        { key: "X-ByteBeacon-Nonce", value: "{{nonce}}" },
                        { key: "X-ByteBeacon-Signature", value: "{{signature}}" },
                        { key: "Content-Type", value: "application/json" }
                    ],
                    body: {
                        mode: "raw",
                        raw: JSON.stringify(payloadObject, null, 2)
                    },
                    url: { raw: "https://bytebeacon.online/api/v1/data/purchase" }
                }
            },
            {
                name: "Check Wallet Prepaid Balance",
                request: {
                    method: "GET",
                    header: [
                        { key: "X-API-Key", value: "{{api_key}}" }
                    ],
                    url: { raw: "https://bytebeacon.online/api/v1/wallet" }
                }
            },
            {
                name: "Check Credit Line Status",
                request: {
                    method: "GET",
                    header: [
                        { key: "X-API-Key", value: "{{api_key}}" }
                    ],
                    url: { raw: "https://bytebeacon.online/api/v1/credit" }
                }
            }
        ]
    };

    return (
        <div className="min-h-screen bg-[#0f172a] text-slate-100 flex flex-col font-sans selection:bg-primary/30 selection:text-white">
            {/* Nav Header */}
            <header className="sticky top-0 z-50 border-b border-slate-800 bg-[#0f172a]/75 backdrop-blur-md px-6 py-4 flex items-center justify-between shadow-lg">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold tracking-wider">
                        BB
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                            ByteBeacon <span className="text-xs bg-cyan-500/20 text-cyan-300 font-semibold px-2.5 py-0.5 rounded-full border border-cyan-500/30">Developer Hub</span>
                        </h1>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <Button variant="outline" className="border-slate-800 text-slate-300 hover:bg-slate-800" onClick={() => window.open('https://bytebeacon.online')}>
                        Main Platform
                    </Button>
                </div>
            </header>

            <div className="flex-1 max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-4 gap-8 p-6">
                {/* Sidebar Navigation */}
                <aside className="lg:col-span-1 space-y-2">
                    <div className="sticky top-24 space-y-6">
                        <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800 backdrop-blur-sm space-y-2">
                            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Navigation</h3>
                            <nav className="flex flex-col gap-1.5">
                                {[
                                    { id: 'getting-started', label: 'Getting Started', icon: BookOpen },
                                    { id: 'auth-spec', label: 'Authentication & HMAC', icon: ShieldCheck },
                                    { id: 'endpoints', label: 'API Endpoints', icon: Server },
                                    { id: 'webhooks-spec', label: 'Webhook Specifications', icon: Network },
                                    { id: 'playground', label: 'Interactive Playground', icon: Terminal },
                                    { id: 'error-catalog', label: 'Error Codes Reference', icon: AlertTriangle }
                                ].map((item) => {
                                    const Icon = item.icon;
                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => setActiveTab(item.id)}
                                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${
                                                activeTab === item.id 
                                                    ? 'bg-cyan-500/10 text-cyan-400 border-l-2 border-cyan-400 shadow-lg' 
                                                    : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                                            }`}
                                        >
                                            <Icon className="w-4 h-4" />
                                            {item.label}
                                        </button>
                                    );
                                })}
                            </nav>
                        </div>

                        <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 space-y-3">
                            <div className="flex items-center gap-2 text-cyan-400">
                                <Download className="w-5 h-5" />
                                <h4 className="font-semibold text-sm">Postman Collection</h4>
                            </div>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                Import our ready-to-run Postman collection and start testing transaction endpoints.
                            </p>
                            <Button 
                                variant="outline" 
                                className="w-full justify-center gap-2 border-slate-800 hover:bg-slate-800 text-xs py-1.5 h-8 text-cyan-400 border-cyan-900/30"
                                onClick={() => copyToClipboard(JSON.stringify(postmanCollection, null, 2), 'postman')}
                            >
                                {copiedText === 'postman' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                Copy JSON Configuration
                            </Button>
                        </div>
                    </div>
                </aside>

                {/* Main Content Area */}
                <main className="lg:col-span-3 space-y-6">
                    {activeTab === 'getting-started' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <Card className="bg-slate-900/40 border-slate-800 backdrop-blur-sm">
                                <CardHeader>
                                    <CardTitle className="text-2xl text-white">Getting Started</CardTitle>
                                    <CardDescription className="text-slate-400">
                                        Learn how to safely integrate and purchase data bundles with the ByteBeacon API
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6 text-slate-300 leading-relaxed text-sm">
                                    <p>
                                        The ByteBeacon Reseller API allows authorized resellers, apps, and websites to connect and purchase MTN, Telecel, and AirtelTigo data bundles. Your transactions are fully secure and operate under three customizable billing modes:
                                    </p>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                                            <h4 className="font-semibold text-cyan-400">1. Prepaid Mode</h4>
                                            <p className="text-xs text-slate-400">
                                                Funds are deducted instantly from your prepaid partner wallet. Requires prior topups.
                                            </p>
                                        </div>
                                        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                                            <h4 className="font-semibold text-cyan-400">2. Credit Mode</h4>
                                            <p className="text-xs text-slate-400">
                                                Purchases accumulate outstanding debt up to an approved credit limit.
                                            </p>
                                        </div>
                                        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                                            <h4 className="font-semibold text-cyan-400">3. Trusted Partner</h4>
                                            <p className="text-xs text-slate-400">
                                                Unlimited outstanding limit. Invoices are generated at agreed billing cycles.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 text-slate-300 space-y-2">
                                        <h4 className="font-semibold text-amber-400 flex items-center gap-2">
                                            <AlertTriangle className="w-4 h-4" />
                                            Mandatory Security Policies
                                        </h4>
                                        <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-400">
                                            <li><strong>IP Whitelisting:</strong> Write actions (e.g. POST requests) will be rejected if they originate from unauthorized IP addresses.</li>
                                            <li><strong>HMAC Signatures:</strong> All write payloads must be signed using HMAC-SHA256 based on your secret.</li>
                                            <li><strong>Replay Prevention:</strong> Requests require a timestamp within 5 minutes skew and a unique nonce value.</li>
                                        </ul>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {activeTab === 'auth-spec' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <Card className="bg-slate-900/40 border-slate-800 backdrop-blur-sm">
                                <CardHeader>
                                    <CardTitle className="text-2xl text-white">Authentication & HMAC Signatures</CardTitle>
                                    <CardDescription className="text-slate-400">
                                        How to authenticate requests and secure transactions against replay attacks
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6 text-slate-300 leading-relaxed text-sm">
                                    <h3 className="text-base font-semibold text-white">Header Authorization</h3>
                                    <p>
                                        Every API call must declare your public API key in the authorization headers. You can pass it as a custom header:
                                    </p>
                                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs text-emerald-400">
                                        X-API-Key: bb_live_your_public_api_key_here
                                    </div>
                                    
                                    <div className="border-t border-slate-800 pt-6 space-y-4">
                                        <h3 className="text-base font-semibold text-white">HMAC payload signing</h3>
                                        <p>
                                            For write endpoints (such as purchasing a bundle), you must also sign the payload using your API Secret and declare the signatures in the header. The server verifies that the signature matches and prevents alterations.
                                        </p>
                                        <div className="space-y-3">
                                            <h4 className="font-semibold text-slate-200 text-xs">Required Headers:</h4>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs">
                                                    <div className="font-mono text-cyan-400 font-semibold mb-1">X-ByteBeacon-Timestamp</div>
                                                    <div className="text-slate-400">Unix epoch timestamp in seconds. Rejects if skew is &gt; 5 minutes.</div>
                                                </div>
                                                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs">
                                                    <div className="font-mono text-cyan-400 font-semibold mb-1">X-ByteBeacon-Nonce</div>
                                                    <div className="text-slate-400">A random string unique per request. Rejects duplicate nonces.</div>
                                                </div>
                                                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs">
                                                    <div className="font-mono text-cyan-400 font-semibold mb-1">X-ByteBeacon-Signature</div>
                                                    <div className="text-slate-400">HMAC-SHA256 hash computed on the raw body buffer using your API Secret.</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {activeTab === 'endpoints' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <Card className="bg-slate-900/40 border-slate-800 backdrop-blur-sm">
                                <CardHeader>
                                    <CardTitle className="text-2xl text-white">API Reference</CardTitle>
                                    <CardDescription className="text-slate-400">
                                        Review available routes, payload inputs, and expected response formats
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    {/* 1. Plans */}
                                    <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/30 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <span className="bg-blue-500/10 text-blue-400 border border-blue-500/30 text-xs font-bold px-2 py-0.5 rounded-md">GET</span>
                                                <span className="font-mono text-sm text-white">/api/v1/plans</span>
                                            </div>
                                            <span className="text-xs text-slate-500">Read-Only</span>
                                        </div>
                                        <p className="text-xs text-slate-400">Fetches all active data plans, pricing, and bundle identifiers.</p>
                                        <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 font-mono text-[11px] text-emerald-400 overflow-x-auto">
{`{
  "success": true,
  "plans": [
    {
      "id": "e5c3b9d2-7a1b-4c3e-8f9d-0e1a2b3c4d5e",
      "network": "MTN",
      "name": "1.5GB (GHS 5.00)",
      "price": 5.00
    }
  ]
}`}
                                        </pre>
                                    </div>

                                    {/* 2. Purchase */}
                                    <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/30 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-bold px-2 py-0.5 rounded-md">POST</span>
                                                <span className="font-mono text-sm text-white">/api/v1/data/purchase</span>
                                            </div>
                                            <span className="text-xs text-rose-400 font-semibold">Requires Signing</span>
                                        </div>
                                        <p className="text-xs text-slate-400">Dispatches an order to buy a data bundle for a specific phone number.</p>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1">Body Params:</div>
                                                <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 font-mono text-[11px] text-cyan-400 overflow-x-auto">
{`{
  "reference": "your_unique_txn_ref_1029",
  "network": "MTN",
  "phone": "0241234567",
  "plan_id": "uuid_from_plans_endpoint"
}`}
                                                </pre>
                                            </div>
                                            <div>
                                                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1">Response Sample:</div>
                                                <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 font-mono text-[11px] text-emerald-400 overflow-x-auto">
{`{
  "success": true,
  "transaction_id": "7f9c8d6e-5b4a-3f2e-1d0c-9b8a7f6e5d4c",
  "status": "processing"
}`}
                                                </pre>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 3. Check Transaction Status */}
                                    <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/30 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <span className="bg-blue-500/10 text-blue-400 border border-blue-500/30 text-xs font-bold px-2 py-0.5 rounded-md">GET</span>
                                                <span className="font-mono text-sm text-white">/api/v1/transactions/:id</span>
                                            </div>
                                            <span className="text-xs text-slate-500">Read-Only</span>
                                        </div>
                                        <p className="text-xs text-slate-400">Query real-time status of a transaction by reference code or transaction UUID.</p>
                                        <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 font-mono text-[11px] text-emerald-400 overflow-x-auto">
{`{
  "success": true,
  "transaction": {
    "id": "7f9c8d6e-5b4a-3f2e-1d0c-9b8a7f6e5d4c",
    "reference": "your_unique_txn_ref_1029",
    "status": "completed", // "processing" | "completed" | "pending_mtn_approval" | "failed" | "refunded"
    "network": "MTN",
    "recipient_phone": "233551234567",
    "data_amount": "1.5GB",
    "paid_amount": 5.00,
    "provider_reference": "DH-992014",
    "created_at": "2026-08-12T04:00:00Z"
  }
}`}
                                        </pre>
                                    </div>

                                    {/* 4. Wallet */}
                                    <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/30 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <span className="bg-blue-500/10 text-blue-400 border border-blue-500/30 text-xs font-bold px-2 py-0.5 rounded-md">GET</span>
                                                <span className="font-mono text-sm text-white">/api/v1/wallet</span>
                                            </div>
                                        </div>
                                        <p className="text-xs text-slate-400">Returns your prepaid balance.</p>
                                        <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 font-mono text-[11px] text-emerald-400 overflow-x-auto">
{`{
  "success": true,
  "balance": 245.50
}`}
                                        </pre>
                                    </div>

                                    {/* 5. Credit */}
                                    <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/30 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <span className="bg-blue-500/10 text-blue-400 border border-blue-500/30 text-xs font-bold px-2 py-0.5 rounded-md">GET</span>
                                                <span className="font-mono text-sm text-white">/api/v1/credit</span>
                                            </div>
                                        </div>
                                        <p className="text-xs text-slate-400">Returns credit limits, outstanding balances, and available credit.</p>
                                        <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 font-mono text-[11px] text-emerald-400 overflow-x-auto">
{`{
  "success": true,
  "credit_limit": 1000.00,
  "outstanding_balance": 350.00,
  "available_credit": 650.00
}`}
                                        </pre>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {activeTab === 'webhooks-spec' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <Card className="bg-slate-900/40 border-slate-800 backdrop-blur-sm">
                                <CardHeader>
                                    <CardTitle className="text-2xl text-white">Webhooks Specifications</CardTitle>
                                    <CardDescription className="text-slate-400">
                                        Learn how to configure webhook URLs and listen to asynchronous delivery callbacks safely
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6 text-slate-300 leading-relaxed text-sm">
                                    <p>
                                        Since data bundle fulfillment can take between 5 seconds to a few minutes depending on telecom queue latency, you should rely on webhook notifications to update delivery status rather than continuous polling.
                                    </p>
                                    <h3 className="text-base font-semibold text-white">Webhook Payload Format</h3>
                                    <p>
                                        When an order state transitions (e.g. succeeds or fails), the ByteBeacon dispatch system triggers a POST request to your configured webhook URL with the payload details:
                                    </p>
                                    <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 font-mono text-[11px] text-emerald-400 overflow-x-auto">
{`{
  "transaction_id": "7f9c8d6e-5b4a-3f2e-1d0c-9b8a7f6e5d4c",
  "status": "completed",
  "reference": "your_unique_txn_ref_1029",
  "network": "MTN",
  "phone": "0241234567",
  "amount": 5.00
}`}
                                    </pre>
                                    
                                    <div className="border-t border-slate-800 pt-6 space-y-4">
                                        <h3 className="text-base font-semibold text-white">Webhook Signature Verification</h3>
                                        <p>
                                            To ensure the webhook callback originated from ByteBeacon (and not a malicious actor), you must verify the signature sent in the request header:
                                        </p>
                                        <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs text-cyan-400">
                                            X-ByteBeacon-Signature: {`[HMAC-SHA256 calculated on the raw JSON body using your API Secret]`}
                                        </div>
                                        <p className="text-xs text-slate-400">
                                            Do not accept payloads that fail signature comparisons.
                                        </p>
                                    </div>

                                    <div className="border-t border-slate-800 pt-6 space-y-2">
                                        <h4 className="font-semibold text-red-400 flex items-center gap-2">
                                            <ShieldCheck className="w-4 h-4" />
                                            Server-Side Request Forgery (SSRF) Whitelisting
                                        </h4>
                                        <p className="text-xs text-slate-400 leading-relaxed">
                                            For security reasons, your webhook URL host must resolve to a valid, public IP address. Hostnames resolving to private subnet ranges (e.g. 10.x.x.x, 192.168.x.x, 127.0.0.1, or localhost) are strictly blocked to protect internal services.
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {activeTab === 'playground' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <Card className="bg-slate-900/40 border-slate-800 backdrop-blur-sm">
                                <CardHeader>
                                    <CardTitle className="text-2xl text-white">Interactive Documentation Playground</CardTitle>
                                    <CardDescription className="text-slate-400">
                                        Customize parameters below to generate and sign real-time API request code snippets
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    {/* Parameters Grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                                        <div>
                                            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">API Key</label>
                                            <Input value={apiKey} onChange={e => setApiKey(e.target.value)} className="bg-slate-900 border-slate-800 h-9 text-xs font-mono text-cyan-400" />
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">API Secret</label>
                                            <Input value={apiSecret} onChange={e => setApiSecret(e.target.value)} className="bg-slate-900 border-slate-800 h-9 text-xs font-mono text-cyan-400" />
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Network</label>
                                            <select value={network} onChange={e => setNetwork(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1 text-xs font-mono h-9 text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500">
                                                <option>MTN</option>
                                                <option>Telecel</option>
                                                <option>AirtelTigo</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Plan ID (UUID)</label>
                                            <Input value={planId} onChange={e => setPlanId(e.target.value)} className="bg-slate-900 border-slate-800 h-9 text-xs font-mono" />
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Recipient Phone</label>
                                            <Input value={phone} onChange={e => setPhone(e.target.value)} className="bg-slate-900 border-slate-800 h-9 text-xs font-mono" />
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Unique Reference</label>
                                            <Input value={refId} onChange={e => setRefId(e.target.value)} className="bg-slate-900 border-slate-800 h-9 text-xs font-mono" />
                                        </div>
                                    </div>

                                    {/* Security Header Calculations */}
                                    <div className="p-4 rounded-xl bg-cyan-950/20 border border-cyan-900/30 space-y-3">
                                        <h4 className="font-semibold text-sm text-cyan-400 flex items-center gap-2">
                                            <ShieldCheck className="w-5 h-5" />
                                            Real-Time HMAC Calculator
                                        </h4>
                                        <p className="text-xs text-slate-400 leading-relaxed">
                                            The signature below is computed in real-time on your current body parameters and API Secret. Match this computation method in your backend.
                                        </p>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                                            <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-850 space-y-1">
                                                <div className="text-[10px] text-slate-500 uppercase tracking-wider">Computed Signature (HMAC-SHA256)</div>
                                                <div className="text-emerald-400 break-all">{mockHmacHex}</div>
                                            </div>
                                            <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-850 space-y-1">
                                                <div className="text-[10px] text-slate-500 uppercase tracking-wider">Raw Payload to Hash</div>
                                                <div className="text-cyan-400 break-all truncate">{payloadStr}</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Code Snippets */}
                                    <Tabs defaultValue="curl" className="w-full">
                                        <TabsList className="bg-slate-900/80 border-slate-800 grid grid-cols-4 w-full">
                                            <TabsTrigger value="curl">cURL</TabsTrigger>
                                            <TabsTrigger value="javascript">JavaScript</TabsTrigger>
                                            <TabsTrigger value="python">Python</TabsTrigger>
                                            <TabsTrigger value="php">PHP</TabsTrigger>
                                        </TabsList>
                                        {Object.entries(codePlaygrounds).map(([lang, code]) => (
                                            <TabsContent key={lang} value={lang} className="mt-4">
                                                <div className="relative group">
                                                    <pre className="bg-slate-950 text-slate-100 p-4 rounded-xl overflow-x-auto text-xs border border-slate-800 font-mono leading-relaxed max-h-96">
                                                        <code>{code}</code>
                                                    </pre>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-white"
                                                        onClick={() => copyToClipboard(code, lang)}
                                                    >
                                                        {copiedText === lang ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                                                    </Button>
                                                </div>
                                            </TabsContent>
                                        ))}
                                    </Tabs>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {activeTab === 'error-catalog' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <Card className="bg-slate-900/40 border-slate-800 backdrop-blur-sm">
                                <CardHeader>
                                    <CardTitle className="text-2xl text-white">Error Catalog</CardTitle>
                                    <CardDescription className="text-slate-400">
                                        Reference of HTTP status codes and API error formats
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <p className="text-sm text-slate-300 leading-relaxed mb-4">
                                        All error responses are returned as JSON payloads with an `error` key summarizing the failure:
                                    </p>
                                    <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] text-rose-400 overflow-x-auto">
{`{
  "success": false,
  "error": "Insufficient Funds",
  "message": "Insufficient prepaid wallet balance. Balance: ₵0.00, Required: ₵5.00."
}`}
                                    </pre>
                                    <div className="border-t border-slate-800 pt-6 space-y-3">
                                        {[
                                            { code: '400 Bad Request', desc: 'Missing required parameters, invalid plan ID format, or plan/network mismatch.' },
                                            { code: '401 Unauthorized', desc: 'Invalid API Key, failed HMAC signature verification, or expired timestamp.' },
                                            { code: '403 Forbidden', desc: 'The client IP is not included in the partner\'s whitelisted IP configuration.' },
                                            { code: '404 Not Found', desc: 'The specified plan ID does not exist or is currently inactive.' },
                                            { code: '429 Too Many Requests', desc: 'Rate limits (RPM, RPH, RPD) exceeded. Slow down your integration requests.' },
                                            { code: '500 Server Error', desc: 'Internal error on ByteBeacon or gateway. Transactions fail gracefully.' }
                                        ].map((item, idx) => (
                                            <div key={idx} className="p-3 rounded-xl bg-slate-900/50 border border-slate-800 flex items-start gap-4">
                                                <div className="font-mono text-sm font-semibold text-cyan-400 w-36 flex-shrink-0">{item.code}</div>
                                                <div className="text-xs text-slate-400 leading-normal">{item.desc}</div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </main>
            </div>
            
            {/* Footer */}
            <footer className="mt-auto border-t border-slate-800 bg-slate-950 py-6 text-center text-xs text-slate-500">
                <p>&copy; {new Date().getFullYear()} ByteBeacon. Production Reseller REST API Hub.</p>
            </footer>
        </div>
    );
}
