import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { api, walletService, userService, type UserActivityLog } from '@/services';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    User,
    Mail,
    Phone,
    Wallet,
    CheckCircle,
    Settings,
    HelpCircle,
    Trash2,
    Edit,
    Loader2,
    AlertTriangle,
    ExternalLink,
    Activity,
    History
} from 'lucide-react';

interface Profile {
    full_name: string;
    email: string;
    phone: string;
    wallet_balance: number;
}

export default function ProfilePage() {
    const { user, role, signOut } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();

    const [profile, setProfile] = useState<Profile>({
        full_name: '',
        email: '',
        phone: '',
        wallet_balance: 0,
    });
    const [formData, setFormData] = useState({
        full_name: '',
        email: '',
        phone: '',
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [deleting, setDeleting] = useState(false);
    const [activityLogs, setActivityLogs] = useState<UserActivityLog[]>([]);
    const [activityLoading, setActivityLoading] = useState(true);

    const fetchProfile = useCallback(async () => {
        if (!user) return;

        try {
            const [profileData, balanceData] = await Promise.all([
                api.get<{ fullName: string; email: string; phone: string }>('/users/profile'),
                walletService.getBalance(),
            ]);

            const data = {
                full_name: profileData.fullName || 'User',
                email: profileData.email || '',
                phone: profileData.phone || '',
                wallet_balance: balanceData.balance || 0,
            };
            setProfile(data);
            setFormData({
                full_name: data.full_name,
                email: data.email,
                phone: data.phone,
            });
        } catch (err) {
            console.error('Error fetching profile:', err);
            // Use user data as fallback
            const fallbackProfile = {
                full_name: user.fullName || 'User',
                email: user.email || '',
                phone: user.phone || '',
                wallet_balance: 0,
            };
            setProfile(fallbackProfile);
            setFormData({
                full_name: fallbackProfile.full_name,
                email: fallbackProfile.email,
                phone: fallbackProfile.phone,
            });
        } finally {
            setLoading(false);
        }
    }, [user]);

    const fetchActivityLogs = useCallback(async () => {
        try {
            const data = await userService.getActivityLogs();
            setActivityLogs(data);
        } catch (err) {
            console.error('Error fetching activity logs:', err);
        } finally {
            setActivityLoading(false);
        }
    }, []);

    useEffect(() => {
        if (user) {
            fetchProfile();
            fetchActivityLogs();
        }
    }, [user, fetchProfile, fetchActivityLogs]);

    const handleSave = async () => {
        if (!user) return;

        // Validation
        if (!formData.full_name.trim()) {
            toast({
                title: 'Validation Error',
                description: 'Full name is required',
                variant: 'destructive',
            });
            return;
        }

        if (!formData.phone.trim() || formData.phone.length < 10) {
            toast({
                title: 'Validation Error',
                description: 'Valid phone number is required',
                variant: 'destructive',
            });
            return;
        }

        setSaving(true);
        try {
            await api.put('/users/profile', {
                fullName: formData.full_name.trim(),
                email: formData.email.trim(),
                phone: formData.phone.trim(),
            });

            setProfile(prev => ({
                ...prev,
                full_name: formData.full_name.trim(),
                email: formData.email.trim(),
                phone: formData.phone.trim(),
            }));

            toast({
                title: 'Profile updated',
                description: 'Your profile has been saved successfully',
            });
            setIsEditing(false);
        } catch (error) {
            console.error('Update error:', error);
            toast({
                title: 'Error',
                description: 'Failed to update profile. Please try again.',
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    };

    const handleCancelEdit = () => {
        // Reset form data to current profile
        setFormData({
            full_name: profile.full_name,
            email: profile.email,
            phone: profile.phone,
        });
        setIsEditing(false);
    };

    const handleDeleteAccount = async () => {
        if (deleteConfirmText !== 'DELETE') {
            toast({
                title: 'Confirmation required',
                description: 'Please type DELETE to confirm account deletion',
                variant: 'destructive',
            });
            return;
        }

        setDeleting(true);
        try {
            // Call API to delete account (backend will handle cascade delete)
            await api.delete('/users/profile');

            // Sign out
            await signOut();

            toast({
                title: 'Account deleted',
                description: 'Your account has been permanently deleted',
            });

            // Redirect to home
            navigate('/');
        } catch (error) {
            console.error('Delete error:', error);
            toast({
                title: 'Error',
                description: 'Failed to delete account. Please contact support.',
                variant: 'destructive',
            });
        } finally {
            setDeleting(false);
            setShowDeleteDialog(false);
        }
    };

    const handleContactSupport = () => {
        // Open WhatsApp with pre-filled message
        const phoneNumber = '233XXXXXXXXX'; // Replace with actual support number
        const message = encodeURIComponent(`Hello, I need help with my ByteBeacon account. My email is ${profile.email}`);
        window.open(`https://wa.me/${phoneNumber}?text=${message}`, '_blank');
    };

    const getInitials = (name: string) => {
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    if (loading) {
        return (
            <div className="space-y-6">
                {/* Header skeleton */}
                <div className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded" />
                    <div className="space-y-1.5">
                        <Skeleton className="h-7 w-32" />
                        <Skeleton className="h-4 w-48" />
                    </div>
                </div>
                {/* Avatar card skeleton */}
                <Card>
                    <CardContent className="p-6">
                        <div className="flex flex-col sm:flex-row items-center gap-6">
                            <Skeleton className="h-24 w-24 rounded-full" />
                            <div className="space-y-2 text-center sm:text-left">
                                <Skeleton className="h-6 w-36" />
                                <Skeleton className="h-4 w-48" />
                                <Skeleton className="h-4 w-24" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                {/* Form cards skeleton */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {[0, 1].map(i => (
                        <Card key={i}>
                            <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
                            <CardContent className="space-y-4">
                                {[0, 1, 2].map(j => (
                                    <div key={j} className="space-y-2">
                                        <Skeleton className="h-4 w-24" />
                                        <Skeleton className="h-10 w-full rounded-md" />
                                    </div>
                                ))}
                                <Skeleton className="h-10 w-full rounded-md" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="font-display text-2xl md:text-3xl font-bold">My Profile</h1>
                <p className="text-muted-foreground">
                    Manage your personal information and account settings
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column - Profile Info */}
                <div className="space-y-6">
                    {/* Profile Card */}
                    <Card>
                        <CardContent className="p-6 text-center">
                            {/* Avatar */}
                            <div className="relative inline-block mb-4">
                                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white text-3xl font-bold">
                                    {getInitials(profile.full_name)}
                                </div>
                                <div className="absolute bottom-0 right-0 w-6 h-6 bg-green-500 rounded-full border-2 border-card flex items-center justify-center">
                                    <CheckCircle className="w-4 h-4 text-white" />
                                </div>
                            </div>

                            <h2 className="font-display text-xl font-bold">{profile.full_name}</h2>
                            <span className="inline-block px-3 py-1 bg-primary/20 text-primary text-xs font-semibold rounded-full mt-2 capitalize">
                                {role || 'User'}
                            </span>

                            {/* Info Items */}
                            <div className="mt-6 space-y-3 text-left">
                                <div className="flex items-center gap-3">
                                    <Mail className="w-5 h-5 text-muted-foreground" />
                                    <span className="text-sm truncate">{profile.email}</span>
                                    <CheckCircle className="w-4 h-4 text-green-500 ml-auto" />
                                </div>
                                <div className="flex items-center gap-3">
                                    <Phone className="w-5 h-5 text-muted-foreground" />
                                    <span className="text-sm">{profile.phone}</span>
                                    <CheckCircle className="w-4 h-4 text-green-500 ml-auto" />
                                </div>
                                <div className="flex items-center gap-3">
                                    <Wallet className="w-5 h-5 text-muted-foreground" />
                                    <span className="text-sm">Wallet Balance</span>
                                    <span className="text-sm font-bold text-primary ml-auto">GH₵ {profile.wallet_balance.toFixed(2)}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <User className="w-5 h-5 text-muted-foreground" />
                                    <span className="text-sm">Status</span>
                                    <span className="px-2 py-0.5 bg-green-500/20 text-green-500 text-xs font-semibold rounded ml-auto">
                                        Active
                                    </span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Referral Program - Coming Soon */}
                    <Card className="bg-muted/50 border-dashed">
                        <CardContent className="p-6 text-center">
                            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                                <User className="w-6 h-6 text-muted-foreground" />
                            </div>
                            <h3 className="font-semibold text-muted-foreground">Referral Program</h3>
                            <p className="text-sm text-muted-foreground mt-1">Coming Soon</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column - Edit Profile & Actions */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Edit Profile */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>Edit Profile</CardTitle>
                                <p className="text-sm text-muted-foreground">Update your personal details</p>
                            </div>
                            {!isEditing && (
                                <Button variant="ghost" size="icon" onClick={() => setIsEditing(true)}>
                                    <Edit className="w-4 h-4" />
                                </Button>
                            )}
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="full_name">Full Name</Label>
                                    <Input
                                        id="full_name"
                                        value={formData.full_name}
                                        onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                                        disabled={!isEditing}
                                        className="bg-muted/50"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="email">Email Address</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                                        disabled={!isEditing}
                                        className="bg-muted/50"
                                    />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <Label htmlFor="phone">Phone Number</Label>
                                    <Input
                                        id="phone"
                                        value={formData.phone}
                                        onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                                        disabled={!isEditing}
                                        className="bg-muted/50"
                                    />
                                </div>
                            </div>

                            {isEditing && (
                                <div className="flex justify-end gap-2 pt-4">
                                    <Button variant="outline" onClick={handleCancelEdit}>
                                        Cancel
                                    </Button>
                                    <Button onClick={handleSave} disabled={saving}>
                                        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                        Save Changes
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Account Verification */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Account Verification</CardTitle>
                            <p className="text-sm text-muted-foreground">Your identity is verified</p>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center gap-4 p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                                <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                                    <CheckCircle className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <p className="font-semibold">Email Address</p>
                                    <p className="text-sm text-muted-foreground">{profile.email}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                                <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                                    <CheckCircle className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <p className="font-semibold">Phone Number</p>
                                    <p className="text-sm text-muted-foreground">{profile.phone}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Account Activity Logs */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-3">
                            <div>
                                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                                    <History className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                                    Account Activity & Login History
                                </CardTitle>
                                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Recent login activities and transactions</p>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={async () => {
                                    setActivityLoading(true);
                                    await fetchActivityLogs();
                                }}
                                className="h-8 w-8 p-0"
                            >
                                <Loader2 className={cn("w-4 h-4", activityLoading && "animate-spin")} />
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {activityLoading ? (
                                <div className="space-y-3">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="flex items-center justify-between p-3 bg-muted/20 rounded-xl">
                                            <div className="flex items-center gap-3">
                                                <Skeleton className="w-8 h-8 rounded-lg" />
                                                <div className="space-y-1">
                                                    <Skeleton className="h-4 w-36" />
                                                    <Skeleton className="h-3 w-24" />
                                                </div>
                                            </div>
                                            <Skeleton className="h-3 w-16" />
                                        </div>
                                    ))}
                                </div>
                            ) : activityLogs.length === 0 ? (
                                <div className="text-center py-6 text-muted-foreground text-sm">
                                    No recent login or account activity recorded.
                                </div>
                            ) : (
                                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                                    {activityLogs.map((log) => {
                                        const action = log.action.toUpperCase();
                                        let iconColor = 'text-primary bg-primary/10';
                                        
                                        if (action.includes('LOGIN')) {
                                            iconColor = 'text-blue-500 bg-blue-500/10';
                                        } else if (action.includes('REGISTER')) {
                                            iconColor = 'text-indigo-500 bg-indigo-500/10';
                                        } else if (action.includes('PURCHASE') || action.includes('ORDER')) {
                                            iconColor = 'text-emerald-500 bg-emerald-500/10';
                                        } else if (action.includes('FUND') || action.includes('DEPOSIT')) {
                                            iconColor = 'text-yellow-500 bg-yellow-500/10';
                                        } else if (action.includes('SECURITY') || action.includes('BLOCK')) {
                                            iconColor = 'text-red-500 bg-red-500/10';
                                        }

                                        return (
                                            <div key={log.id} className="flex items-start justify-between p-3 bg-muted/40 rounded-xl hover:bg-muted transition-all border border-border/20 gap-3">
                                                <div className="flex items-start gap-3 min-w-0">
                                                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5", iconColor)}>
                                                        <Activity className="w-4 h-4" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-xs sm:text-sm font-semibold text-foreground break-words">{log.description || log.action}</p>
                                                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground/80">
                                                            <span>Action: {log.action}</span>
                                                            {log.ip_address && (
                                                                <>
                                                                    <span>•</span>
                                                                    <span>IP: {log.ip_address}</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <span className="text-[9px] sm:text-[10px] text-muted-foreground font-medium flex-shrink-0 ml-auto whitespace-nowrap mt-1">
                                                    {new Date(log.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}{' '}
                                                    {new Date(log.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Account Actions */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Account Actions</CardTitle>
                            <p className="text-sm text-muted-foreground">Manage your account preferences and settings</p>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <Link to="/dashboard/settings">
                                <button className="w-full flex items-center gap-4 p-4 rounded-lg hover:bg-muted transition-colors text-left">
                                    <Settings className="w-5 h-5 text-muted-foreground" />
                                    <div>
                                        <p className="font-medium">Edit Preferences</p>
                                        <p className="text-sm text-muted-foreground">Customize notifications, appearance, and privacy</p>
                                    </div>
                                </button>
                            </Link>
                            <button
                                onClick={handleContactSupport}
                                className="w-full flex items-center gap-4 p-4 rounded-lg hover:bg-muted transition-colors text-left"
                            >
                                <HelpCircle className="w-5 h-5 text-muted-foreground" />
                                <div className="flex-1">
                                    <p className="font-medium">Contact Support</p>
                                    <p className="text-sm text-muted-foreground">Get help via WhatsApp</p>
                                </div>
                                <ExternalLink className="w-4 h-4 text-muted-foreground" />
                            </button>
                            <button
                                onClick={() => setShowDeleteDialog(true)}
                                className="w-full flex items-center gap-4 p-4 rounded-lg hover:bg-red-500/10 transition-colors text-left border border-transparent hover:border-red-500/20"
                            >
                                <Trash2 className="w-5 h-5 text-red-500" />
                                <div>
                                    <p className="font-medium text-red-500">Delete Account</p>
                                    <p className="text-sm text-muted-foreground">Permanently remove your account</p>
                                </div>
                            </button>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Delete Account Confirmation Dialog */}
            <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-500">
                            <AlertTriangle className="w-5 h-5" />
                            Delete Account
                        </DialogTitle>
                        <DialogDescription>
                            This action cannot be undone. This will permanently delete your account and remove all your data from our servers.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                            <p className="text-sm text-red-600 dark:text-red-400">
                                <strong>Warning:</strong> All your transactions, wallet balance, and profile data will be permanently deleted.
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirm">Type <strong>DELETE</strong> to confirm</Label>
                            <Input
                                id="confirm"
                                value={deleteConfirmText}
                                onChange={(e) => setDeleteConfirmText(e.target.value.toUpperCase())}
                                placeholder="Type DELETE"
                                className="font-mono"
                            />
                        </div>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDeleteAccount}
                            disabled={deleteConfirmText !== 'DELETE' || deleting}
                        >
                            {deleting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                    Deleting...
                                </>
                            ) : (
                                'Delete Account'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
