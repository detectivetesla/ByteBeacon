import { useState, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Settings, Bell, Shield, Database, Loader2, Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { adminService } from '@/services';
import type { SourcingProvider } from '@/services/admin.service';

type SettingsTab = 'appearance' | 'notifications' | 'security' | 'system';

export default function AdminSettingsPage() {
    const { resolvedTheme, setTheme } = useTheme();
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (activeTab === 'system') {
            fetchSystemStatus();
            fetchSourcingSettings();
        }
    }, [activeTab]);

    const fetchSystemStatus = async () => {
        setFetchingSystem(true);
        try {
            const data = await adminService.getMaintenanceStatus();
            setMaintenanceMode(Boolean(data.maintenanceMode));
            setMaintenanceTitle(data.title || "We're upgrading ByteBeacon");
            setMaintenanceMessage(data.message || "A little maintenance is underway. You can still explore ByteBeacon, but account access and transactions are temporarily paused.");
            setMaintenanceEstimatedEnd(data.estimatedEnd || "");
        } catch (err) {
            console.error('Failed to fetch system status:', err);
        } finally {
            setFetchingSystem(false);
        }
    };

    const fetchSourcingSettings = async () => {
        setFetchingSourcing(true);
        try {
            const data = await adminService.getSourcingSettings();
            setSourcingApi(data.settings.active_sourcing_api || 'datahouse');
            setPortal02Key(data.settings.portal02_api_key || '');
            setDatahouseKey(data.settings.datahouse_api_key || '');
            setProviders(data.settings.providers || []);
        } catch (err) {
            console.error('Failed to fetch sourcing settings:', err);
        } finally {
            setFetchingSourcing(false);
        }
    };

    const saveSourcingSettings = async () => {
        setSavingSourcing(true);
        try {
            await adminService.updateSourcingSettings({
                active_sourcing_api: sourcingApi,
                portal02_api_key: portal02Key,
                datahouse_api_key: datahouseKey,
            });
            toast({
                title: 'Sourcing Settings Saved',
                description: `Active provider set to ${sourcingApi}.`,
            });
        } catch (err) {
            console.error('Failed to save sourcing settings:', err);
            toast({
                title: 'Error',
                description: 'Failed to save sourcing settings.',
                variant: 'destructive',
            });
        } finally {
            setSavingSourcing(false);
        }
    };

    const handleActivateProvider = async (id: string) => {
        try {
            await adminService.activateSourcingProvider(id);
            toast({ title: 'Provider Activated', description: 'The sourcing provider has been activated.' });
            fetchSourcingSettings();
        } catch (err) {
            console.error('Failed to activate provider:', err);
            toast({ title: 'Error', description: 'Failed to activate provider.', variant: 'destructive' });
        }
    };

    const handleAddProvider = async () => {
        try {
            await adminService.addSourcingProvider({
                name: newProvider.name,
                slug: newProvider.slug,
                base_url: newProvider.base_url,
                api_key: newProvider.api_key,
                config: { template: newProvider.template }
            });
            toast({ title: 'Provider Added', description: `Provider "${newProvider.name}" has been added.` });
            setNewProvider({ name: '', slug: '', base_url: '', api_key: '', template: 'datahouse' });
            setShowAddProvider(false);
            fetchSourcingSettings();
        } catch (err) {
            console.error('Failed to add provider:', err);
            toast({ title: 'Error', description: 'Failed to add provider.', variant: 'destructive' });
        }
    };

    const handleDeleteProvider = async (id: string) => {
        try {
            await adminService.deleteSourcingProvider(id);
            toast({ title: 'Provider Deleted', description: 'The sourcing provider has been removed.' });
            fetchSourcingSettings();
        } catch (err) {
            console.error('Failed to delete provider:', err);
            toast({ title: 'Error', description: 'Failed to delete provider.', variant: 'destructive' });
        }
    };

    const handleUpdateProvider = async (id: string) => {
        try {
            await adminService.updateSourcingProvider(id, {
                name: editForm.name,
                base_url: editForm.base_url,
                api_key: editForm.api_key,
                config: { template: editForm.template }
            });
            toast({ title: 'Provider Updated', description: 'The provider has been updated.' });
            setEditingProvider(null);
            fetchSourcingSettings();
        } catch (err) {
            console.error('Failed to update provider:', err);
            toast({ title: 'Error', description: 'Failed to update provider.', variant: 'destructive' });
        }
    };

    const handleTestProvider = async (id: string) => {
        setTestingProvider(id);
        try {
            const res = await adminService.testSourcingProvider(id);
            if (res.success) {
                toast({
                    title: 'Connection Successful',
                    description: `Successfully connected to provider! Wallet Balance: ${res.balance} ${res.currency || 'GHS'}`
                });
            } else {
                toast({
                    title: 'Connection Failed',
                    description: res.error || 'Check API Key and URL.',
                    variant: 'destructive'
                });
            }
        } catch (err: any) {
            console.error('Test connection error:', err);
            toast({
                title: 'Connection Failed',
                description: err?.response?.data?.error || err.message || 'Network error checking balance.',
                variant: 'destructive'
            });
        } finally {
            setTestingProvider(null);
        }
    };

    const startEditProvider = (provider: SourcingProvider) => {
        setEditingProvider(provider.id);
        setEditForm({
            name: provider.name,
            base_url: provider.base_url || '',
            api_key: provider.api_key || '',
            template: provider.config?.template || (provider.slug === 'portal02' ? 'portal02' : 'datahouse')
        });
    };

    const toggleApiKeyVisibility = (slug: string) => {
        setShowApiKeys(prev => ({ ...prev, [slug]: !prev[slug] }));
    };

    const [maintenanceMode, setMaintenanceMode] = useState(false);
    const [maintenanceTitle, setMaintenanceTitle] = useState("We're upgrading ByteBeacon");
    const [maintenanceMessage, setMaintenanceMessage] = useState("A little maintenance is underway. You can still explore ByteBeacon, but account access and transactions are temporarily paused.");
    const [maintenanceEstimatedEnd, setMaintenanceEstimatedEnd] = useState("");
    const [savingMaintenance, setSavingMaintenance] = useState(false);
    const [fetchingSystem, setFetchingSystem] = useState(false);

    const saveMaintenanceConfig = async (activeState = maintenanceMode) => {
        setSavingMaintenance(true);
        try {
            await adminService.updateMaintenanceStatus({
                isActive: activeState,
                title: maintenanceTitle,
                message: maintenanceMessage,
                estimatedEnd: maintenanceEstimatedEnd.trim() || null
            });
            setMaintenanceMode(activeState);
            toast({
                title: activeState ? 'Maintenance Mode Active' : 'Maintenance Mode Disabled',
                description: `Settings updated. System is now ${activeState ? 'in maintenance mode' : 'live'}.`,
            });
        } catch (err) {
            console.error('Failed to update maintenance settings:', err);
            toast({
                title: 'Error',
                description: 'Failed to update maintenance configuration.',
                variant: 'destructive',
            });
        } finally {
            setSavingMaintenance(false);
        }
    };

    const toggleMaintenance = async (checked: boolean) => {
        await saveMaintenanceConfig(checked);
    };

    // Sourcing settings
    const [sourcingApi, setSourcingApi] = useState('datahouse');
    const [portal02Key, setPortal02Key] = useState('');
    const [datahouseKey, setDatahouseKey] = useState('');
    const [fetchingSourcing, setFetchingSourcing] = useState(false);
    const [savingSourcing, setSavingSourcing] = useState(false);
    const [providers, setProviders] = useState<SourcingProvider[]>([]);
    const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({});
    const [showAddProvider, setShowAddProvider] = useState(false);
    const [newProvider, setNewProvider] = useState({ name: '', slug: '', base_url: '', api_key: '', template: 'datahouse' });
    const [editingProvider, setEditingProvider] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({ name: '', base_url: '', api_key: '', template: 'datahouse' });
    const [testingProvider, setTestingProvider] = useState<string | null>(null);

    const tabs = [
        { id: 'appearance', label: 'Appearance', icon: Settings },
        { id: 'notifications', label: 'Notifications', icon: Bell },
        { id: 'security', label: 'Security', icon: Shield },
        { id: 'system', label: 'System', icon: Database },
    ] as const;

    const handleSave = async () => {
        setSaving(true);

        // Simulate save
        await new Promise(resolve => setTimeout(resolve, 1000));

        if (activeTab === 'appearance') {
            if (appearanceSettings.theme !== 'auto') {
                setTheme(appearanceSettings.theme as 'light' | 'dark');
            }
        }

        setSaving(false);
        toast({
            title: 'Settings Saved',
            description: 'Your settings have been updated successfully.',
        });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-foreground">Settings</h1>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 flex-wrap">
                {tabs.map((tab) => (
                    <Button
                        key={tab.id}
                        variant={activeTab === tab.id ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                            activeTab === tab.id
                                ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                                : 'border-border text-muted-foreground hover:bg-accent'
                        )}
                    >
                        {tab.label}
                    </Button>
                ))}
            </div>

            {/* Content */}
            <Card className="bg-card border-border">
                <CardHeader>
                    <CardTitle className="text-foreground">
                        {activeTab === 'appearance' && 'Appearance Settings'}
                        {activeTab === 'notifications' && 'Notification Settings'}
                        {activeTab === 'security' && 'Security Settings'}
                        {activeTab === 'system' && 'System Settings'}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Appearance Tab */}
                    {activeTab === 'appearance' && (
                        <>
                            <div className="space-y-2">
                                <Label className="text-foreground">Theme</Label>
                                <Select value={appearanceSettings.theme} onValueChange={(value) => setAppearanceSettings({ ...appearanceSettings, theme: value })}>
                                    <SelectTrigger className="w-full bg-accent/50 border-border text-foreground">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-popover border-border">
                                        <SelectItem value="auto" className="hover:bg-accent focus:bg-accent">Auto (System Default)</SelectItem>
                                        <SelectItem value="light" className="hover:bg-accent focus:bg-accent">Light</SelectItem>
                                        <SelectItem value="dark" className="hover:bg-accent focus:bg-accent">Dark</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-foreground">Primary Color</Label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="color"
                                        value={appearanceSettings.primaryColor}
                                        onChange={(e) => setAppearanceSettings({ ...appearanceSettings, primaryColor: e.target.value })}
                                        className="w-12 h-10 rounded border-0 cursor-pointer"
                                    />
                                    <span className="text-muted-foreground text-sm">{appearanceSettings.primaryColor}</span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-foreground">Sidebar Position</Label>
                                <Select value={appearanceSettings.sidebarPosition} onValueChange={(value) => setAppearanceSettings({ ...appearanceSettings, sidebarPosition: value })}>
                                    <SelectTrigger className="w-full bg-accent/50 border-border text-foreground">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-popover border-border">
                                        <SelectItem value="left" className="hover:bg-accent focus:bg-accent">Left</SelectItem>
                                        <SelectItem value="right" className="hover:bg-accent focus:bg-accent">Right</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex items-center justify-between">
                                <div>
                                    <Label className="text-foreground">Compact Sidebar</Label>
                                    <p className="text-sm text-muted-foreground">Use a smaller sidebar</p>
                                </div>
                                <Switch
                                    checked={appearanceSettings.compactSidebar}
                                    onCheckedChange={(checked) => setAppearanceSettings({ ...appearanceSettings, compactSidebar: checked })}
                                />
                            </div>
                        </>
                    )}

                    {/* Notifications Tab */}
                    {activeTab === 'notifications' && (
                        <>
                            <div className="flex items-center justify-between py-2">
                                <div>
                                    <Label className="text-foreground">Email Notifications</Label>
                                    <p className="text-sm text-muted-foreground">Receive email alerts</p>
                                </div>
                                <Switch
                                    checked={notificationSettings.emailNotifications}
                                    onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, emailNotifications: checked })}
                                />
                            </div>

                            <div className="flex items-center justify-between py-2">
                                <div>
                                    <Label className="text-foreground">Order Alerts</Label>
                                    <p className="text-sm text-muted-foreground">Get notified for new orders</p>
                                </div>
                                <Switch
                                    checked={notificationSettings.orderAlerts}
                                    onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, orderAlerts: checked })}
                                />
                            </div>

                            <div className="flex items-center justify-between py-2">
                                <div>
                                    <Label className="text-foreground">User Registrations</Label>
                                    <p className="text-sm text-muted-foreground">Alert when new users register</p>
                                </div>
                                <Switch
                                    checked={notificationSettings.userRegistrations}
                                    onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, userRegistrations: checked })}
                                />
                            </div>

                            <div className="flex items-center justify-between py-2">
                                <div>
                                    <Label className="text-foreground">System Alerts</Label>
                                    <p className="text-sm text-muted-foreground">Critical system notifications</p>
                                </div>
                                <Switch
                                    checked={notificationSettings.systemAlerts}
                                    onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, systemAlerts: checked })}
                                />
                            </div>

                            <div className="flex items-center justify-between py-2">
                                <div>
                                    <Label className="text-foreground">Daily Reports</Label>
                                    <p className="text-sm text-muted-foreground">Receive daily summary emails</p>
                                </div>
                                <Switch
                                    checked={notificationSettings.dailyReports}
                                    onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, dailyReports: checked })}
                                />
                            </div>
                        </>
                    )}

                    {/* Security Tab */}
                    {activeTab === 'security' && (
                        <>
                            <div className="flex items-center justify-between py-2">
                                <div>
                                    <Label className="text-foreground">Two-Factor Authentication</Label>
                                    <p className="text-sm text-muted-foreground">Add extra security to your account</p>
                                </div>
                                <Switch
                                    checked={securitySettings.twoFactorAuth}
                                    onCheckedChange={(checked) => setSecuritySettings({ ...securitySettings, twoFactorAuth: checked })}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-foreground">Session Timeout (minutes)</Label>
                                <Input
                                    type="number"
                                    value={securitySettings.sessionTimeout}
                                    onChange={(e) => setSecuritySettings({ ...securitySettings, sessionTimeout: e.target.value })}
                                    className="bg-accent/50 border-border text-foreground"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-foreground">IP Whitelist</Label>
                                <p className="text-sm text-muted-foreground mb-2">Enter IPs separated by commas</p>
                                <Input
                                    placeholder="e.g., 192.168.1.1, 10.0.0.1"
                                    value={securitySettings.ipWhitelist}
                                    onChange={(e) => setSecuritySettings({ ...securitySettings, ipWhitelist: e.target.value })}
                                    className="bg-accent/50 border-border text-foreground placeholder:text-muted-foreground"
                                />
                            </div>
                        </>
                    )}

                    {/* System Tab */}
                    {activeTab === 'system' && (
                        <>
                            {/* Sourcing API Configuration */}
                            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg space-y-5">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <Label className="text-emerald-400 font-bold text-base">Sourcing API Configuration</Label>
                                        <p className="text-sm text-emerald-400/70 mt-1">Manage providers used for fulfilling data orders</p>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setShowAddProvider(!showAddProvider)}
                                        className="border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10"
                                    >
                                        <Plus className="w-4 h-4 mr-1" />
                                        Add Provider
                                    </Button>
                                </div>

                                {/* Add Provider Form */}
                                {showAddProvider && (
                                    <div className="p-4 bg-accent/30 border border-border rounded-lg space-y-3">
                                        <Label className="text-foreground font-semibold">New Custom Provider</Label>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <Label className="text-xs text-muted-foreground">Name</Label>
                                                <Input
                                                    value={newProvider.name}
                                                    onChange={(e) => setNewProvider({ ...newProvider, name: e.target.value })}
                                                    placeholder="My Provider"
                                                    className="bg-accent/50 border-border text-foreground placeholder:text-muted-foreground"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs text-muted-foreground">Slug</Label>
                                                <Input
                                                    value={newProvider.slug}
                                                    onChange={(e) => setNewProvider({ ...newProvider, slug: e.target.value })}
                                                    placeholder="my-provider"
                                                    className="bg-accent/50 border-border text-foreground placeholder:text-muted-foreground font-mono"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs text-muted-foreground">Base URL</Label>
                                                <Input
                                                    value={newProvider.base_url}
                                                    onChange={(e) => setNewProvider({ ...newProvider, base_url: e.target.value })}
                                                    placeholder="https://api.example.com"
                                                    className="bg-accent/50 border-border text-foreground placeholder:text-muted-foreground font-mono"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs text-muted-foreground">API Key</Label>
                                                <Input
                                                    value={newProvider.api_key}
                                                    onChange={(e) => setNewProvider({ ...newProvider, api_key: e.target.value })}
                                                    placeholder="api_key_..."
                                                    className="bg-accent/50 border-border text-foreground placeholder:text-muted-foreground font-mono"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs text-muted-foreground">API Template Format</Label>
                                                <select
                                                    value={newProvider.template}
                                                    onChange={(e) => setNewProvider({ ...newProvider, template: e.target.value })}
                                                    className="w-full h-10 px-3 rounded-md bg-accent/50 border border-border text-foreground text-sm"
                                                >
                                                    <option value="datahouse" className="bg-popover text-foreground">Datahouse (GetMorePayLess)</option>
                                                    <option value="portal02" className="bg-popover text-foreground">Portal-02</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 pt-1">
                                            <Button
                                                size="sm"
                                                onClick={handleAddProvider}
                                                disabled={!newProvider.name || !newProvider.slug}
                                                className="bg-emerald-500 hover:bg-emerald-600 text-white"
                                            >
                                                Add Provider
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => setShowAddProvider(false)}
                                                className="border-border text-muted-foreground hover:bg-accent"
                                            >
                                                Cancel
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {/* Provider List */}
                                {fetchingSourcing ? (
                                    <div className="flex items-center justify-center py-8">
                                        <Loader2 className="w-5 h-5 animate-spin text-emerald-400 mr-2" />
                                        <span className="text-muted-foreground">Loading providers...</span>
                                    </div>
                                ) : providers.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-4">No providers configured yet.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {providers.map((provider) => (
                                            <div
                                                key={provider.id}
                                                className={cn(
                                                    'p-4 rounded-lg border transition-all',
                                                    provider.is_active
                                                        ? 'bg-emerald-500/10 border-emerald-500/30'
                                                        : 'bg-accent/20 border-border'
                                                )}
                                            >
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="flex-1 min-w-0 space-y-2">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="font-semibold text-foreground">{provider.name}</span>
                                                            <span className={cn(
                                                                'text-[10px] font-bold uppercase px-1.5 py-0.5 rounded',
                                                                provider.provider_type === 'builtin'
                                                                    ? 'bg-blue-500/20 text-blue-400'
                                                                    : 'bg-purple-500/20 text-purple-400'
                                                            )}>
                                                                {provider.provider_type}
                                                            </span>
                                                            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
                                                                Format: {provider.config?.template || (provider.slug === 'portal02' ? 'portal02' : 'datahouse')}
                                                            </span>
                                                            {provider.is_active && (
                                                                <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                                                                    Active
                                                                </span>
                                                            )}
                                                        </div>

                                                        {editingProvider === provider.id ? (
                                                            <div className="p-3 bg-accent/30 border border-border rounded-lg space-y-3 mt-3">
                                                                <Label className="text-xs font-semibold text-foreground">Edit Provider Details</Label>
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                                    <div className="space-y-1">
                                                                        <Label className="text-xs text-muted-foreground">Name</Label>
                                                                        <Input
                                                                            value={editForm.name}
                                                                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                                                            placeholder="Provider Name"
                                                                            className="bg-accent/50 border-border text-foreground text-xs h-8"
                                                                        />
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <Label className="text-xs text-muted-foreground">Base URL</Label>
                                                                        <Input
                                                                            value={editForm.base_url}
                                                                            onChange={(e) => setEditForm({ ...editForm, base_url: e.target.value })}
                                                                            placeholder="https://..."
                                                                            className="bg-accent/50 border-border text-foreground text-xs font-mono h-8"
                                                                        />
                                                                    </div>
                                                                    <div className="space-y-1 col-span-1 sm:col-span-2">
                                                                        <Label className="text-xs text-muted-foreground">API Key</Label>
                                                                        <Input
                                                                            value={editForm.api_key}
                                                                            onChange={(e) => setEditForm({ ...editForm, api_key: e.target.value })}
                                                                            placeholder="Key"
                                                                            className="bg-accent/50 border-border text-foreground text-xs font-mono h-8"
                                                                        />
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <Label className="text-xs text-muted-foreground">API Template Format</Label>
                                                                        <select
                                                                            value={editForm.template}
                                                                            onChange={(e) => setEditForm({ ...editForm, template: e.target.value })}
                                                                            className="w-full h-8 px-2 rounded-md bg-accent/50 border border-border text-foreground text-xs"
                                                                        >
                                                                            <option value="datahouse" className="bg-popover text-foreground">Datahouse (GetMorePayLess)</option>
                                                                            <option value="portal02" className="bg-popover text-foreground">Portal-02</option>
                                                                        </select>
                                                                    </div>
                                                                </div>
                                                                <div className="flex gap-2 pt-1">
                                                                    <Button
                                                                        size="sm"
                                                                        onClick={() => handleUpdateProvider(provider.id)}
                                                                        className="h-7 text-xs bg-emerald-500 hover:bg-emerald-600 text-white"
                                                                    >
                                                                        Save
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        onClick={() => setEditingProvider(null)}
                                                                        className="h-7 text-xs border-border text-muted-foreground hover:bg-accent"
                                                                    >
                                                                        Cancel
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                                                                <div>
                                                                    <span className="text-muted-foreground">Slug: </span>
                                                                    <span className="text-foreground font-mono text-xs">{provider.slug}</span>
                                                                </div>
                                                                {provider.base_url && (
                                                                    <div className="truncate">
                                                                        <span className="text-muted-foreground">URL: </span>
                                                                        <span className="text-foreground font-mono text-xs">{provider.base_url}</span>
                                                                    </div>
                                                                )}
                                                                <div className="flex items-center gap-1.5 sm:col-span-2">
                                                                    <span className="text-muted-foreground">API Key: </span>
                                                                    <span className="text-foreground font-mono text-xs">
                                                                        {showApiKeys[provider.slug]
                                                                            ? (provider.api_key || '—')
                                                                            : (provider.api_key ? '••••••••••••' : '—')}
                                                                    </span>
                                                                    {provider.api_key && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => toggleApiKeyVisibility(provider.slug)}
                                                                            className="text-muted-foreground hover:text-foreground transition-colors"
                                                                            title={showApiKeys[provider.slug] ? 'Hide API key' : 'Show API key'}
                                                                        >
                                                                            {showApiKeys[provider.slug]
                                                                                ? <EyeOff className="w-3.5 h-3.5" />
                                                                                : <Eye className="w-3.5 h-3.5" />}
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap sm:flex-nowrap">
                                                        {!provider.is_active && (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => handleActivateProvider(provider.id)}
                                                                className="h-7 text-xs border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10"
                                                            >
                                                                Activate
                                                            </Button>
                                                        )}
                                                        {editingProvider !== provider.id && (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => startEditProvider(provider)}
                                                                className="h-7 text-xs border-border text-muted-foreground hover:bg-accent"
                                                            >
                                                                Edit
                                                            </Button>
                                                        )}
                                                        {editingProvider !== provider.id && (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => handleTestProvider(provider.id)}
                                                                disabled={testingProvider === provider.id}
                                                                className="h-7 text-xs border-blue-500/50 text-blue-400 hover:bg-blue-500/10 disabled:opacity-50"
                                                            >
                                                                {testingProvider === provider.id ? (
                                                                    <>
                                                                        <Loader2 className="w-3 h-3 animate-spin mr-1" />
                                                                        Testing...
                                                                    </>
                                                                ) : (
                                                                    'Test'
                                                                )}
                                                            </Button>
                                                        )}
                                                        {provider.provider_type === 'custom' && (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => handleDeleteProvider(provider.id)}
                                                                disabled={provider.is_active}
                                                                className="h-7 text-xs border-red-500/50 text-red-400 hover:bg-red-500/10 disabled:opacity-40"
                                                                title={provider.is_active ? 'Cannot delete active provider' : 'Delete provider'}
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Legacy Save Button */}
                                <div className="pt-2 border-t border-border/50">
                                    <div className="space-y-3">
                                        <Label className="text-muted-foreground text-xs uppercase tracking-wide">Legacy API Key Overrides</Label>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <Label className="text-xs text-muted-foreground">Portal-02 Key</Label>
                                                <Input
                                                    type="password"
                                                    value={portal02Key}
                                                    onChange={(e) => setPortal02Key(e.target.value)}
                                                    placeholder="dk_..."
                                                    className="bg-accent/50 border-border text-foreground placeholder:text-muted-foreground font-mono"
                                                    disabled={fetchingSourcing}
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs text-muted-foreground">GetMorePayLess Key</Label>
                                                <Input
                                                    type="password"
                                                    value={datahouseKey}
                                                    onChange={(e) => setDatahouseKey(e.target.value)}
                                                    placeholder="ak_live_..."
                                                    className="bg-accent/50 border-border text-foreground placeholder:text-muted-foreground font-mono"
                                                    disabled={fetchingSourcing}
                                                />
                                            </div>
                                        </div>
                                        <Button
                                            onClick={saveSourcingSettings}
                                            disabled={savingSourcing || fetchingSourcing}
                                            size="sm"
                                            className="bg-emerald-500 hover:bg-emerald-600 text-white"
                                        >
                                            {savingSourcing ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                                    Saving...
                                                </>
                                            ) : (
                                                'Save Settings'
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-foreground">Database Status</Label>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                                    <span className="text-muted-foreground">Connected</span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-foreground">API Status</Label>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                                    <span className="text-muted-foreground">Operational</span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-foreground">System Version</Label>
                                <p className="text-muted-foreground">v1.0.0</p>
                            </div>

                            <div className="pt-4 space-y-4">
                                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <Label className="text-amber-500 dark:text-amber-400 font-bold text-base">Maintenance Mode</Label>
                                            <p className="text-xs text-muted-foreground">Pause customer transactions & account access while keeping public catalog and landing page visible</p>
                                        </div>
                                        <Switch
                                            disabled={fetchingSystem || savingMaintenance}
                                            checked={maintenanceMode}
                                            onCheckedChange={toggleMaintenance}
                                            className="data-[state=checked]:bg-amber-500"
                                        />
                                    </div>

                                    {maintenanceMode && (
                                        <div className="space-y-3 pt-2 border-t border-amber-500/20 animate-fade-in">
                                            <div className="space-y-1">
                                                <Label className="text-xs font-semibold text-foreground">Notice Headline</Label>
                                                <Input
                                                    value={maintenanceTitle}
                                                    onChange={(e) => setMaintenanceTitle(e.target.value)}
                                                    placeholder="We're upgrading ByteBeacon"
                                                    className="bg-card border-border text-xs"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs font-semibold text-foreground">Customer Message</Label>
                                                <Input
                                                    value={maintenanceMessage}
                                                    onChange={(e) => setMaintenanceMessage(e.target.value)}
                                                    placeholder="A little maintenance is underway. You can still explore ByteBeacon..."
                                                    className="bg-card border-border text-xs"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs font-semibold text-foreground">Estimated Return Time (Optional)</Label>
                                                <Input
                                                    value={maintenanceEstimatedEnd}
                                                    onChange={(e) => setMaintenanceEstimatedEnd(e.target.value)}
                                                    placeholder="e.g. 02:30 AM or Within 45 minutes"
                                                    className="bg-card border-border text-xs"
                                                />
                                            </div>
                                            <Button
                                                size="sm"
                                                onClick={() => saveMaintenanceConfig(true)}
                                                disabled={savingMaintenance}
                                                className="bg-amber-500 hover:bg-amber-600 text-black font-semibold text-xs h-8"
                                            >
                                                {savingMaintenance ? (
                                                    <>
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                                                        Saving...
                                                    </>
                                                ) : (
                                                    'Save Maintenance Notice'
                                                )}
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}

                    {/* Save Button */}
                    {activeTab !== 'system' && (
                        <div className="pt-4">
                            <Button
                                onClick={handleSave}
                                disabled={saving}
                                className="bg-emerald-500 hover:bg-emerald-600 text-white"
                            >
                                {saving ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                        Saving...
                                    </>
                                ) : (
                                    `Save ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`
                                )}
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
