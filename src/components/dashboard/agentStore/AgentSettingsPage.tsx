import React, { useEffect, useState } from 'react';
import { agentStoreService, AgentStore } from '@/services/agentStore.service';
import { Settings, Save, Globe, Copy, Check, ExternalLink, RefreshCw, Store, Phone, Image, FileText } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { getStorefrontUrl } from '@/utils/domain';
import { isValidLogoUrl } from '@/utils/storeBranding';

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

    const publicUrl = store ? getStorefrontUrl(store.slug) : '';

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

        const trimmedLogo = logoUrl.trim();
        if (trimmedLogo && !isValidLogoUrl(trimmedLogo)) {
            toast({ 
                title: 'Validation Error', 
                description: 'Please enter a valid image URL starting with http:// or https://', 
                variant: 'destructive' 
            });
            return;
        }

        setSaving(true);
        try {
            const res = await agentStoreService.updateSettings({
                store_name: storeName.trim(),
                description: description.trim(),
                phone: phone.trim(),
                logo_url: trimmedLogo
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
                            href={publicUrl}
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
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                                <Image className="w-3.5 h-3.5 text-[#a3e635]" />
                                Logo Image URL
                            </label>
                            {logoUrl.trim() && (
                                <button
                                    type="button"
                                    onClick={() => setLogoUrl('')}
                                    className="text-[11px] font-bold text-red-400 hover:text-red-300 hover:underline"
                                >
                                    Clear Logo
                                </button>
                            )}
                        </div>
                        <input
                            type="url"
                            value={logoUrl}
                            onChange={(e) => setLogoUrl(e.target.value)}
                            placeholder="https://example.com/logo.png"
                            className="w-full px-4 py-2.5 bg-[#18191c] border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#a3e635]"
                        />

                        {/* Live Logo Preview Box */}
                        <div className="mt-2 p-3 bg-[#18191c] rounded-xl border border-white/5 flex items-center gap-3">
                            {logoUrl.trim() ? (
                                <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-[#202227] border border-white/10 flex items-center justify-center shrink-0">
                                    <img
                                        src={logoUrl.trim()}
                                        alt="Logo preview"
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                                            const fallback = e.currentTarget.parentElement?.querySelector('.fallback-icon');
                                            if (fallback) fallback.classList.remove('hidden');
                                            const errMsg = e.currentTarget.parentElement?.parentElement?.querySelector('.logo-error-msg');
                                            if (errMsg) errMsg.classList.remove('hidden');
                                        }}
                                        onLoad={(e) => {
                                            (e.currentTarget as HTMLImageElement).style.display = 'block';
                                            const fallback = e.currentTarget.parentElement?.querySelector('.fallback-icon');
                                            if (fallback) fallback.classList.add('hidden');
                                            const errMsg = e.currentTarget.parentElement?.parentElement?.querySelector('.logo-error-msg');
                                            if (errMsg) errMsg.classList.add('hidden');
                                        }}
                                    />
                                    <div className="fallback-icon hidden w-full h-full flex items-center justify-center bg-blue-500/10 text-blue-400">
                                        <Store className="w-5 h-5" />
                                    </div>
                                </div>
                            ) : (
                                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                                    <Store className="w-5 h-5" />
                                </div>
                            )}
                            <div className="text-xs">
                                <p className="font-bold text-slate-300">
                                    {logoUrl.trim() ? 'Logo Preview' : 'Default Storefront Icon'}
                                </p>
                                <p className="text-[11px] text-slate-400">
                                    {logoUrl.trim()
                                        ? 'Your custom logo will appear in header, favicon, and social previews.'
                                        : 'No logo set. Using generic storefront icon (no platform branding).'
                                    }
                                </p>
                                <p className="logo-error-msg hidden text-[11px] text-amber-400 font-medium mt-0.5">
                                    ⚠️ Unable to load image from URL. Generic icon will be used as fallback.
                                </p>
                            </div>
                        </div>
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
