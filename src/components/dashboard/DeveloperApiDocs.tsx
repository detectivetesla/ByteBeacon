import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
    BookOpen, ShieldAlert, Key, Clipboard, Check, Terminal,
    FileText, Cpu, Coins, Activity, Code as CodeIcon
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function DeveloperApiDocs() {
    const { toast } = useToast();
    const [activeSection, setActiveSection] = useState('auth');
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        toast({
            title: 'Copied!',
            description: 'Snippet copied to clipboard.',
        });
        setTimeout(() => setCopiedId(null), 2000);
    };

    const endpoints = [
        {
            method: 'GET',
            path: '/api/v1/plans',
            description: 'Fetch all available active mobile data bundles, networks, data volumes, and prices.',
            response: `{
  "success": true,
  "plans": [
    {
      "id": "e5c3b9d2-7a1b-4c3e-8f9d-0e1a2b3c4d5e",
      "network": "MTN",
      "name": "MTN 1GB Data Bundle",
      "data_amount": "1GB",
      "price": 5.00,
      "validity": "Non-expiry"
    }
  ]
}`
        },
        {
            method: 'POST',
            path: '/api/v1/data/purchase',
            description: 'Place a data bundle purchase order for a recipient phone number.',
            requestBody: `{
  "reference": "your_unique_txn_ref_99812",
  "network": "MTN",
  "phone": "0551234567",
  "plan_id": "e5c3b9d2-7a1b-4c3e-8f9d-0e1a2b3c4d5e"
}`,
            response: `{
  "success": true,
  "transaction_id": "7f9c8d6e-5b4a-3f2e-1d0c-9b8a7f6e5d4c",
  "status": "processing" // "processing" | "completed" | "pending_mtn_approval" | "failed"
}`
        },
        {
            method: 'GET',
            path: '/api/v1/transactions/:id',
            description: 'Fetch real-time transaction status by reference code or transaction UUID.',
            response: `{
  "success": true,
  "transaction": {
    "id": "7f9c8d6e-5b4a-3f2e-1d0c-9b8a7f6e5d4c",
    "reference": "your_unique_txn_ref_99812",
    "status": "completed",
    "network": "MTN",
    "recipient_phone": "233551234567",
    "data_amount": "1GB",
    "paid_amount": 5.00,
    "provider_reference": "DH-992014",
    "created_at": "2026-08-12T04:00:00Z"
  }
}`
        },
        {
            method: 'GET',
            path: '/api/v1/wallet',
            description: 'Fetch your prepaid API/reseller wallet balance.',
            response: `{
  "success": true,
  "balance": 450.75,
  "currency": "GHS"
}`
        },
        {
            method: 'GET',
            path: '/api/v1/credit',
            description: 'Fetch credit overdraft limits and available credit.',
            response: `{
  "success": true,
  "credit_limit": 1000.00,
  "outstanding_balance": 250.00,
  "available_credit": 750.00,
  "billing_mode": "credit"
}`
        }
    ];

    const codeSnippets = {
        curl: `curl -X POST https://www.bytebeacon.online/api/v1/data/purchase \\
  -H "x-api-key: dk_your_api_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "reference": "your_unique_txn_ref_99812",
    "network": "MTN",
    "phone": "0551234567",
    "plan_id": "e5c3b9d2-7a1b-4c3e-8f9d-0e1a2b3c4d5e"
  }'`,
        javascript: `const axios = require('axios');

const payload = {
  reference: "your_unique_txn_ref_99812",
  network: "MTN",
  phone: "0551234567",
  plan_id: "e5c3b9d2-7a1b-4c3e-8f9d-0e1a2b3c4d5e"
};

axios.post('https://www.bytebeacon.online/api/v1/data/purchase', payload, {
  headers: {
    'x-api-key': 'dk_your_api_key_here',
    'Content-Type': 'application/json'
  }
})
.then(res => console.log('Response:', res.data))
.catch(err => console.error(err.response?.data || err.message));`,
        python: `import requests

url = "https://www.bytebeacon.online/api/v1/data/purchase"
headers = {
    "x-api-key": "dk_your_api_key_here",
    "Content-Type": "application/json"
}
payload = {
    "reference": "your_unique_txn_ref_99812",
    "network": "MTN",
    "phone": "0551234567",
    "plan_id": "e5c3b9d2-7a1b-4c3e-8f9d-0e1a2b3c4d5e"
}

response = requests.post(url, json=payload, headers=headers)
print(response.json())`,
        php: `<?php
$ch = curl_init('https://www.bytebeacon.online/api/v1/data/purchase');
$payload = json_encode([
    "reference" => "your_unique_txn_ref_99812",
    "network" => "MTN",
    "phone" => "0551234567",
    "plan_id" => "e5c3b9d2-7a1b-4c3e-8f9d-0e1a2b3c4d5e"
]);

curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'x-api-key: dk_your_api_key_here',
    'Content-Type: application/json'
]);

$response = curl_exec($ch);
curl_close($ch);
echo $response;
?>`
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-16">
            
            {/* Morphic Glassy Hero Card */}
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/60 to-slate-950/80 p-8 shadow-2xl backdrop-blur-xl">
                {/* Neomorphic Radial Glows */}
                <div className="absolute -left-20 -top-20 w-72 h-72 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
                <div className="absolute -right-20 -bottom-20 w-72 h-72 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
                
                <div className="relative z-10 text-center max-w-3xl mx-auto space-y-4">
                    <div className="inline-flex items-center justify-center p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-2xl text-cyan-400 mb-2 animate-pulse">
                        <BookOpen className="w-8 h-8" />
                    </div>
                    <h1 className="text-3xl md:text-5xl font-display font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-cyan-400 tracking-tight">
                        Portal 02 API Documentation
                    </h1>
                    <p className="text-sm md:text-base text-muted-foreground leading-relaxed font-medium">
                        Complete guide to integrating with our data, airtime, voice, and billing services. Automate data topups instantly using REST requests.
                    </p>
                </div>
            </div>

            {/* Documentation Tabs (Morphic Layout) */}
            <div className="rounded-3xl border border-white/5 bg-slate-950/40 backdrop-blur-xl p-4 shadow-xl">
                <Tabs defaultValue="auth" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 md:grid-cols-6 gap-2 bg-muted/30 p-1.5 rounded-2xl mb-8">
                        <TabsTrigger value="auth" className="rounded-xl font-bold uppercase text-[10px] tracking-wider py-3">
                            <ShieldAlert className="w-3.5 h-3.5 mr-2 text-cyan-400" />
                            Auth
                        </TabsTrigger>
                        <TabsTrigger value="offers" className="rounded-xl font-bold uppercase text-[10px] tracking-wider py-3">
                            <Cpu className="w-3.5 h-3.5 mr-2 text-emerald-400" />
                            Offers
                        </TabsTrigger>
                        <TabsTrigger value="endpoints" className="rounded-xl font-bold uppercase text-[10px] tracking-wider py-3">
                            <Terminal className="w-3.5 h-3.5 mr-2 text-purple-400" />
                            Endpoints
                        </TabsTrigger>
                        <TabsTrigger value="wallet" className="rounded-xl font-bold uppercase text-[10px] tracking-wider py-3">
                            <Coins className="w-3.5 h-3.5 mr-2 text-amber-400" />
                            Wallet
                        </TabsTrigger>
                        <TabsTrigger value="status" className="rounded-xl font-bold uppercase text-[10px] tracking-wider py-3">
                            <Activity className="w-3.5 h-3.5 mr-2 text-rose-400" />
                            Status
                        </TabsTrigger>
                        <TabsTrigger value="code" className="rounded-xl font-bold uppercase text-[10px] tracking-wider py-3">
                            <CodeIcon className="w-3.5 h-3.5 mr-2 text-indigo-400" />
                            Code
                        </TabsTrigger>
                    </TabsList>

                    {/* 1. AUTH TAB */}
                    <TabsContent value="auth" className="space-y-6 outline-none animate-in fade-in duration-300">
                        <Card className="bg-[#0f172a]/50 border-slate-800/80 backdrop-blur-md">
                            <CardHeader>
                                <CardTitle className="text-xl flex items-center gap-2 text-white">
                                    <ShieldAlert className="w-5 h-5 text-cyan-400" />
                                    API Authentication
                                </CardTitle>
                                <CardDescription className="text-xs">
                                    Securely authenticate all API requests using your API key.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {/* Claymorphic Alert Notice */}
                                <div className="clay-card-blue p-5 text-sm text-slate-300 leading-relaxed relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/10 rounded-full blur-xl" />
                                    <div className="flex gap-3 relative z-10">
                                        <ShieldAlert className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <span className="font-bold text-white uppercase text-xs tracking-wider block mb-1">Important</span>
                                            Include your API key in the <code className="bg-slate-900 px-1.5 py-0.5 rounded font-mono text-cyan-400 text-xs">x-api-key</code> header for all requests. Generate and manage your keys in the <a href="/dashboard/api-keys" className="font-extrabold text-cyan-400 underline hover:text-cyan-300">API Keys</a> section.
                                        </div>
                                    </div>
                                </div>

                                <div className="grid md:grid-cols-2 gap-6">
                                    {/* Header Example */}
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                                            Header Example
                                        </label>
                                        <div className="relative group">
                                            <pre className="bg-slate-900 border border-slate-800 rounded-xl p-4 font-mono text-xs text-slate-300">
                                                <code>x-api-key: dk_your_api_key_here</code>
                                            </pre>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={() => copyToClipboard('x-api-key: dk_your_api_key_here', 'header-ex')}
                                            >
                                                {copiedId === 'header-ex' ? <Check className="w-4 h-4 text-emerald-400" /> : <Clipboard className="w-4 h-4" />}
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Base URL */}
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                                            Base URL
                                        </label>
                                        <div className="relative group">
                                            <pre className="bg-slate-900 border border-slate-800 rounded-xl p-4 font-mono text-xs text-slate-300">
                                                <code>https://api.bytebeacon.com/api/v1</code>
                                            </pre>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={() => copyToClipboard('https://api.bytebeacon.com/api/v1', 'base-url')}
                                            >
                                                {copiedId === 'base-url' ? <Check className="w-4 h-4 text-emerald-400" /> : <Clipboard className="w-4 h-4" />}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* 2. OFFERS TAB */}
                    <TabsContent value="offers" className="space-y-6 outline-none animate-in fade-in duration-300">
                        <Card className="bg-[#0f172a]/50 border-slate-800/80 backdrop-blur-md">
                            <CardHeader>
                                <CardTitle className="text-xl flex items-center gap-2 text-white">
                                    <Cpu className="w-5 h-5 text-emerald-400" />
                                    Data Offers
                                </CardTitle>
                                <CardDescription className="text-xs">
                                    Access all available bundles and network codes to request purchases.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4 text-sm text-slate-300">
                                <p>
                                    To fetch the live plans list, call the <code className="bg-slate-900 text-cyan-400 px-1.5 py-0.5 rounded font-mono text-xs">/plans</code> endpoint. Agent discounts apply automatically in the prices returned.
                                </p>
                                <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/30">
                                    <h4 className="font-semibold text-white mb-2 text-xs uppercase tracking-wider">Valid Network Keys:</h4>
                                    <ul className="grid grid-cols-3 gap-3 text-xs">
                                        <li className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-center shadow-[0_0_15px_rgba(234,179,8,0.05)] hover:border-yellow-500/40 transition-all duration-300">
                                            <strong className="text-yellow-400 block font-mono text-sm mb-0.5">MTN</strong> 
                                            <span className="text-yellow-100/70">MTN Ghana</span>
                                        </li>
                                        <li className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-center shadow-[0_0_15px_rgba(239,68,68,0.05)] hover:border-red-500/40 transition-all duration-300">
                                            <strong className="text-red-400 block font-mono text-sm mb-0.5">Telecel</strong> 
                                            <span className="text-red-100/70">Telecel Ghana</span>
                                        </li>
                                        <li className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-center shadow-[0_0_15px_rgba(59,130,246,0.05)] hover:border-blue-500/40 transition-all duration-300">
                                            <strong className="text-blue-400 block font-mono text-sm mb-0.5">AirtelTigo</strong> 
                                            <span className="text-blue-100/70">AT Ghana</span>
                                        </li>
                                    </ul>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* 3. ENDPOINTS TAB */}
                    <TabsContent value="endpoints" className="space-y-6 outline-none animate-in fade-in duration-300">
                        <div className="space-y-4">
                            {endpoints.map((ep, index) => (
                                <Card key={index} className="bg-[#0f172a]/50 border-slate-800/80 backdrop-blur-md overflow-hidden">
                                    <CardHeader className="border-b border-slate-850 py-4 bg-slate-900/10">
                                        <div className="flex flex-wrap items-center gap-3">
                                            <span className={cn(
                                                "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border",
                                                ep.method === 'GET'
                                                    ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                                                    : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                            )}>
                                                {ep.method}
                                            </span>
                                            <code className="text-sm font-mono font-bold text-white">{ep.path}</code>
                                            <span className="text-xs text-muted-foreground ml-auto">{ep.description}</span>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-6 grid md:grid-cols-2 gap-6">
                                        {ep.requestBody && (
                                            <div className="space-y-2">
                                                <div className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Request Payload</div>
                                                <pre className="p-3 rounded-xl bg-slate-900 border border-slate-850 text-[11px] font-mono text-cyan-400 overflow-x-auto">
                                                    <code>{ep.requestBody}</code>
                                                </pre>
                                            </div>
                                        )}
                                        <div className={cn("space-y-2", !ep.requestBody && "col-span-2")}>
                                            <div className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Expected JSON Response</div>
                                            <pre className="p-3 rounded-xl bg-slate-900 border border-slate-850 text-[11px] font-mono text-emerald-400 overflow-x-auto">
                                                <code>{ep.response}</code>
                                            </pre>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </TabsContent>

                    {/* 4. WALLET TAB */}
                    <TabsContent value="wallet" className="space-y-6 outline-none animate-in fade-in duration-300">
                        <Card className="bg-[#0f172a]/50 border-slate-800/80 backdrop-blur-md">
                            <CardHeader>
                                <CardTitle className="text-xl flex items-center gap-2 text-white">
                                    <Coins className="w-5 h-5 text-amber-400" />
                                    Wallet Management
                                </CardTitle>
                                <CardDescription className="text-xs">
                                    Monitor your reseller credit and wallet thresholds.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4 text-sm text-slate-300">
                                <p>
                                    Perform GET requests to the <code className="bg-slate-900 text-cyan-400 px-1.5 py-0.5 rounded font-mono text-xs">/wallet</code> path to retrieve your current credit. Ensure sufficient wallet balance before placing buy orders to avoid 402 Insufficient Balance error codes.
                                </p>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* 5. STATUS TAB */}
                    <TabsContent value="status" className="space-y-6 outline-none animate-in fade-in duration-300">
                        <Card className="bg-[#0f172a]/50 border-slate-800/80 backdrop-blur-md">
                            <CardHeader>
                                <CardTitle className="text-xl flex items-center gap-2 text-white">
                                    <Activity className="w-5 h-5 text-rose-400" />
                                    Fulfillment Status Map
                                </CardTitle>
                                <CardDescription className="text-xs">
                                    Review order processing states.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                                {[
                                    { state: 'pending', color: 'bg-yellow-500', desc: 'Received, validating balance.' },
                                    { state: 'processing', color: 'bg-blue-500', desc: 'Sent to telecom network queue.' },
                                    { state: 'completed', color: 'bg-emerald-500', desc: 'Credited successfully to phone.' },
                                    { state: 'failed', color: 'bg-red-500', desc: 'Fulfillment failed, balance refunded.' }
                                ].map((item, idx) => (
                                    <div key={idx} className="p-4 border border-slate-800 bg-slate-900/40 rounded-2xl space-y-2">
                                        <div className="flex items-center gap-2">
                                            <span className={cn("w-2 h-2 rounded-full", item.color)} />
                                            <span className="font-mono text-xs text-white uppercase font-bold">{item.state}</span>
                                        </div>
                                        <p className="text-xs text-slate-400 leading-normal">{item.desc}</p>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* 6. CODE TAB */}
                    <TabsContent value="code" className="space-y-6 outline-none animate-in fade-in duration-300">
                        <Tabs defaultValue="curl" className="w-full">
                            <TabsList className="bg-slate-900 border border-slate-800 grid grid-cols-4 w-full max-w-sm rounded-xl p-1 mb-4">
                                <TabsTrigger value="curl" className="rounded-lg text-[10px] py-2 font-bold">cURL</TabsTrigger>
                                <TabsTrigger value="javascript" className="rounded-lg text-[10px] py-2 font-bold">NodeJS</TabsTrigger>
                                <TabsTrigger value="python" className="rounded-lg text-[10px] py-2 font-bold">Python</TabsTrigger>
                                <TabsTrigger value="php" className="rounded-lg text-[10px] py-2 font-bold">PHP</TabsTrigger>
                            </TabsList>
                            {Object.entries(codeSnippets).map(([lang, code]) => (
                                <TabsContent key={lang} value={lang} className="outline-none">
                                    <div className="relative group">
                                        <pre className="bg-slate-950 text-slate-100 p-5 rounded-2xl overflow-x-auto text-[11px] border border-slate-850 font-mono leading-relaxed max-h-96">
                                            <code>{code}</code>
                                        </pre>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-white"
                                            onClick={() => copyToClipboard(code, lang)}
                                        >
                                            {copiedId === lang ? <Check className="w-4 h-4 text-emerald-400" /> : <Clipboard className="w-4 h-4" />}
                                        </Button>
                                    </div>
                                </TabsContent>
                            ))}
                        </Tabs>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
