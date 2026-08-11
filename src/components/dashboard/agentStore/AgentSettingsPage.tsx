import React, { useEffect, useState } from 'react';
import { agentStoreService, AgentStore } from '@/services/agentStore.service';
import { Settings, Save, Globe, Copy, Check, ExternalLink, RefreshCw, Store, Phone, Image, FileText } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export const AgentSettingsPage: React.FC = () => {
    const { toast } = useToast();
    const [store, setStore] = useState<AgentStore | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [copied, setCopied] = useState(false);

    // Form inputs
    const [storeName, setStoreName] = useState('');
    const [description, setDescription] = useState('');
    const [phone, setPhone] = useState('');
    const [logoUrl, setLogoUrl] = useState('');

    const loadStoreData = async () => {
        setLoading(true);
        try {
            const res = await agentStoreService.getMyStore();
            if (res.success && res.store) {
                setStore(res.store);
                setStoreName(res.store.store_name || '');
                setDescription(res.store.description || '');
                setPhone(res.store.phone || '');
                setLogoUrl(res.store.logo_url || '');
            }
        } catch (err: any) {
            toast({ title: 'Error', description: err.message || 'Failed to load store settings', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadStoreData();
    }, []);

    const publicUrl = store ? `${window.location.origin}/store/${store.slug}` : '';

    const handleCopyLink = () => {
        if (!publicUrl) return;
        navigator.clipboard.writeText(publicUrl);
        setCopied(true);
        toast({ title: 'Copied!', description: 'Public storefront URL copied to clipboard.' });
        setTimeout(() => setCopied(false), 2000);
    };

    const handleSaveSettings = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!storeName.trim()) {
            toast({ title: 'Validation Error', description: 'Store name is required.', variant: 'destructive' });
            return;
        }

        setSaving(true);
        try {
            const res = await agentStoreService.updateSettings({
                store_name: storeName.trim(),
                description: description.trim(),
                phone: phone.trim(),
                logo_url: logoUrl.trim()
            });

            if (res.success) {
                toast({ title: 'Settings Saved', description: 'Agent store profile updated successfully.' });
                loadStoreData();
            }
        } catch (err: any) {
            toast({ title: 'Save Failed', description: err.message || 'Failed to update store settings', variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="space-y-4 sm:space-y-6 bg-[#141518] text-white p-3.5 sm:p-6 rounded-2xl sm:rounded-3xl font-sans w-full min-w-0">
                <div className="bg-[#202227] p-6 rounded-2xl border border-white/5 space-y-4 animate-pulse">
                    <div className="h-6 w-48 bg-[#2a2b30] rounded" />
                    <div className="h-4 w-72 bg-[#2a2b30] rounded" />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4 sm:space-y-6 bg-[#141518] text-white p-3.5 sm:p-6 rounded-2xl sm:rounded-3xl font-sans w-full min-w-0 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 bg-[#202227] p-4 sm:p-6 rounded-2xl border border-white/5">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Settings className="w-5 h-5 text-[#a3e635]" />
                        Store Configuration & Profile
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                        Customize your public store name, contact phone, logo, and storefront link settings.
                    </p>
                </div>
                <button
                    onClick={handleSaveSettings}
                    disabled={saving}
                    className="px-5 py-2.5 bg-[#a3e635] hover:bg-[#b5f73c] text-black font-extrabold rounded-xl shadow-lg shadow-[#a3e635]/20 flex items-center gap-2 text-xs transition-all disabled:opacity-50"
                >
                    <Save className="w-4 h-4" />
                    {saving ? 'Saving...' : 'Save Settings'}
                </button>
            </div>

            {/* Public Storefront Link Box */}
            {store?.slug && (
                <div className="bg-[#202227] p-5 sm:p-6 rounded-2xl border border-[#a3e635]/20 space-y-3 shadow-xl">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider">
                            <Globe className="w-4 h-4 text-[#a3e635]" />
                            Public Storefront Link
                        </div>
                        <a
                            href={`/store/${store.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-[#a3e635] font-bold hover:underline flex items-center gap-1"
                        >
                            Open Store <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-2 bg-[#18191c] p-3 rounded-xl border border-white/5">
                        <span className="text-xs font-mono text-[#a3e635] truncate max-w-full flex-1 px-2">
                            {publicUrl}
                        </span>
                        <button
                            type="button"
                            onClick={handleCopyLink}
                            className="w-full sm:w-auto px-4 py-2 bg-[#202227] hover:bg-[#282a30] text-white text-xs font-bold rounded-lg border border-white/10 flex items-center justify-center gap-1.5 transition-all"
                        >
                            {copied ? <Check className="w-3.5 h-3.5 text-[#a3e635]" /> : <Copy className="w-3.5 h-3.5" />}
                            {copied ? 'Copied' : 'Copy Link'}
                        </button>
                    </div>
                </div>
            )}

            {/* Settings Form */}
            <form onSubmit={handleSaveSettings} className="bg-[#202227] p-5 sm:p-6 rounded-2xl border border-white/5 space-y-5 shadow-xl">
                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                        <Store className="w-3.5 h-3.5 text-[#a3e635]" />
                        Store Name <span className="text-red-400">*</span>
                    </label>
                    <input
                        type="text"
                        value={storeName}
                        onChange={(e) => setStoreName(e.target.value)}
                        placeholder="e.g. Tesla Data Express"
                        required
                        className="w-full px-4 py-2.5 bg-[#18191c] border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#a3e635]"
                    />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-[#a3e635]" />
                            Support Contact Phone
                        </label>
                        <input
                            type="text"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="e.g. 0241234567"
                            className="w-full px-4 py-2.5 bg-[#18191c] border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#a3e635]"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                            <Image className="w-3.5 h-3.5 text-[#a3e635]" />
                            Logo Image URL
                        </label>
                        <input
                            type="url"
                            value={logoUrl}
                            onChange={(e) => setLogoUrl(e.target.value)}
                            placeholder="https://..."
                            className="w-full px-4 py-2.5 bg-[#18191c] border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#a3e635]"
                        />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-[#a3e635]" />
                        Store Description / Bio
                    </label>
                    <textarea
                        rows={3}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Brief summary displayed to customers on your public storefront..."
                        className="w-full px-4 py-2.5 bg-[#18191c] border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#a3e635]"
                    />
                </div>

                <div className="pt-2 border-t border-white/5 flex justify-end">
                    <button
                        type="submit"
                        disabled={saving}
                        className="px-6 py-2.5 bg-[#a3e635] hover:bg-[#b5f73c] text-black font-extrabold rounded-xl shadow-lg shadow-[#a3e635]/20 flex items-center gap-2 text-xs transition-all disabled:opacity-50"
                    >
                        <Save className="w-4 h-4" />
                        {saving ? 'Saving...' : 'Save Settings'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default AgentSettingsPage;
