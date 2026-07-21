import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, authService } from '@/services';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
    User,
    Mail,
    Phone,
    Lock,
    Camera,
    Loader2,
    Shield,
    Calendar,
    Save
} from 'lucide-react';

interface AdminProfile {
    id: string;
    full_name: string;
    email: string;
    phone: string;
    avatar_url: string | null;
    created_at: string;
}

export default function AdminProfilePage() {
    const { user, signOut } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();

    const [profile, setProfile] = useState<AdminProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [changingPassword, setChangingPassword] = useState(false);

    const [form, setForm] = useState({
        full_name: '',
        email: '',
        phone: '',
    });

    const [passwordForm, setPasswordForm] = useState({
        current_password: '',
        new_password: '',
        confirm_password: '',
    });

    const fetchProfile = useCallback(async () => {
        if (!user) return;

        setLoading(true);
        try {
            const data = await api.get<{
                id: string;
                fullName: string;
                email: string;
                phone: string;
                createdAt: string;
            }>('/users/profile');

            setProfile({
                id: data.id,
                full_name: data.fullName || '',
                email: data.email || user.email || '',
                phone: data.phone || '',
                avatar_url: null,
                created_at: data.createdAt || '',
            });

            setForm({
                full_name: data.fullName || '',
                email: data.email || user.email || '',
                phone: data.phone || '',
            });
        } catch (err) {
            console.error('Error fetching profile:', err);
            toast({ title: 'Error', description: 'Failed to load profile', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    }, [user, toast]);

    useEffect(() => {
        if (user) fetchProfile();
    }, [user, fetchProfile]);

    const handleSaveProfile = async () => {
        if (!user) return;

        setSaving(true);
        try {
            await api.put('/users/profile', {
                fullName: form.full_name,
                phone: form.phone,
            });

            toast({ title: 'Success', description: 'Profile updated successfully' });
            fetchProfile();
        } catch (err) {
            console.error('Error updating profile:', err);
            toast({ title: 'Error', description: 'Failed to update profile', variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    const handleChangePassword = async () => {
        if (passwordForm.new_password !== passwordForm.confirm_password) {
            toast({ title: 'Error', description: 'Passwords do not match', variant: 'destructive' });
            return;
        }

        if (passwordForm.new_password.length < 6) {
            toast({ title: 'Error', description: 'Password must be at least 6 characters', variant: 'destructive' });
            return;
        }

        setChangingPassword(true);
        try {
            await authService.changePassword(passwordForm.current_password, passwordForm.new_password);

            toast({ title: 'Success', description: 'Password changed successfully' });
            setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
        } catch (err: unknown) {
            console.error('Error changing password:', err);
            const message = err instanceof Error ? err.message : 'Failed to change password';
            toast({ title: 'Error', description: message, variant: 'destructive' });
        } finally {
            setChangingPassword(false);
        }
    };

    const handleLogout = async () => {
        await signOut();
        navigate('/admin/login');
    };

    const getInitials = (name: string) => {
        if (!name || typeof name !== 'string') return 'AD';
        return name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'AD';
    };

    if (loading) {
        return (
            <div className="space-y-6 max-w-4xl mx-auto">
                <div className="flex items-center gap-3"><Skeleton className="h-8 w-8 rounded" /><div className="space-y-1"><Skeleton className="h-6 w-28" /><Skeleton className="h-4 w-40" /></div></div>
                <Card className="bg-[#1e293b] border-slate-700/50">
                    <CardContent className="p-6">
                        <div className="flex flex-col sm:flex-row items-center gap-6">
                            <Skeleton className="h-24 w-24 rounded-full bg-slate-700" />
                            <div className="space-y-2"><Skeleton className="h-6 w-36 bg-slate-700" /><Skeleton className="h-4 w-48 bg-slate-700" /><Skeleton className="h-5 w-20 rounded-full bg-slate-700" /></div>
                        </div>
                    </CardContent>
                </Card>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {[0,1].map(i => (
                        <Card key={i} className="bg-[#1e293b] border-slate-700/50">
                            <CardHeader><Skeleton className="h-5 w-32 bg-slate-700" /></CardHeader>
                            <CardContent className="space-y-4">
                                {[0,1,2].map(j => (<div key={j} className="space-y-2"><Skeleton className="h-4 w-24 bg-slate-700" /><Skeleton className="h-10 w-full rounded-md bg-slate-700" /></div>))}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3">
                <User className="w-8 h-8 text-slate-400" />
                <div>
                    <h1 className="text-2xl font-bold text-white">Admin Profile</h1>
                    <p className="text-slate-400">Manage your account settings</p>
                </div>
            </div>

            {/* Profile Card */}
            <Card className="bg-[#1e293b] border-slate-700/50">
                <CardContent className="p-6">
                    <div className="flex flex-col sm:flex-row items-center gap-6">
                        {/* Avatar */}
                        <div className="relative">
                            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white text-3xl font-bold">
                                {profile?.avatar_url ? (
                                    <img src={profile.avatar_url} alt="Avatar" className="w-full h-full rounded-full object-cover" />
                                ) : (
                                    getInitials(profile?.full_name || '')
                                )}
                            </div>
                            <button className="absolute bottom-0 right-0 w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center text-white hover:bg-emerald-600 transition-colors">
                                <Camera className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Info */}
                        <div className="text-center sm:text-left">
                            <h2 className="text-xl font-bold text-white">{profile?.full_name}</h2>
                            <p className="text-slate-400">{profile?.email}</p>
                            <div className="flex items-center gap-2 mt-2">
                                <Shield className="w-4 h-4 text-purple-400" />
                                <span className="text-sm text-purple-400 font-medium">Administrator</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
                                <Calendar className="w-4 h-4" />
                                <span>Joined {new Date(profile?.created_at || '').toLocaleDateString()}</span>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Profile Details */}
                <Card className="bg-[#1e293b] border-slate-700/50">
                    <CardHeader>
                        <CardTitle className="text-white text-lg">Profile Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label className="text-slate-300 flex items-center gap-2">
                                <User className="w-4 h-4" />
                                Full Name
                            </Label>
                            <Input
                                value={form.full_name}
                                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                                className="bg-slate-700/50 border-slate-600 text-white"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-slate-300 flex items-center gap-2">
                                <Mail className="w-4 h-4" />
                                Email Address
                            </Label>
                            <Input
                                value={form.email}
                                disabled
                                className="bg-slate-700/50 border-slate-600 text-slate-400"
                            />
                            <p className="text-xs text-slate-500">Email cannot be changed</p>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-slate-300 flex items-center gap-2">
                                <Phone className="w-4 h-4" />
                                Phone Number
                            </Label>
                            <Input
                                value={form.phone}
                                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                className="bg-slate-700/50 border-slate-600 text-white"
                                placeholder="+233 XX XXX XXXX"
                            />
                        </div>

                        <Button
                            onClick={handleSaveProfile}
                            disabled={saving}
                            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white"
                        >
                            {saving ? (
                                <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saving...</>
                            ) : (
                                <><Save className="w-4 h-4 mr-2" />Save Changes</>
                            )}
                        </Button>
                    </CardContent>
                </Card>

                {/* Change Password */}
                <Card className="bg-[#1e293b] border-slate-700/50">
                    <CardHeader>
                        <CardTitle className="text-white text-lg flex items-center gap-2">
                            <Lock className="w-5 h-5" />
                            Change Password
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label className="text-slate-300">Current Password</Label>
                            <Input
                                type="password"
                                value={passwordForm.current_password}
                                onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                                className="bg-slate-700/50 border-slate-600 text-white"
                                placeholder="Enter current password"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-slate-300">New Password</Label>
                            <Input
                                type="password"
                                value={passwordForm.new_password}
                                onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                                className="bg-slate-700/50 border-slate-600 text-white"
                                placeholder="Enter new password"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-slate-300">Confirm New Password</Label>
                            <Input
                                type="password"
                                value={passwordForm.confirm_password}
                                onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                                className="bg-slate-700/50 border-slate-600 text-white"
                                placeholder="Confirm new password"
                            />
                        </div>

                        <Button
                            onClick={handleChangePassword}
                            disabled={changingPassword || !passwordForm.new_password || !passwordForm.confirm_password}
                            className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                        >
                            {changingPassword ? (
                                <><Loader2 className="w-4 h-4 animate-spin mr-2" />Changing...</>
                            ) : (
                                'Change Password'
                            )}
                        </Button>
                    </CardContent>
                </Card>
            </div>

            {/* Logout */}
            <Card className="bg-[#1e293b] border-slate-700/50">
                <CardContent className="p-6">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div>
                            <h3 className="font-medium text-white">Sign Out</h3>
                            <p className="text-sm text-slate-400">Sign out from your admin account</p>
                        </div>
                        <Button
                            onClick={handleLogout}
                            variant="outline"
                            className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                        >
                            Sign Out
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
