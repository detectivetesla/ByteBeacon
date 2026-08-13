import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { adminService } from '@/services';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Users,
    Search,
    Plus,
    Edit,
    Trash2,
    Shield,
    UserCheck,
    UserX,
    Loader2,
    MoreVertical,
    Filter,
    Eye,
    MessageSquare,
    Bell,
    Download,
    FileSpreadsheet,
    FileText,
    FileCode,
    Loader2
} from 'lucide-react';
import { exportUsers, exportViaApi } from '@/lib/export';
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

interface User {
    id: string;
    full_name: string;
    email: string;
    phone: string;
    created_at: string;
    role: 'customer' | 'agent' | 'superagent' | 'admin';
    is_verified?: boolean;
    isActive: boolean;
}

export default function AdminUsersPage() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState<'all' | 'customer' | 'agent' | 'superagent' | 'admin'>('all');
    const [exporting, setExporting] = useState(false);

    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showMessageModal, setShowMessageModal] = useState(false);
    const [showNotificationModal, setShowNotificationModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [editForm, setEditForm] = useState({ full_name: '', email: '', phone: '', role: 'customer' as 'customer' | 'agent' | 'superagent' | 'admin' });
    const [addForm, setAddForm] = useState({ full_name: '', email: '', phone: '', password: '', role: 'customer' as 'customer' | 'agent' | 'superagent' | 'admin' });
    const [messageForm, setMessageForm] = useState({ subject: '', body: '' });
    const [notificationForm, setNotificationForm] = useState({ title: '', message: '', type: 'info' });
    const [actionLoading, setActionLoading] = useState(false);

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        try {
            const data = await adminService.getUsers({ role: roleFilter === 'all' ? undefined : roleFilter });
            const usersWithRoles = data.map(u => ({
                id: u.id,
                full_name: u.fullName,
                email: u.email,
                phone: u.phone,
                created_at: u.createdAt || '',
                role: u.role as 'customer' | 'agent' | 'superagent' | 'admin',
                is_verified: true,
                isActive: u.isActive !== undefined ? u.isActive : true,
            }));
            setUsers(usersWithRoles);
        } catch (err) {
            console.error('Error fetching users:', err);
            toast({
                title: 'Error',
                description: 'Failed to fetch users',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    }, [roleFilter, toast]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const filteredUsers = users.filter(user => {
        const matchesSearch =
            user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.phone.includes(searchTerm);
        const matchesRole = roleFilter === 'all' || user.role === roleFilter;
        return matchesSearch && matchesRole;
    });

    const handleEdit = (user: User) => {
        setSelectedUser(user);
        setEditForm({
            full_name: user.full_name,
            email: user.email,
            phone: user.phone,
            role: user.role,
        });
        setShowEditModal(true);
    };

    const handleDelete = (user: User) => {
        setSelectedUser(user);
        setShowDeleteModal(true);
    };

    const handleMessage = (user: User) => {
        setSelectedUser(user);
        setMessageForm({ subject: '', body: '' });
        setShowMessageModal(true);
    };

    const handleNotify = (user: User) => {
        setSelectedUser(user);
        setNotificationForm({ title: '', message: '', type: 'info' });
        setShowNotificationModal(true);
    };

    const handleStatusToggle = (user: User) => {
        setSelectedUser(user);
        setShowStatusModal(true);
    };

    const handleAddUser = async () => {
        if (!addForm.full_name || !addForm.email || !addForm.phone || !addForm.password) {
            toast({
                title: 'Error',
                description: 'All fields are required',
                variant: 'destructive',
            });
            return;
        }

        setActionLoading(true);
        try {
            await adminService.createUser({
                fullName: addForm.full_name,
                email: addForm.email,
                phone: addForm.phone,
                password: addForm.password,
                role: addForm.role,
            });

            toast({
                title: 'Success',
                description: 'User created successfully',
            });

            setShowAddModal(false);
            setAddForm({ full_name: '', email: '', phone: '', password: '', role: 'customer' });
            fetchUsers();
        } catch (err) {
            console.error('Error creating user:', err);
            toast({
                title: 'Error',
                description: 'Failed to create user. Email may already exist.',
                variant: 'destructive',
            });
        } finally {
            setActionLoading(false);
        }
    };

    const saveEdit = async () => {
        if (!selectedUser) return;

        setActionLoading(true);
        try {
            // Update user via adminService
            await adminService.updateUser(selectedUser.id, {
                fullName: editForm.full_name,
                email: editForm.email,
                phone: editForm.phone,
            });

            // Update role if changed
            if (editForm.role !== selectedUser.role) {
                await adminService.changeUserRole(selectedUser.id, editForm.role);
            }

            toast({
                title: 'Success',
                description: 'User updated successfully',
            });

            fetchUsers();
            setShowEditModal(false);
        } catch (err) {
            console.error('Error updating user:', err);
            toast({
                title: 'Error',
                description: 'Failed to update user',
                variant: 'destructive',
            });
        } finally {
            setActionLoading(false);
        }
    };

    const confirmDelete = async () => {
        if (!selectedUser) return;

        setActionLoading(true);
        try {
            await adminService.deleteUser(selectedUser.id);
            toast({ title: 'Success', description: 'User deleted successfully' });
            setShowDeleteModal(false);
            fetchUsers();
        } catch (err) {
            console.error('Error deleting user:', err);
            toast({ title: 'Error', description: 'Failed to delete user', variant: 'destructive' });
        } finally {
            setActionLoading(false);
        }
    };

    const confirmStatusToggle = async () => {
        if (!selectedUser) return;

        setActionLoading(true);
        try {
            const newStatus = !selectedUser.isActive;
            await adminService.toggleUserStatus(selectedUser.id, newStatus);
            toast({
                title: 'Success',
                description: `User account ${newStatus ? 'activated' : 'suspended'} successfully`,
            });
            setShowStatusModal(false);
            fetchUsers();
        } catch (err) {
            console.error('Error toggling user status:', err);
            toast({
                title: 'Error',
                description: 'Failed to update user status',
                variant: 'destructive',
            });
        } finally {
            setActionLoading(false);
        }
    };

    const handleSendMessage = async () => {
        if (!selectedUser || !messageForm.body) return;

        setActionLoading(true);
        try {
            await adminService.sendMessage({
                recipientId: selectedUser.id,
                subject: messageForm.subject || 'Admin Message',
                body: messageForm.body
            });
            toast({ title: 'Success', description: 'Message sent successfully' });
            setShowMessageModal(false);
        } catch (err) {
            console.error('Error sending message:', err);
            toast({ title: 'Error', description: 'Failed to send message', variant: 'destructive' });
        } finally {
            setActionLoading(false);
        }
    };

    const handleSendNotification = async () => {
        if (!selectedUser || !notificationForm.title || !notificationForm.message) return;

        setActionLoading(true);
        try {
            await adminService.sendNotification({
                userId: selectedUser.id,
                title: notificationForm.title,
                message: notificationForm.message,
                type: notificationForm.type
            });
            toast({ title: 'Success', description: 'Notification sent successfully' });
            setShowNotificationModal(false);
        } catch (err) {
            console.error('Error sending notification:', err);
            toast({ title: 'Error', description: 'Failed to send notification', variant: 'destructive' });
        } finally {
            setActionLoading(false);
        }
    };

    const changeRole = async (userId: string, newRole: 'customer' | 'agent' | 'superagent' | 'admin') => {
        try {
            await adminService.changeUserRole(userId, newRole);
            toast({
                title: 'Success',
                description: `User role changed to ${newRole}`,
            });
            fetchUsers();
        } catch (err: any) {
            console.error('Error changing role:', err);
            const errorMessage = err?.message || 'Failed to change user role. Make sure the backend is running.';
            toast({
                title: 'Error',
                description: errorMessage,
                variant: 'destructive',
            });
        }
    };

    const getInitials = (name: string) => {
        if (!name) return 'U';
        return name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
    };

    const handleExport = async (format: 'excel' | 'csv' | 'json' = 'csv') => {
        setExporting(true);
        try {
            const params: Record<string, string> = { format };
            if (roleFilter !== 'all') params.role = roleFilter;
            if (searchTerm.trim()) params.search = searchTerm.trim();

            await exportViaApi('/admin/users/export', params, `bytebeacon_users_${Date.now()}`);
            const formatLabels: Record<string, string> = { excel: 'Excel (.xlsx)', csv: 'CSV', json: 'JSON' };
            toast({ title: 'Export Complete', description: `Full users list exported to ${formatLabels[format]}.` });
        } catch (err: any) {
            if (filteredUsers.length > 0) {
                exportUsers(filteredUsers, { filename: 'users_list', format, sheetName: 'Users' });
                toast({ title: 'Export Downloaded', description: `Exported ${filteredUsers.length} displayed user(s).` });
            } else {
                toast({ title: 'Export Failed', description: err.message || 'Could not export users.', variant: 'destructive' });
            }
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Users className="w-8 h-8 text-muted-foreground" />
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">Users</h1>
                        <p className="text-muted-foreground">Manage all registered users</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="outline"
                                disabled={exporting}
                                className="rounded-xl border-border/50 hover:bg-primary/10 hover:text-primary transition-all font-bold"
                            >
                                {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                                {exporting ? 'Exporting...' : 'Export Users'}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-card border-border">
                            <DropdownMenuLabel>Export Format</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleExport('excel')} className="cursor-pointer">
                                <FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-500" />
                                Export to Excel (.xlsx)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleExport('csv')} className="cursor-pointer">
                                <FileText className="w-4 h-4 mr-2 text-blue-500" />
                                Export to CSV (.csv)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleExport('json')} className="cursor-pointer">
                                <FileCode className="w-4 h-4 mr-2 text-purple-500" />
                                Export to JSON (.json)
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <Button className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl" onClick={() => setShowAddModal(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Add User
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <Card className="bg-card border-border">
                <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Search users..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 bg-accent/50 border-border text-foreground placeholder:text-muted-foreground"
                            />
                        </div>
                        <div className="flex gap-2 flex-wrap">
                            {(['all', 'customer', 'agent', 'superagent', 'admin'] as const).map((role) => (
                                <Button
                                    key={role}
                                    variant={roleFilter === role ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setRoleFilter(role)}
                                    className={cn(
                                        roleFilter === role
                                            ? 'bg-emerald-500 text-white'
                                            : 'border-border text-muted-foreground hover:bg-accent'
                                    )}
                                >
                                    {role === 'superagent' ? 'SuperAgent' : role.charAt(0).toUpperCase() + role.slice(1)}
                                </Button>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Users Table */}
            <Card className="bg-card border-border">
                <CardContent className="p-0">
                    {loading ? (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead><tr className="text-left text-sm text-slate-400 border-b border-slate-700">
                                    <th className="p-4"><Skeleton className="h-3 w-10 bg-slate-700" /></th>
                                    <th className="p-4"><Skeleton className="h-3 w-12 bg-slate-700" /></th>
                                    <th className="p-4"><Skeleton className="h-3 w-12 bg-slate-700" /></th>
                                    <th className="p-4"><Skeleton className="h-3 w-10 bg-slate-700" /></th>
                                    <th className="p-4"><Skeleton className="h-3 w-14 bg-slate-700" /></th>
                                    <th className="p-4"><Skeleton className="h-3 w-16 bg-slate-700" /></th>
                                </tr></thead>
                                <tbody>
                                    {Array.from({ length: 8 }).map((_, i) => (
                                        <tr key={i} className="border-b border-slate-700/50">
                                            <td className="p-4"><div className="flex items-center gap-3"><Skeleton className="h-10 w-10 rounded-full bg-slate-700" /><div className="space-y-1"><Skeleton className="h-4 w-28 bg-slate-700" /><Skeleton className="h-3 w-36 bg-slate-700" /></div></div></td>
                                            <td className="p-4"><Skeleton className="h-4 w-20 bg-slate-700" /></td>
                                            <td className="p-4"><Skeleton className="h-6 w-16 rounded-full bg-slate-700" /></td>
                                            <td className="p-4"><Skeleton className="h-4 w-20 bg-slate-700" /></td>
                                            <td className="p-4"><Skeleton className="h-4 w-24 bg-slate-700" /></td>
                                            <td className="p-4"><div className="flex gap-2"><Skeleton className="h-8 w-8 rounded bg-slate-700" /><Skeleton className="h-8 w-8 rounded bg-slate-700" /></div></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : filteredUsers.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            No users found
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-border text-left text-sm text-muted-foreground">
                                        <th className="p-4 font-medium">User</th>
                                        <th className="p-4 font-medium">Phone</th>
                                        <th className="p-4 font-medium">Role</th>
                                        <th className="p-4 font-medium">Status</th>
                                        <th className="p-4 font-medium">Joined</th>
                                        <th className="p-4 font-medium">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredUsers.map((user) => (
                                        <tr key={user.id} className="border-b border-border/50 hover:bg-accent/30">
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-semibold text-sm">
                                                        {getInitials(user.full_name)}
                                                    </div>
                                                    <div>
                                                        <button
                                                            onClick={() => navigate(`/admin/users/${user.id}`)}
                                                            className="font-medium text-foreground hover:text-primary hover:underline text-left"
                                                        >
                                                            {user.full_name}
                                                        </button>
                                                        <p className="text-sm text-muted-foreground">{user.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4 text-muted-foreground">{user.phone}</td>
                                            <td className="p-4">
                                                <Select value={user.role} onValueChange={(value) => changeRole(user.id, value as 'customer' | 'agent' | 'superagent' | 'admin')}>
                                                    <SelectTrigger className={cn(
                                                        "h-8 w-auto px-3 text-xs font-medium rounded-full border-0",
                                                        user.role === 'admin' ? 'bg-purple-500/20 text-purple-400' :
                                                            user.role === 'superagent' ? 'bg-emerald-500/20 text-emerald-400' :
                                                                user.role === 'agent' ? 'bg-blue-500/20 text-blue-400' :
                                                                    'bg-slate-500/20 text-slate-400'
                                                    )}>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent className="bg-popover border-border">
                                                        <SelectItem value="customer" className="hover:bg-accent focus:bg-accent">Customer</SelectItem>
                                                        <SelectItem value="agent" className="hover:bg-accent focus:bg-accent">Agent</SelectItem>
                                                        <SelectItem value="superagent" className="hover:bg-accent focus:bg-accent">SuperAgent</SelectItem>
                                                        <SelectItem value="admin" className="hover:bg-accent focus:bg-accent">Admin</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </td>
                                            <td className="p-4">
                                                <span className={cn(
                                                    "px-2 py-1 text-[10px] font-bold uppercase rounded-full",
                                                    user.isActive
                                                        ? "bg-emerald-500/20 text-emerald-500"
                                                        : "bg-red-500/20 text-red-500"
                                                )}>
                                                    {user.isActive ? 'Active' : 'Suspended'}
                                                </span>
                                            </td>
                                            <td className="p-4 text-muted-foreground text-sm">
                                                {new Date(user.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-accent"
                                                        onClick={() => navigate(`/admin/users/${user.id}`)}
                                                        title="View Details"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-emerald-500 hover:bg-accent"
                                                        onClick={() => handleMessage(user)}
                                                        title="Send Message"
                                                    >
                                                        <MessageSquare className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-amber-500 hover:bg-accent"
                                                        onClick={() => handleNotify(user)}
                                                        title="Send Notification"
                                                    >
                                                        <Bell className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-accent"
                                                        onClick={() => handleEdit(user)}
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-emerald-500 hover:bg-accent"
                                                        onClick={() => changeRole(user.id, user.role === 'admin' ? 'customer' : 'admin')}
                                                    >
                                                        <Shield className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className={cn(
                                                            "h-8 w-8 hover:bg-accent",
                                                            user.isActive ? "text-muted-foreground hover:text-red-500" : "text-red-500 hover:text-emerald-500"
                                                        )}
                                                        onClick={() => handleStatusToggle(user)}
                                                        title={user.isActive ? "Suspend Account" : "Activate Account"}
                                                    >
                                                        {user.isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-red-500 hover:bg-accent"
                                                        onClick={() => handleDelete(user)}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Edit Modal */}
            <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
                <DialogContent className="bg-popover border-border text-foreground">
                    <DialogHeader>
                        <DialogTitle>Edit User</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label className="text-muted-foreground">Full Name</Label>
                            <Input
                                value={editForm.full_name}
                                onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                                className="bg-accent/50 border-border text-foreground"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-muted-foreground">Email</Label>
                            <Input
                                value={editForm.email}
                                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                                className="bg-accent/50 border-border text-foreground"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-muted-foreground">Phone</Label>
                            <Input
                                value={editForm.phone}
                                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                                className="bg-accent/50 border-border text-foreground"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-muted-foreground">Role</Label>
                            <Select value={editForm.role} onValueChange={(value) => setEditForm({ ...editForm, role: value as 'customer' | 'agent' | 'superagent' | 'admin' })}>
                                <SelectTrigger className="w-full bg-accent/50 border-border text-foreground">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-popover border-border">
                                    <SelectItem value="customer" className="hover:bg-accent focus:bg-accent">Customer</SelectItem>
                                    <SelectItem value="agent" className="hover:bg-accent focus:bg-accent">Agent</SelectItem>
                                    <SelectItem value="superagent" className="hover:bg-accent focus:bg-accent">SuperAgent</SelectItem>
                                    <SelectItem value="admin" className="hover:bg-accent focus:bg-accent">Admin</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowEditModal(false)} className="border-border">
                            Cancel
                        </Button>
                        <Button onClick={saveEdit} disabled={actionLoading} className="bg-emerald-500 hover:bg-emerald-600">
                            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Status Toggle Modal */}
            <Dialog open={showStatusModal} onOpenChange={setShowStatusModal}>
                <DialogContent className="bg-popover border-border text-foreground">
                    <DialogHeader>
                        <DialogTitle>{selectedUser?.isActive ? 'Suspend' : 'Activate'} User Account</DialogTitle>
                    </DialogHeader>
                    <p className="text-muted-foreground">
                        Are you sure you want to {selectedUser?.isActive ? 'suspend' : 'activate'} the account for <span className="text-foreground font-medium">{selectedUser?.full_name}</span>?
                        {selectedUser?.isActive ? ' This user will not be able to log in or use any services.' : ' This user will regain access to the platform.'}
                    </p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowStatusModal(false)} className="border-border">
                            Cancel
                        </Button>
                        <Button
                            onClick={confirmStatusToggle}
                            disabled={actionLoading}
                            className={cn(
                                actionLoading && "opacity-70",
                                selectedUser?.isActive ? "bg-red-500 hover:bg-red-600" : "bg-emerald-500 hover:bg-emerald-600",
                                "text-white"
                            )}
                        >
                            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (selectedUser?.isActive ? 'Suspend' : 'Activate')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Modal */}
            <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
                <DialogContent className="bg-popover border-border text-foreground">
                    <DialogHeader>
                        <DialogTitle>Delete User</DialogTitle>
                    </DialogHeader>
                    <p className="text-muted-foreground">
                        Are you sure you want to delete <span className="text-foreground font-medium">{selectedUser?.full_name}</span>?
                        This action cannot be undone.
                    </p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowDeleteModal(false)} className="border-border">
                            Cancel
                        </Button>
                        <Button onClick={confirmDelete} disabled={actionLoading} className="bg-red-500 hover:bg-red-600">
                            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Add User Modal */}
            <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
                <DialogContent className="bg-popover border-border text-foreground">
                    <DialogHeader>
                        <DialogTitle>Add New User</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label className="text-muted-foreground">Full Name</Label>
                            <Input
                                value={addForm.full_name}
                                onChange={(e) => setAddForm({ ...addForm, full_name: e.target.value })}
                                placeholder="Enter full name"
                                className="bg-accent/50 border-border text-foreground"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-muted-foreground">Email</Label>
                            <Input
                                type="email"
                                value={addForm.email}
                                onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                                placeholder="Enter email address"
                                className="bg-accent/50 border-border text-foreground"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-muted-foreground">Phone</Label>
                            <Input
                                value={addForm.phone}
                                onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                                placeholder="Enter phone number"
                                className="bg-accent/50 border-border text-foreground"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-muted-foreground">Password</Label>
                            <Input
                                type="password"
                                value={addForm.password}
                                onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                                placeholder="Enter password"
                                className="bg-accent/50 border-border text-foreground"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-muted-foreground">Role</Label>
                            <Select value={addForm.role} onValueChange={(value) => setAddForm({ ...addForm, role: value as 'customer' | 'agent' | 'superagent' | 'admin' })}>
                                <SelectTrigger className="w-full bg-accent/50 border-border text-foreground">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-popover border-border">
                                    <SelectItem value="customer" className="hover:bg-accent focus:bg-accent">Customer</SelectItem>
                                    <SelectItem value="agent" className="hover:bg-accent focus:bg-accent">Agent</SelectItem>
                                    <SelectItem value="superagent" className="hover:bg-accent focus:bg-accent">SuperAgent</SelectItem>
                                    <SelectItem value="admin" className="hover:bg-accent focus:bg-accent">Admin</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowAddModal(false)} className="border-border">
                            Cancel
                        </Button>
                        <Button onClick={handleAddUser} disabled={actionLoading} className="bg-emerald-500 hover:bg-emerald-600">
                            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create User'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Message Modal */}
            <Dialog open={showMessageModal} onOpenChange={setShowMessageModal}>
                <DialogContent className="bg-popover border-border text-foreground">
                    <DialogHeader>
                        <DialogTitle>Message {selectedUser?.full_name}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Subject</Label>
                            <Input
                                value={messageForm.subject}
                                onChange={(e) => setMessageForm({ ...messageForm, subject: e.target.value })}
                                placeholder="Message Subject"
                                className="bg-accent/50 border-border"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Message</Label>
                            <textarea
                                value={messageForm.body}
                                onChange={(e) => setMessageForm({ ...messageForm, body: e.target.value })}
                                className="w-full h-32 p-3 bg-accent/50 border border-border rounded-lg text-foreground focus:ring-1 focus:ring-emerald-500 focus:outline-none resize-none"
                                placeholder="Type your message..."
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowMessageModal(false)}>Cancel</Button>
                        <Button onClick={handleSendMessage} disabled={actionLoading || !messageForm.body} className="bg-emerald-500 hover:bg-emerald-600">
                            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Message'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Notification Modal */}
            <Dialog open={showNotificationModal} onOpenChange={setShowNotificationModal}>
                <DialogContent className="bg-popover border-border text-foreground">
                    <DialogHeader>
                        <DialogTitle>Notify {selectedUser?.full_name}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Title</Label>
                            <Input
                                value={notificationForm.title}
                                onChange={(e) => setNotificationForm({ ...notificationForm, title: e.target.value })}
                                placeholder="Notification Title"
                                className="bg-accent/50 border-border"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Type</Label>
                            <Select value={notificationForm.type} onValueChange={(v) => setNotificationForm({ ...notificationForm, type: v })}>
                                <SelectTrigger className="bg-accent/50 border-border">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-popover border-border">
                                    <SelectItem value="info">Info</SelectItem>
                                    <SelectItem value="success">Success</SelectItem>
                                    <SelectItem value="warning">Warning</SelectItem>
                                    <SelectItem value="error">Error</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Message</Label>
                            <textarea
                                value={notificationForm.message}
                                onChange={(e) => setNotificationForm({ ...notificationForm, message: e.target.value })}
                                className="w-full h-32 p-3 bg-accent/50 border border-border rounded-lg text-foreground focus:ring-1 focus:ring-emerald-500 focus:outline-none resize-none"
                                placeholder="Notification content..."
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowNotificationModal(false)}>Cancel</Button>
                        <Button onClick={handleSendNotification} disabled={actionLoading || !notificationForm.message || !notificationForm.title} className="bg-emerald-500 hover:bg-emerald-600">
                            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Notification'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
