import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import { adminService } from '@/services';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
    UserPlus,
    ClipboardList,
    Users,
    Mail,
    Eye,
    Flag,
    TrendingUp,
    DollarSign,
    CheckCircle,
    Clock,
    Loader2,
    ShieldAlert,
    ShieldCheck
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import PortalStatusCard from '../dashboard/PortalStatusCard';

interface Order {
    id: string;
    user_name: string;
    network: string;
    status: string;
    created_at: string;
}

interface UserData {
    id: string;
    full_name: string;
    email: string;
    created_at: string;
}

export default function AdminDashboard() {
    const { user } = useAuth();
    const [adminName, setAdminName] = useState('Super Admin');
    const [stats, setStats] = useState<{
        totalUsers: number;
        verifiedUsers: number;
        todayOrders: number;
        todayRevenue: number;
        monthlyRevenue: number;
        roleStats: {
            customer: { dailyRevenue: number; monthlyRevenue: number; totalOrders: number };
            agent: { dailyRevenue: number; monthlyRevenue: number; totalOrders: number };
            superagent: { dailyRevenue: number; monthlyRevenue: number; totalOrders: number };
        };
    }>({
        totalUsers: 0,
        verifiedUsers: 0,
        todayOrders: 0,
        todayRevenue: 0,
        monthlyRevenue: 0,
        roleStats: {
            customer: { dailyRevenue: 0, monthlyRevenue: 0, totalOrders: 0 },
            agent: { dailyRevenue: 0, monthlyRevenue: 0, totalOrders: 0 },
            superagent: { dailyRevenue: 0, monthlyRevenue: 0, totalOrders: 0 }
        }
    });
    const [recentOrders, setRecentOrders] = useState<Order[]>([]);
    const [newUsers, setNewUsers] = useState<UserData[]>([]);
    const [loading, setLoading] = useState(true);
    const [maintenanceMode, setMaintenanceMode] = useState(false);
    const [updatingMaintenance, setUpdatingMaintenance] = useState(false);
    const { toast } = useToast();
    const { socket } = useSocket();

    const fetchAdminProfile = useCallback(async () => {
        if (!user) return;
        // Admin name comes from AuthContext user
        if (user.fullName) {
            setAdminName(user.fullName);
        }
    }, [user]);

    const fetchStats = useCallback(async () => {
        try {
            const data = await adminService.getStats();
            setStats({
                totalUsers: data.totalUsers || 0,
                verifiedUsers: Math.floor((data.totalUsers || 0) * 0.95), // DERIVED: Assume 95% verified
                todayOrders: data.todayOrders || 0,
                todayRevenue: data.todayRevenue || 0,
                monthlyRevenue: data.monthlyRevenue || 0,
                roleStats: data.roleStats || {
                    customer: { dailyRevenue: 0, monthlyRevenue: 0, totalOrders: 0 },
                    agent: { dailyRevenue: 0, monthlyRevenue: 0, totalOrders: 0 },
                    superagent: { dailyRevenue: 0, monthlyRevenue: 0, totalOrders: 0 }
                }
            });
        } catch (err) {
            console.error('Error fetching stats:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchRecentOrders = useCallback(async () => {
        try {
            const data = await adminService.getTransactions({ status: undefined });
            const recentData = data.slice(0, 5).map(order => ({
                id: `#ORD-${order.id.slice(0, 3).toUpperCase()}`,
                user_name: order.userName || 'Unknown',
                network: order.network || 'N/A',
                status: order.status,
                created_at: order.createdAt,
            }));
            setRecentOrders(recentData);
        } catch (err) {
            console.error('Error fetching orders:', err);
        }
    }, []);

    const fetchNewUsers = useCallback(async () => {
        try {
            const data = await adminService.getUsers({});
            const recentUsers = data.slice(0, 5).map(u => ({
                id: u.id,
                full_name: u.fullName,
                email: u.email,
                created_at: u.createdAt || '',
            }));
            setNewUsers(recentUsers);
        } catch (err) {
            console.error('Error fetching users:', err);
        }
    }, []);

    const fetchMaintenanceStatus = useCallback(async () => {
        try {
            const { maintenanceMode } = await adminService.getMaintenanceStatus();
            setMaintenanceMode(maintenanceMode);
        } catch (err) {
            console.error('Error fetching maintenance status:', err);
        }
    }, []);

    const handleToggleMaintenance = async (checked: boolean) => {
        setUpdatingMaintenance(true);
        try {
            await adminService.updateMaintenanceStatus(checked);
            setMaintenanceMode(checked);
            toast({
                title: checked ? 'Maintenance Mode Enabled' : 'Maintenance Mode Disabled',
                description: checked
                    ? 'Users will now see the maintenance page.'
                    : 'Users can now access the system normally.',
                variant: checked ? 'destructive' : 'default'
            });
        } catch (err) {
            console.error('Error updating maintenance status:', err);
            toast({
                title: 'Operation failed',
                description: 'Failed to update maintenance status. Please try again.',
                variant: 'destructive'
            });
        } finally {
            setUpdatingMaintenance(false);
        }
    };

    useEffect(() => {
        if (user) {
            fetchAdminProfile();
            fetchStats();
            fetchRecentOrders();
            fetchNewUsers();
            fetchMaintenanceStatus();
        }
    }, [user, fetchAdminProfile, fetchStats, fetchRecentOrders, fetchNewUsers, fetchMaintenanceStatus]);

    // Listen for real-time admin events
    useEffect(() => {
        if (!socket) return;

        const handleNewUser = (data: { fullName: string; email: string }) => {
            toast({
                title: '🎉 New User Registered!',
                description: `${data.fullName || data.email} just joined ByteBeacon`,
            });
            // Update stats
            setStats(prev => ({ ...prev, totalUsers: prev.totalUsers + 1 }));
            // Refresh user list
            fetchNewUsers();
        };

        const handleNewAgentApplication = (data: { userName: string; userEmail: string; feePaid: number }) => {
            toast({
                title: '📋 New Agent Application!',
                description: `${data.userName || data.userEmail} applied for agency (GHS ${data.feePaid?.toFixed(2) || '30.00'} paid)`,
            });
        };

        const handleNewUserMessage = (data: { senderName: string; subject: string }) => {
            toast({
                title: '💬 New Support Message',
                description: `${data.senderName}: ${data.subject || 'New message'}`,
            });
        };

        socket.on('admin:newUser', handleNewUser);
        socket.on('admin:newAgentApplication', handleNewAgentApplication);
        socket.on('admin:newUserMessage', handleNewUserMessage);

        return () => {
            socket.off('admin:newUser', handleNewUser);
            socket.off('admin:newAgentApplication', handleNewAgentApplication);
            socket.off('admin:newUserMessage', handleNewUserMessage);
        };
    }, [socket, toast, fetchNewUsers]);

    const getInitials = (name: string) => {
        if (!name) return 'U';
        return name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
    };

    const getNetworkBadge = (network: string) => {
        const net = network?.toUpperCase() || '';
        const styles: Record<string, string> = {
            MTN: 'bg-yellow-400 text-black',
            TELECEL: 'bg-red-600 text-white',
            AIRTELTIGO: 'bg-blue-600 text-white',
            AT: 'bg-blue-600 text-white',
        };
        return styles[net] || 'bg-slate-500 text-white';
    };

    const quickActions = [
        { icon: UserPlus, label: 'Add New User', desc: 'Create user accounts', color: 'bg-blue-500', href: '/admin/users' },
        { icon: ClipboardList, label: 'View Orders', desc: 'Track and manage orders', color: 'bg-orange-500', href: '/admin/orders' },
        { icon: Users, label: 'Manage Agents', desc: 'View resellers & agents', color: 'bg-purple-500', href: '/admin/agents' },
        { icon: Mail, label: 'Send Email', desc: 'Email users & agents', color: 'bg-purple-600', href: '/admin/email' },
    ];

    if (loading) {
        return (
            <div className="space-y-6">
                {/* Welcome banner skeleton */}
                <div className="rounded-2xl border border-border p-8">
                    <div className="flex items-center justify-between">
                        <div className="space-y-2">
                            <Skeleton className="h-8 w-56" />
                            <Skeleton className="h-4 w-36" />
                        </div>
                        <Skeleton className="h-10 w-36 rounded-lg" />
                    </div>
                </div>
                {/* Stats row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="bg-[#1e293b] rounded-xl p-5 border border-slate-700/50">
                            <div className="flex items-center justify-between mb-4">
                                <Skeleton className="h-10 w-10 rounded-xl bg-slate-700" />
                                <Skeleton className="h-5 w-12 rounded-full bg-slate-700" />
                            </div>
                            <Skeleton className="h-8 w-24 mb-2 bg-slate-700" />
                            <Skeleton className="h-4 w-32 bg-slate-700" />
                        </div>
                    ))}
                </div>
                {/* Role stats cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="bg-[#1e293b] rounded-xl p-5 border border-slate-700/50">
                            <Skeleton className="h-4 w-28 mb-3 bg-slate-700" />
                            <Skeleton className="h-6 w-20 mb-2 bg-slate-700" />
                            <Skeleton className="h-4 w-32 bg-slate-700" />
                        </div>
                    ))}
                </div>
                {/* Recent activity */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {[0, 1].map(i => (
                        <div key={i} className="bg-[#1e293b] rounded-xl p-6 border border-slate-700/50">
                            <Skeleton className="h-5 w-32 mb-4 bg-slate-700" />
                            <div className="space-y-3">
                                {Array.from({ length: 5 }).map((_, j) => (
                                    <div key={j} className="flex items-center justify-between py-2">
                                        <div className="flex items-center gap-3">
                                            <Skeleton className="h-8 w-8 rounded-full bg-slate-700" />
                                            <Skeleton className="h-4 w-32 bg-slate-700" />
                                        </div>
                                        <Skeleton className="h-4 w-20 bg-slate-700" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Welcome Banner */}
            <div className="bg-primary/10 border border-primary/20 rounded-2xl p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative overflow-hidden">

                <div className="relative z-10">
                    <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground tracking-tight">
                        Welcome back, {adminName}!
                    </h1>
                    <p className="text-muted-foreground font-medium mt-2 max-w-md">
                        Your platform analytics and system controls are ready. Here's a summary of today's performance.
                    </p>
                </div>
                <Link to="/admin/analytics">
                    <Button variant="outline" className="border-primary/20 hover:bg-primary/10">
                        View Analytics
                    </Button>
                </Link>
            </div>

            <PortalStatusCard />

            <Card className={cn(
                "border-l-4 overflow-hidden relative group transition-all duration-300",
                maintenanceMode
                    ? "border-l-red-500 bg-red-500/5 shadow-md"
                    : "border-l-primary bg-primary/5 shadow-md"
            )}>
                <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className={cn(
                            "w-12 h-12 rounded-xl flex items-center justify-center",
                            maintenanceMode ? "bg-red-500/20" : "bg-emerald-500/20"
                        )}>
                            {maintenanceMode ? (
                                <ShieldAlert className="w-6 h-6 text-red-500" />
                            ) : (
                                <ShieldCheck className="w-6 h-6 text-emerald-500" />
                            )}
                        </div>
                        <div>
                            <h3 className="font-bold text-foreground">System Status: {maintenanceMode ? 'Maintenance Mode' : 'Online'}</h3>
                            <p className="text-sm text-muted-foreground">
                                {maintenanceMode
                                    ? 'The platform is currently hidden from users.'
                                    : 'The platform is live and accessible to everyone.'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 bg-white/10 dark:bg-black/20 p-2 px-4 rounded-full">
                        <span className="text-sm font-medium">Maintenance Mode</span>
                        <Switch
                            checked={maintenanceMode}
                            onCheckedChange={handleToggleMaintenance}
                            disabled={updatingMaintenance}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {quickActions.map((action) => (
                    <Link key={action.label} to={action.href}>
                        <Card className="bg-card border-border hover:border-primary/50 transition-all duration-300 hover:shadow-md hover:-translate-y-1 cursor-pointer overflow-hidden group">
                            <CardContent className="p-5 text-center relative">
                                <div className={cn(
                                    "w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg transform transition-transform group-hover:scale-110 duration-300",
                                    action.color.replace('bg-', 'bg-gradient-to-br from-').replace(' ', ' to-').replace('500', '400') + (action.color.includes('emerald') ? ' via-emerald-500 to-teal-600' : ' to-' + action.color.replace('bg-', '').replace('500', '600'))
                                )}>
                                    <action.icon className="w-7 h-7 text-white" />
                                </div>
                                <p className="font-display font-bold text-foreground text-sm uppercase tracking-tight">{action.label}</p>
                                <p className="text-[10px] text-muted-foreground mt-2 font-medium opacity-80">{action.desc}</p>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-card border-border border-l-4 border-l-purple-500">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                            <Users className="w-6 h-6 text-purple-500" />
                        </div>
                        <div>
                            <p className="text-2xl md:text-3xl font-bold text-foreground">{stats.totalUsers.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Total Users</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-card border-border border-l-4 border-l-orange-500">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center">
                            <ClipboardList className="w-6 h-6 text-orange-500" />
                        </div>
                        <div>
                            <p className="text-2xl md:text-3xl font-bold text-foreground">{stats.todayOrders.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Today's Orders</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-card border-border border-l-4 border-l-blue-500">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                            <DollarSign className="w-6 h-6 text-blue-500" />
                        </div>
                        <div>
                            <p className="text-2xl md:text-3xl font-bold text-foreground">GH₵ {stats.todayRevenue.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Today's Revenue</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-card border-border border-l-4 border-l-emerald-500">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                            <TrendingUp className="w-6 h-6 text-emerald-500" />
                        </div>
                        <div>
                            <p className="text-2xl md:text-3xl font-bold text-foreground">GH₵ {stats.monthlyRevenue.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Monthly Rev</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Revenue & Order Tracking by Tier */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    Revenue & Order Tracking by Tier
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Customer Tier */}
                    <Card className="bg-card border-border border-t-4 border-t-blue-500 overflow-hidden relative shadow-md">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-bold uppercase text-blue-500 tracking-wider">Customer Tier</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex justify-between items-center border-b border-border/50 pb-2">
                                <span className="text-xs text-muted-foreground">Daily Revenue</span>
                                <span className="text-lg font-bold text-foreground">GH₵ {(stats.roleStats?.customer?.dailyRevenue || 0).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center border-b border-border/50 pb-2">
                                <span className="text-xs text-muted-foreground">Monthly Revenue</span>
                                <span className="text-lg font-bold text-foreground">GH₵ {(stats.roleStats?.customer?.monthlyRevenue || 0).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-muted-foreground">Total Orders</span>
                                <span className="text-lg font-bold text-foreground">{(stats.roleStats?.customer?.totalOrders || 0).toLocaleString()}</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Agent Tier */}
                    <Card className="bg-card border-border border-t-4 border-t-emerald-500 overflow-hidden relative shadow-md">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-bold uppercase text-emerald-500 tracking-wider">Agent Tier</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex justify-between items-center border-b border-border/50 pb-2">
                                <span className="text-xs text-muted-foreground">Daily Revenue</span>
                                <span className="text-lg font-bold text-foreground">GH₵ {(stats.roleStats?.agent?.dailyRevenue || 0).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center border-b border-border/50 pb-2">
                                <span className="text-xs text-muted-foreground">Monthly Revenue</span>
                                <span className="text-lg font-bold text-foreground">GH₵ {(stats.roleStats?.agent?.monthlyRevenue || 0).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-muted-foreground">Total Orders</span>
                                <span className="text-lg font-bold text-foreground">{(stats.roleStats?.agent?.totalOrders || 0).toLocaleString()}</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Super Agent Tier */}
                    <Card className="bg-card border-border border-t-4 border-t-violet-500 overflow-hidden relative shadow-md">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-bold uppercase text-violet-500 tracking-wider">Super Agent Tier</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex justify-between items-center border-b border-border/50 pb-2">
                                <span className="text-xs text-muted-foreground">Daily Revenue</span>
                                <span className="text-lg font-bold text-foreground">GH₵ {(stats.roleStats?.superagent?.dailyRevenue || 0).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center border-b border-border/50 pb-2">
                                <span className="text-xs text-muted-foreground">Monthly Revenue</span>
                                <span className="text-lg font-bold text-foreground">GH₵ {(stats.roleStats?.superagent?.monthlyRevenue || 0).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-muted-foreground">Total Orders</span>
                                <span className="text-lg font-bold text-foreground">{(stats.roleStats?.superagent?.totalOrders || 0).toLocaleString()}</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Bottom Section - Recent Orders & New Users */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Orders */}
                <Card className="bg-card border-border">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-foreground">Recent Orders</h3>
                            <Link to="/admin/orders">
                                <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs">
                                    See all →
                                </Button>
                            </Link>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="text-left text-xs text-muted-foreground border-b border-border">
                                        <th className="pb-2 font-medium">ORDER ID</th>
                                        <th className="pb-2 font-medium">USER</th>
                                        <th className="pb-2 font-medium">NETWORK</th>
                                        <th className="pb-2 font-medium">STATUS</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentOrders.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="py-8 text-center text-slate-400">
                                                No orders yet
                                            </td>
                                        </tr>
                                    ) : (
                                        recentOrders.map((order) => (
                                            <tr key={order.id} className="border-b border-border/50">
                                                <td className="py-3 text-sm text-foreground font-mono">{order.id}</td>
                                                <td className="py-3 text-sm text-foreground">{order.user_name}</td>
                                                <td className="py-3">
                                                    <span className={cn(
                                                        "px-2 py-1 text-xs font-bold rounded",
                                                        getNetworkBadge(order.network)
                                                    )}>
                                                        {order.network === 'AirtelTigo' ? 'AT' : order.network}
                                                    </span>
                                                </td>
                                                <td className="py-3">
                                                    <span className={cn(
                                                        "px-2 py-1 text-xs font-medium rounded-full",
                                                        ['completed', 'success', 'delivered'].includes(order.status) ? 'bg-emerald-500/20 text-emerald-400' :
                                                            ['processing', 'ongoing', 'queued'].includes(order.status) ? 'bg-blue-500/20 text-blue-400' :
                                                                ['failed', 'error', 'cancelled'].includes(order.status) ? 'bg-red-500/20 text-red-400' :
                                                                    'bg-slate-500/20 text-slate-400'
                                                    )}>
                                                        {(order.status || 'pending') === 'pending' ? 'Processing' : (order.status ? order.status.charAt(0).toUpperCase() + order.status.slice(1) : 'Unknown')}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>

                {/* New Users */}
                <Card className="bg-card border-border">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-foreground">New Users</h3>
                            <Link to="/admin/users">
                                <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs">
                                    See all →
                                </Button>
                            </Link>
                        </div>

                        <div className="space-y-4">
                            {newUsers.length === 0 ? (
                                <p className="py-8 text-center text-slate-400">No users yet</p>
                            ) : (
                                newUsers.map((userData) => (
                                    <div key={userData.id} className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-semibold text-sm">
                                                {getInitials(userData.full_name)}
                                            </div>
                                            <div>
                                                <p className="font-medium text-foreground text-sm">{userData.full_name}</p>
                                                <p className="text-xs text-muted-foreground">{userData.email}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button className="p-1.5 rounded-lg hover:bg-slate-700 transition-colors">
                                                <Eye className="w-4 h-4 text-slate-400" />
                                            </button>
                                            <button className="p-1.5 rounded-lg hover:bg-slate-700 transition-colors">
                                                <Flag className="w-4 h-4 text-slate-400" />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div >
    );
}
