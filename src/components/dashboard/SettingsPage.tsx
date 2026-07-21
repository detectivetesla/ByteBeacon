import { useState, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { authService } from '@/services';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Settings as SettingsIcon,
    Sun,
    Bell,
    Lock,
    Shield,
    Mail,
    Smartphone,
    Eye,
    Share2,
    Trash2,
    Save,
    Loader2
} from 'lucide-react';

type SettingsSection = 'appearance' | 'notifications' | 'privacy' | 'security';

interface NotificationSettings {
    email: {
        marketing: boolean;
        alerts: boolean;
        transactions: boolean;
        orderUpdates: boolean;
        announcements: boolean;
    };
    push: {
        marketing: boolean;
        alerts: boolean;
        transactions: boolean;
        orderUpdates: boolean;
        announcements: boolean;
    };
}

interface PrivacySettings {
    profileDiscovery: boolean;
    shareDataWithPartners: boolean;
}

export default function SettingsPage() {
    const { theme, setTheme } = useTheme();
    const { user, signOut } = useAuth();
    const { toast } = useToast();

    const [activeSection, setActiveSection] = useState<SettingsSection>('appearance');
    const [fontSize, setFontSize] = useState('medium');
    const [notifications, setNotifications] = useState<NotificationSettings>({
        email: {
            marketing: true,
            alerts: false,
            transactions: false,
            orderUpdates: false,
            announcements: false,
        },
        push: {
            marketing: true,
            alerts: true,
            transactions: true,
            orderUpdates: true,
            announcements: true,
        },
    });
    const [privacy, setPrivacy] = useState<PrivacySettings>({
        profileDiscovery: true,
        shareDataWithPartners: false,
    });
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
    const [saving, setSaving] = useState(false);

    const sections = [
        { id: 'appearance', label: 'Appearance', icon: Sun },
        { id: 'notifications', label: 'Notifications', icon: Bell },
        { id: 'privacy', label: 'Privacy', icon: Lock },
        { id: 'security', label: 'Security', icon: Shield },
    ];

    const handleSaveSettings = async () => {
        setSaving(true);
        // Simulate saving
        await new Promise(resolve => setTimeout(resolve, 1000));
        toast({
            title: 'Settings saved',
            description: 'Your preferences have been updated',
        });
        setSaving(false);
    };

    const handleChangePassword = async () => {
        if (passwords.new !== passwords.confirm) {
            toast({
                title: 'Error',
                description: 'New passwords do not match',
                variant: 'destructive',
            });
            return;
        }

        if (passwords.new.length < 8) {
            toast({
                title: 'Error',
                description: 'Password must be at least 8 characters',
                variant: 'destructive',
            });
            return;
        }

        setSaving(true);
        try {
            await authService.changePassword(passwords.current, passwords.new);

            toast({
                title: 'Password updated',
                description: 'Your password has been changed successfully',
            });
            setShowPasswordModal(false);
            setPasswords({ current: '', new: '', confirm: '' });
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to update password',
                variant: 'destructive',
            });
        }
        setSaving(false);
    };

    const handleDeleteAccount = async () => {
        toast({
            title: 'Contact support',
            description: 'Please contact support to delete your account',
        });
        setShowDeleteModal(false);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <SettingsIcon className="w-8 h-8 text-muted-foreground" />
                <div>
                    <h1 className="font-display text-2xl md:text-3xl font-bold">Settings</h1>
                    <p className="text-muted-foreground">
                        Customize your experience and manage your preferences
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Quick Navigation */}
                <Card className="lg:col-span-1 h-fit">
                    <CardHeader>
                        <CardTitle className="text-sm text-muted-foreground uppercase">Quick Navigation</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1">
                        {sections.map((section) => (
                            <button
                                key={section.id}
                                onClick={() => setActiveSection(section.id as SettingsSection)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${activeSection === section.id
                                    ? 'bg-primary/10 text-primary'
                                    : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                                    }`}
                            >
                                <section.icon className="w-5 h-5" />
                                <span className="font-medium">{section.label}</span>
                            </button>
                        ))}
                    </CardContent>
                </Card>

                {/* Settings Content */}
                <div className="lg:col-span-3 space-y-6">
                    {/* Appearance */}
                    {activeSection === 'appearance' && (
                        <Card>
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                                        <Sun className="w-5 h-5 text-orange-500" />
                                    </div>
                                    <div>
                                        <CardTitle>Appearance</CardTitle>
                                        <p className="text-sm text-muted-foreground">Customize how the app looks and feels</p>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {/* Theme */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <Sun className="w-5 h-5 text-muted-foreground" />
                                        <span className="font-medium">Theme</span>
                                    </div>
                                    <div className="flex rounded-lg border border-border overflow-hidden">
                                        <button
                                            onClick={() => setTheme('light')}
                                            className={`px-3 sm:px-4 py-2 text-xs sm:text-sm flex-1 sm:flex-none ${theme === 'light' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
                                        >
                                            Light
                                        </button>
                                        <button
                                            onClick={() => setTheme('system')}
                                            className={`px-3 sm:px-4 py-2 text-xs sm:text-sm flex-1 sm:flex-none ${theme === 'system' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
                                        >
                                            System
                                        </button>
                                        <button
                                            onClick={() => setTheme('dark')}
                                            className={`px-3 sm:px-4 py-2 text-xs sm:text-sm flex-1 sm:flex-none ${theme === 'dark' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
                                        >
                                            Dark
                                        </button>
                                    </div>
                                </div>

                                {/* Font Size */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <span className="w-5 h-5 flex items-center justify-center text-muted-foreground font-bold">A</span>
                                        <span className="font-medium">Font Size</span>
                                    </div>
                                    <Select value={fontSize} onValueChange={(value) => setFontSize(value)}>
                                        <SelectTrigger className="w-full sm:w-32 bg-background border-border">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-popover border-border">
                                            <SelectItem value="small" className="hover:bg-accent focus:bg-accent">Small</SelectItem>
                                            <SelectItem value="medium" className="hover:bg-accent focus:bg-accent">Medium</SelectItem>
                                            <SelectItem value="large" className="hover:bg-accent focus:bg-accent">Large</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Notifications */}
                    {activeSection === 'notifications' && (
                        <Card>
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                                        <Bell className="w-5 h-5 text-yellow-500" />
                                    </div>
                                    <div>
                                        <CardTitle>Notifications</CardTitle>
                                        <p className="text-sm text-muted-foreground">Control how and when you receive alerts</p>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {/* Email */}
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 mb-4">
                                            <Mail className="w-5 h-5 text-red-500" />
                                            <span className="font-semibold">Email</span>
                                        </div>
                                        {Object.entries(notifications.email).map(([key, value]) => (
                                            <div key={key} className="flex items-center justify-between">
                                                <span className="capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                                                <Switch
                                                    checked={value}
                                                    onCheckedChange={(checked) =>
                                                        setNotifications(prev => ({
                                                            ...prev,
                                                            email: { ...prev.email, [key]: checked }
                                                        }))
                                                    }
                                                />
                                            </div>
                                        ))}
                                    </div>

                                    {/* Push */}
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 mb-4">
                                            <Smartphone className="w-5 h-5 text-primary" />
                                            <span className="font-semibold">Push</span>
                                        </div>
                                        {Object.entries(notifications.push).map(([key, value]) => (
                                            <div key={key} className="flex items-center justify-between">
                                                <span className="capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                                                <Switch
                                                    checked={value}
                                                    onCheckedChange={(checked) =>
                                                        setNotifications(prev => ({
                                                            ...prev,
                                                            push: { ...prev.push, [key]: checked }
                                                        }))
                                                    }
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Privacy */}
                    {activeSection === 'privacy' && (
                        <Card>
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                                        <Lock className="w-5 h-5 text-green-500" />
                                    </div>
                                    <div>
                                        <CardTitle>Privacy</CardTitle>
                                        <p className="text-sm text-muted-foreground">Manage what data is shared and who can see you</p>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <Eye className="w-5 h-5 text-muted-foreground" />
                                        <span className="font-medium text-sm sm:text-base">Allow Profile Discovery</span>
                                    </div>
                                    <Switch
                                        checked={privacy.profileDiscovery}
                                        onCheckedChange={(checked) => setPrivacy(prev => ({ ...prev, profileDiscovery: checked }))}
                                    />
                                </div>
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <Share2 className="w-5 h-5 text-muted-foreground" />
                                        <span className="font-medium text-sm sm:text-base">Share Data With Partners</span>
                                    </div>
                                    <Switch
                                        checked={privacy.shareDataWithPartners}
                                        onCheckedChange={(checked) => setPrivacy(prev => ({ ...prev, shareDataWithPartners: checked }))}
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Security */}
                    {activeSection === 'security' && (
                        <Card>
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                                        <Shield className="w-5 h-5 text-red-500" />
                                    </div>
                                    <div>
                                        <CardTitle>Security</CardTitle>
                                        <p className="text-sm text-muted-foreground">Manage your account security settings</p>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Change Password */}
                                    <div className="bg-muted/50 rounded-lg p-4">
                                        <h4 className="font-semibold mb-2">Change Password</h4>
                                        <p className="text-sm text-muted-foreground mb-4">
                                            Update your password to keep your account secure
                                        </p>
                                        <Button
                                            variant="outline"
                                            className="gap-2"
                                            onClick={() => setShowPasswordModal(true)}
                                        >
                                            <Lock className="w-4 h-4" />
                                            Change Password
                                        </Button>
                                    </div>

                                    {/* Delete Account */}
                                    <div className="bg-red-500/10 rounded-lg p-4 border border-red-500/20">
                                        <h4 className="font-semibold text-red-500 mb-2">Delete Account</h4>
                                        <p className="text-sm text-muted-foreground mb-4">
                                            Permanently delete your account and all data
                                        </p>
                                        <Button
                                            variant="destructive"
                                            className="gap-2"
                                            onClick={() => setShowDeleteModal(true)}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                            Delete Account
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Save Button */}
                    <div className="flex justify-end">
                        <Button onClick={handleSaveSettings} disabled={saving} className="gap-2">
                            {saving ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Save className="w-4 h-4" />
                            )}
                            Save Changes
                        </Button>
                    </div>
                </div>
            </div>

            {/* Change Password Modal */}
            <Dialog open={showPasswordModal} onOpenChange={setShowPasswordModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Change Password</DialogTitle>
                        <DialogDescription>Enter your current password and a new password</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="current">Current Password</Label>
                            <Input
                                id="current"
                                type="password"
                                value={passwords.current}
                                onChange={(e) => setPasswords(prev => ({ ...prev, current: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="new">New Password</Label>
                            <Input
                                id="new"
                                type="password"
                                value={passwords.new}
                                onChange={(e) => setPasswords(prev => ({ ...prev, new: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirm">Confirm New Password</Label>
                            <Input
                                id="confirm"
                                type="password"
                                value={passwords.confirm}
                                onChange={(e) => setPasswords(prev => ({ ...prev, confirm: e.target.value }))}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowPasswordModal(false)}>Cancel</Button>
                        <Button onClick={handleChangePassword} disabled={saving}>
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update Password'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Account Modal */}
            <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="text-red-500">Delete Account</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete your account? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleDeleteAccount}>Delete Account</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
