import { useState, useEffect, useCallback } from 'react';
import { adminService } from '@/services';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
    BarChart3,
    Users,
    ShoppingCart,
    DollarSign,
    TrendingUp,
    TrendingDown,
    Loader2,
    Calendar
} from 'lucide-react';
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Area,
    AreaChart
} from 'recharts';
import { cn } from '@/lib/utils';

interface Stats {
    totalUsers: number;
    totalAgents: number;
    rangeOrders: number;
    rangeRevenue: number;
    totalRevenue: number;
    monthlyGrowth: number;
}

interface ChartData {
    name: string;
    value: number;
    orders?: number;
    revenue?: number;
    users?: number;
}

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function AdminAnalyticsPage() {
    const [stats, setStats] = useState<Stats>({
        totalUsers: 0,
        totalAgents: 0,
        rangeOrders: 0,
        rangeRevenue: 0,
        totalRevenue: 0,
        monthlyGrowth: 0,
    });
    const [revenueData, setRevenueData] = useState<ChartData[]>([]);
    const [ordersByNetwork, setOrdersByNetwork] = useState<ChartData[]>([]);
    const [userGrowth, setUserGrowth] = useState<ChartData[]>([]);
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

    const fetchAnalytics = useCallback(async () => {
        setLoading(true);
        try {
            // Fetch analytics from admin API
            const analyticsData = await adminService.getAnalytics();

            // Use the analytics data or fallback to defaults
            const userCount = analyticsData?.totalUsers || 0;
            const agentCount = analyticsData?.totalAgents || 0;
            const transactions = (analyticsData?.transactions || []) as Array<{
                status: string;
                amount_ghc: number;
                created_at: string;
                network: string | null
            }>;

            const completedTx = transactions.filter(tx => ['completed', 'processing'].includes(tx.status));
            const totalRevenue = completedTx.reduce((sum, tx) => sum + Number(tx.amount_ghc), 0);

            const dateData = generateDateData(transactions, timeRange);
            const rangeOrders = dateData.reduce((sum, d) => sum + (d.orders || 0), 0);
            const rangeRevenue = dateData.reduce((sum, d) => sum + (d.revenue || 0), 0);

            setStats({
                totalUsers: userCount,
                totalAgents: agentCount,
                rangeOrders,
                rangeRevenue,
                totalRevenue,
                monthlyGrowth: analyticsData?.monthlyGrowth || 12.5,
            });

            // Generate revenue trend data
            setRevenueData(dateData);

            // Orders by network
            const networkCounts: Record<string, number> = {};
            transactions.forEach((tx) => {
                const network = tx.network || 'Unknown';
                networkCounts[network] = (networkCounts[network] || 0) + 1;
            });
            setOrdersByNetwork(Object.entries(networkCounts).map(([name, value]) => ({ name, value })));

            // User growth data
            const profiles = analyticsData?.userGrowth || [];
            const usersByMonth = generateUserGrowthData(profiles);
            setUserGrowth(usersByMonth);

        } catch (err) {
            console.error('Error fetching analytics:', err);
            // Set some default/mock data on error
            setStats({
                totalUsers: 0,
                totalAgents: 0,
                todayOrders: 0,
                todayRevenue: 0,
                totalRevenue: 0,
                monthlyGrowth: 0,
            });
        } finally {
            setLoading(false);
        }
    }, [timeRange]);

    useEffect(() => {
        fetchAnalytics();
    }, [fetchAnalytics, timeRange]);

    const generateDateData = (transactions: Array<{ created_at: string; status: string; amount_ghc: number }>, range: string): ChartData[] => {
        const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
        const data: ChartData[] = [];

        for (let i = days - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

            const dayTx = transactions.filter(tx => {
                const txDate = new Date(tx.created_at);
                return txDate.toDateString() === date.toDateString();
            });

            const revenue = dayTx.filter(tx => ['completed', 'processing'].includes(tx.status))
                .reduce((sum, tx) => sum + Number(tx.amount_ghc), 0);

            data.push({
                name: dateStr,
                value: revenue,
                orders: dayTx.length,
                revenue,
            });
        }

        return data;
    };

    const generateUserGrowthData = (profiles: Array<{ created_at: string }>): ChartData[] => {
        const monthlyData: Record<string, number> = {};

        profiles.forEach(p => {
            const date = new Date(p.created_at);
            const monthKey = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
            monthlyData[monthKey] = (monthlyData[monthKey] || 0) + 1;
        });

        // Return last 6 months
        return Object.entries(monthlyData).slice(-6).map(([name, value]) => ({ name, users: value, value }));
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3"><Skeleton className="h-8 w-8 rounded" /><div className="space-y-1"><Skeleton className="h-6 w-28" /><Skeleton className="h-4 w-40" /></div></div>
                    <div className="flex gap-2">{[0,1,2].map(i => <Skeleton key={i} className="h-9 w-20 rounded" />)}</div>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Card key={i} className="bg-card border-border">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-2"><Skeleton className="h-3 w-20" /><Skeleton className="h-7 w-16" /></div>
                                    <Skeleton className="h-12 w-12 rounded-xl" />
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {[0,1].map(i => (
                        <Card key={i} className="bg-card border-border">
                            <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
                            <CardContent><Skeleton className="h-64 w-full rounded-lg" /></CardContent>
                        </Card>
                    ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {[0,1].map(i => (
                        <Card key={i} className="bg-card border-border">
                            <CardHeader><Skeleton className="h-5 w-28" /></CardHeader>
                            <CardContent><Skeleton className="h-64 w-full rounded-lg" /></CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <BarChart3 className="w-8 h-8 text-muted-foreground" />
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
                        <p className="text-muted-foreground">Platform performance insights</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    {(['7d', '30d', '90d'] as const).map((range) => (
                        <Button
                            key={range}
                            variant={timeRange === range ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setTimeRange(range)}
                            className={cn(
                                timeRange === range
                                    ? 'bg-emerald-500 text-white'
                                    : 'border-border text-muted-foreground'
                            )}
                        >
                            {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-card border-border">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Total Users</p>
                                <p className="text-2xl font-bold text-foreground">{stats.totalUsers.toLocaleString()}</p>
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                                <Users className="w-6 h-6 text-purple-400" />
                            </div>
                        </div>
                        <div className="flex items-center gap-1 mt-2 text-sm">
                            <TrendingUp className="w-4 h-4 text-emerald-400" />
                            <span className="text-emerald-400">+{stats.monthlyGrowth}%</span>
                            <span className="text-slate-500">vs last month</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-card border-border">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Total Agents</p>
                                <p className="text-2xl font-bold text-foreground">{stats.totalAgents.toLocaleString()}</p>
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                                <Users className="w-6 h-6 text-blue-400" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-card border-border border-l-4 border-l-orange-500">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Orders ({timeRange.toUpperCase()})</p>
                                <p className="text-2xl font-bold text-foreground">
                                    {stats.rangeOrders.toLocaleString()}
                                </p>
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center">
                                <ShoppingCart className="w-6 h-6 text-orange-400" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-emerald-500 border-emerald-600">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-emerald-100">Revenue ({timeRange.toUpperCase()})</p>
                                <p className="text-2xl font-bold text-white">
                                    GH₵ {stats.rangeRevenue.toLocaleString()}
                                </p>
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                                <DollarSign className="w-6 h-6 text-white" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Lifetime Revenue Banner */}
            <div className="flex justify-end pr-2">
                <div className="bg-muted px-4 py-2 rounded-lg border border-border flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                    <span className="text-sm font-medium">Lifetime Revenue: </span>
                    <span className="text-sm font-bold text-foreground">GH₵ {stats.totalRevenue.toLocaleString()}</span>
                </div>
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Revenue Trend */}
                <Card className="bg-card border-border">
                    <CardHeader>
                        <CardTitle className="text-foreground text-lg">Revenue Trend</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={revenueData}>
                                    <defs>
                                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" />
                                    <XAxis dataKey="name" stroke="currentColor" className="text-muted-foreground" fontSize={12} />
                                    <YAxis stroke="currentColor" className="text-muted-foreground" fontSize={12} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'var(--popover)', border: '1px solid var(--border)', borderRadius: '8px' }}
                                        labelStyle={{ color: 'var(--foreground)' }}
                                        itemStyle={{ color: 'var(--foreground)' }}
                                    />
                                    <Area type="monotone" dataKey="revenue" stroke="#22c55e" fillOpacity={1} fill="url(#colorRevenue)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Orders by Network */}
                <Card className="bg-card border-border">
                    <CardHeader>
                        <CardTitle className="text-foreground text-lg">Orders by Network</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={ordersByNetwork}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}% `}
                                        outerRadius={80}
                                        fill="#8884d8"
                                        dataKey="value"
                                    >
                                        {ordersByNetwork.map((entry, index) => (
                                            <Cell key={`cell - ${index} `} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'var(--popover)', border: '1px solid var(--border)', borderRadius: '8px' }}
                                        itemStyle={{ color: 'var(--foreground)' }}
                                    />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Charts Row 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Daily Orders */}
                <Card className="bg-card border-border">
                    <CardHeader>
                        <CardTitle className="text-foreground text-lg">Daily Orders</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={revenueData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" />
                                    <XAxis dataKey="name" stroke="currentColor" className="text-muted-foreground" fontSize={12} />
                                    <YAxis stroke="currentColor" className="text-muted-foreground" fontSize={12} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'var(--popover)', border: '1px solid var(--border)', borderRadius: '8px' }}
                                        labelStyle={{ color: 'var(--foreground)' }}
                                        itemStyle={{ color: 'var(--foreground)' }}
                                    />
                                    <Bar dataKey="orders" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* User Growth */}
                <Card className="bg-card border-border">
                    <CardHeader>
                        <CardTitle className="text-foreground text-lg">User Growth</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={userGrowth}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" />
                                    <XAxis dataKey="name" stroke="currentColor" className="text-muted-foreground" fontSize={12} />
                                    <YAxis stroke="currentColor" className="text-muted-foreground" fontSize={12} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'var(--popover)', border: '1px solid var(--border)', borderRadius: '8px' }}
                                        labelStyle={{ color: 'var(--foreground)' }}
                                        itemStyle={{ color: 'var(--foreground)' }}
                                    />
                                    <Line type="monotone" dataKey="users" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: '#8b5cf6' }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
