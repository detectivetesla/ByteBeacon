import { useState, useEffect, useCallback } from 'react';
import { adminService, walletService, type WalletCreditRequest } from '@/services';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
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
    UserCog,
    Search,
    Shield,
    Edit,
    Trash2,
    Loader2,
    Mail,
    Phone,
    CheckCircle,
    XCircle,
    Clock,
    UserPlus,
    TrendingUp,
    CheckCircle2,
    Wallet,
    Download,
    FileSpreadsheet,
    FileText,
    FileCode,
    Code,
    Store,
    Loader2
} from 'lucide-react';
import { exportAgents, exportViaApi } from '@/lib/export';
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
    DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface Agent {
    id: string;
    full_name: string;
    email: string;
    phone: string;
    created_at: string;
    role: 'customer' | 'agent' | 'superagent' | 'admin';
    total_orders?: number;
    total_revenue?: number;
    wallet_balance?: number;
    store?: {
        id: string;
        name: string;
        slug: string;
        activationStatus: string;
        reviewStatus: string;
        isVisible: boolean;
    } | null;
    apiAccess?: {
        hasKey: boolean;
        maskedKey: string | null;
        isActive: boolean;
        lastUsed: string | null;
        createdAt: string | null;
    } | null;
}

export default function AdminAgentsPage() {
    const { toast } = useToast();
    const [agents, setAgents] = useState<Agent[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState<'all' | 'agent' | 'superagent' | 'admin'>('all');

    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
    const [editForm, setEditForm] = useState({ full_name: '', email: '', phone: '', role: 'agent' });
    const [actionLoading, setActionLoading] = useState(false);
    const [exporting, setExporting] = useState(false);

    // Pending applications state
    interface Application {
        id: string;
        userId: string;
        fullName: string;
        email: string;
        phone: string;
        businessName: string | null;
        reason: string;
        experience: string | null;
        status: 'processing' | 'approved' | 'rejected';
        adminNotes: string | null;
        requestType?: 'agent' | 'superagent';
        createdAt: string;
    }
    const [applications, setApplications] = useState<Application[]>([]);
    const [loadingApplications, setLoadingApplications] = useState(true);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
    const [rejectNotes, setRejectNotes] = useState('');

    // Wallet credit requests state
    const [creditRequests, setCreditRequests] = useState<WalletCreditRequest[]>([]);
    const [loadingCredits, setLoadingCredits] = useState(true);
    const [showCreditRejectModal, setShowCreditRejectModal] = useState(false);
    const [selectedCreditRequest, setSelectedCreditRequest] = useState<WalletCreditRequest | null>(null);
    const [creditRejectNotes, setCreditRejectNotes] = useState('');

    // Manual admin credit state
    const [showManualCreditModal, setShowManualCreditModal] = useState(false);
    const [manualCreditAgent, setManualCreditAgent] = useState<Agent | null>(null);
    const [manualCreditAmount, setManualCreditAmount] = useState('');
    const [manualCreditNote, setManualCreditNote] = useState('');
    const [manualCreditAction, setManualCreditAction] = useState<'credit' | 'debit' | 'set'>('credit');

    const fetchApplications = useCallback(async () => {
        setLoadingApplications(true);
        try {
            const data = await adminService.getAgentApplications('processing');
            setApplications(data);
        } catch (err) {
            console.error('Error fetching applications:', err);
        } finally {
            setLoadingApplications(false);
        }
    }, []);

    const fetchCreditRequests = useCallback(async () => {
        setLoadingCredits(true);
        try {
            const response = await walletService.getAdminWalletCreditRequests('pending');
            if (response.success) {
                setCreditRequests(response.data);
            }
        } catch (err) {
            console.error('Error fetching credit requests:', err);
        } finally {
            setLoadingCredits(false);
        }
    }, []);

    const approveCreditRequest = async (req: WalletCreditRequest) => {
        setActionLoading(true);
        try {
            const response = await walletService.updateWalletCreditRequest(req.id, {
                status: 'approved',
                adminNotes: 'Approved by administrator'
            });
            if (response.success) {
                toast({ title: 'Credit Approved', description: `Successfully credited GHS ${req.amount.toFixed(2)} to the agent wallet.` });
                fetchCreditRequests();
                fetchAgents();
            }
        } catch (err: any) {
            console.error('Error approving credit:', err);
            const msg = err?.message || 'Failed to approve credit request.';
            toast({ title: 'Error', description: msg, variant: 'destructive' });
        } finally {
            setActionLoading(false);
        }
    };

    const openCreditRejectModal = (req: WalletCreditRequest) => {
        setSelectedCreditRequest(req);
        setCreditRejectNotes('');
        setShowCreditRejectModal(true);
    };

    const confirmCreditReject = async () => {
        if (!selectedCreditRequest) return;
        setActionLoading(true);
        try {
            const response = await walletService.updateWalletCreditRequest(selectedCreditRequest.id, {
                status: 'rejected',
                adminNotes: creditRejectNotes || 'Rejected by administrator'
            });
            if (response.success) {
                toast({ title: 'Credit Rejected', description: `Credit request was rejected.` });
                setShowCreditRejectModal(false);
                fetchCreditRequests();
            }
        } catch (err: any) {
            console.error('Error rejecting credit:', err);
            const msg = err?.message || 'Failed to reject credit request.';
            toast({ title: 'Error', description: msg, variant: 'destructive' });
        } finally {
            setActionLoading(false);
        }
    };

    const fetchAgents = useCallback(async () => {
        setLoading(true);
        try {
            // Fetch users with agent, superagent, or admin roles
            let agentData: any[] = [];
            let superAgentData: any[] = [];
            let adminData: any[] = [];

            try {
                const res = await adminService.getUsers({ role: 'agent' });
                agentData = Array.isArray(res) ? res : (res?.data || []);
            } catch (err) {
                console.error('Error fetching agents:', err);
            }

            try {
                const res = await adminService.getUsers({ role: 'superagent' });
                superAgentData = Array.isArray(res) ? res : (res?.data || []);
            } catch (err) {
                console.error('Error fetching superagents:', err);
            }

            try {
                const res = await adminService.getUsers({ role: 'admin' });
                adminData = Array.isArray(res) ? res : (res?.data || []);
            } catch (err) {
                console.error('Error fetching admins:', err);
            }

            const allAgents = [...agentData, ...superAgentData, ...adminData].map(u => ({
                id: u.id,
                full_name: u.fullName,
                email: u.email,
                phone: u.phone,
                created_at: u.createdAt || '',
                role: u.role as 'agent' | 'superagent' | 'admin',
                total_orders: 0,
                total_revenue: 0,
                wallet_balance: u.walletBalance || 0,
                store: u.store || null,
                apiAccess: u.apiAccess || null
            }));

            setAgents(allAgents);

            if (allAgents.length === 0 && (agentData.length === 0 && superAgentData.length === 0 && adminData.length === 0)) {
                // Only show error if all calls failed
                toast({ title: 'Note', description: 'No resellers or agents found. Make sure the backend server is running on port 5000.', variant: 'default' });
            }
        } catch (err) {
            console.error('Error fetching agents:', err);
            toast({ title: 'Error', description: 'Failed to fetch agents. Is the backend server running?', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchAgents();
        fetchApplications();
        fetchCreditRequests();
    }, [fetchAgents, fetchApplications, fetchCreditRequests]);

    const filteredAgents = agents.filter(agent => {
        const matchesSearch =
            agent.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            agent.email.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesRole = roleFilter === 'all' || agent.role === roleFilter;
        return matchesSearch && matchesRole;
    });

    const handleEdit = (agent: Agent) => {
        setSelectedAgent(agent);
        setEditForm({
            full_name: agent.full_name,
            email: agent.email,
            phone: agent.phone,
            role: agent.role,
        });
        setShowEditModal(true);
    };

    const handleDelete = (agent: Agent) => {
        setSelectedAgent(agent);
        setShowDeleteModal(true);
    };

    const saveEdit = async () => {
        if (!selectedAgent) return;

        setActionLoading(true);
        try {
            // Update role
            await adminService.changeUserRole(selectedAgent.id, editForm.role as 'customer' | 'agent' | 'superagent' | 'admin');

            toast({ title: 'Success', description: 'Agent updated successfully' });
            setShowEditModal(false);
            fetchAgents();
        } catch (err) {
            toast({ title: 'Error', description: 'Failed to update agent', variant: 'destructive' });
        } finally {
            setActionLoading(false);
        }
    };

    const confirmDelete = async () => {
        if (!selectedAgent) return;

        setActionLoading(true);
        try {
            // Demote to customer
            await adminService.changeUserRole(selectedAgent.id, 'customer');

            toast({ title: 'Success', description: 'Agent role removed successfully' });
            setShowDeleteModal(false);
            fetchAgents();
        } catch (err) {
            toast({ title: 'Error', description: 'Failed to remove agent', variant: 'destructive' });
        } finally {
            setActionLoading(false);
        }
    };

    const changeRole = async (agentId: string, newRole: 'customer' | 'agent' | 'superagent' | 'admin') => {
        try {
            await adminService.changeUserRole(agentId, newRole as any);
            toast({ title: 'Success', description: `Role changed to ${newRole}` });
            fetchAgents();
        } catch (err: any) {
            console.error('Change role error:', err);
            const errorMessage = err?.message || 'Failed to change role. Make sure the backend is running.';
            toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
        }
    };

    const getInitials = (name: string) => {
        if (!name) return 'U';
        return name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
    };

    const approveApplication = async (application: Application) => {
        setActionLoading(true);
        try {
            await adminService.updateAgentApplication(application.id, { status: 'approved' });
            toast({ title: 'Success', description: `${application.fullName} is now an Agent!` });
            fetchApplications();
            fetchAgents();
        } catch (err) {
            toast({ title: 'Error', description: 'Failed to approve application', variant: 'destructive' });
        } finally {
            setActionLoading(false);
        }
    };

    const openRejectModal = (application: Application) => {
        setSelectedApplication(application);
        setRejectNotes('');
        setShowRejectModal(true);
    };

    const openManualCreditModal = (agent: Agent) => {
        setManualCreditAgent(agent);
        setManualCreditAmount('');
        setManualCreditNote('');
        setManualCreditAction('credit');
        setShowManualCreditModal(true);
    };

    const confirmManualCredit = async () => {
        if (!manualCreditAgent) return;
        const amount = parseFloat(manualCreditAmount);
        
        if (manualCreditAction === 'set') {
            if (isNaN(amount) || amount < 0) {
                toast({ title: 'Invalid Amount', description: 'Please enter a valid non-negative amount.', variant: 'destructive' });
                return;
            }
        } else {
            if (isNaN(amount) || amount <= 0) {
                toast({ title: 'Invalid Amount', description: 'Please enter a valid positive amount.', variant: 'destructive' });
                return;
            }
        }

        setActionLoading(true);
        try {
            const response = await walletService.adminCreditUserWallet(
                manualCreditAgent.id,
                amount,
                manualCreditAction,
                manualCreditNote || undefined
            );
            if (response.success) {
                let successMsg = '';
                if (manualCreditAction === 'credit') {
                    successMsg = `GHS ${amount.toFixed(2)} successfully added to ${manualCreditAgent.full_name}'s wallet.`;
                } else if (manualCreditAction === 'debit') {
                    successMsg = `GHS ${amount.toFixed(2)} successfully debited from ${manualCreditAgent.full_name}'s wallet.`;
                } else {
                    successMsg = `${manualCreditAgent.full_name}'s wallet balance set to GHS ${amount.toFixed(2)}.`;
                }

                toast({
                    title: 'Success ✓',
                    description: successMsg,
                });
                setShowManualCreditModal(false);
                fetchAgents();
            } else {
                toast({ title: 'Error', description: response.message || 'Failed to adjust wallet.', variant: 'destructive' });
            }
        } catch (err: any) {
            console.error('Manual credit error:', err);
            toast({ title: 'Error', description: err?.message || 'Failed to adjust wallet.', variant: 'destructive' });
        } finally {
            setActionLoading(false);
        }
    };

    const confirmReject = async () => {
        if (!selectedApplication) return;
        setActionLoading(true);
        try {
            await adminService.updateAgentApplication(selectedApplication.id, {
                status: 'rejected',
                adminNotes: rejectNotes || 'Application rejected by admin.'
            });
            toast({ title: 'Application Rejected', description: `${selectedApplication.fullName}'s application was rejected.` });
            setShowRejectModal(false);
            fetchApplications();
        } catch (err) {
            toast({ title: 'Error', description: 'Failed to reject application', variant: 'destructive' });
        } finally {
            setActionLoading(false);
        }
    };

    const handleExport = async (format: 'excel' | 'csv' | 'json' = 'csv') => {
        setExporting(true);
        try {
            const params: Record<string, string> = { format };
            if (searchTerm.trim()) params.search = searchTerm.trim();

            await exportViaApi('/admin/agents/export', params, `bytebeacon_agents_${Date.now()}`);
            const formatLabels: Record<string, string> = { excel: 'Excel (.xlsx)', csv: 'CSV', json: 'JSON' };
            toast({ title: 'Export Complete', description: `Full agents list exported to ${formatLabels[format]}.` });
        } catch (err: any) {
            if (filteredAgents.length > 0) {
                exportAgents(filteredAgents, { filename: 'agents_list', format, sheetName: 'Agents' });
                toast({ title: 'Export Downloaded', description: `Exported ${filteredAgents.length} displayed agent(s).` });
            } else {
                toast({ title: 'Export Failed', description: err.message || 'Could not export agents.', variant: 'destructive' });
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
                    <UserCog className="w-8 h-8 text-muted-foreground" />
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">Resellers & Agents</h1>
                        <p className="text-muted-foreground">Manage Agents and their privileges</p>
                    </div>
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="outline"
                            disabled={exporting}
                            className="rounded-xl border-border/50 hover:bg-primary/10 hover:text-primary transition-all font-bold"
                        >
                            {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                            {exporting ? 'Exporting...' : 'Export Agents'}
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
            </div>

            {/* Pending Applications Section */}
            {applications.length > 0 && (
                <Card className="bg-card border-border">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-lg text-foreground">
                            <Clock className="w-5 h-5 text-yellow-500" />
                            Processing Applications ({applications.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {loadingApplications ? (
                            <div className="flex justify-center py-4">
                                <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                            </div>
                        ) : (
                            applications.map((app) => (
                                <div key={app.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-accent/30 rounded-lg border border-border">
                                    <div className="flex items-start gap-3">
                                        <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                                            <UserPlus className="w-5 h-5 text-yellow-500" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="font-semibold text-foreground">{app.fullName}</p>
                                                <span className="px-2 py-0.5 text-xs bg-emerald-500/20 text-emerald-500 font-bold rounded-full">
                                                    Agent Application
                                                </span>
                                            </div>
                                            <p className="text-sm text-muted-foreground">{app.email} • {app.phone}</p>
                                            {app.businessName && <p className="text-xs text-muted-foreground">Business: {app.businessName}</p>}
                                            <p className="text-sm text-muted-foreground mt-1 italic">"{app.reason}"</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 flex-shrink-0">
                                        <Button
                                            size="sm"
                                            className="bg-emerald-500 hover:bg-emerald-600 text-white"
                                            onClick={() => approveApplication(app)}
                                            disabled={actionLoading}
                                        >
                                            <CheckCircle className="w-4 h-4 mr-1" />
                                            Approve
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="border-red-500 text-red-500 hover:bg-red-500/10"
                                            onClick={() => openRejectModal(app)}
                                            disabled={actionLoading}
                                        >
                                            <XCircle className="w-4 h-4 mr-1" />
                                            Reject
                                        </Button>
                                    </div>
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Pending Wallet Credit Requests Section */}
            {creditRequests.length > 0 && (
                <Card className="bg-card border-emerald-500/20 bg-emerald-500/5">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-lg text-emerald-600 dark:text-emerald-400">
                            <Shield className="w-5 h-5 text-emerald-500" />
                            Pending Wallet Credit Requests ({creditRequests.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {loadingCredits ? (
                            <div className="flex justify-center py-4">
                                <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                            </div>
                        ) : (
                            creditRequests.map((req) => (
                                <div key={req.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-[#1e293b] rounded-lg border border-slate-700/50">
                                    <div className="flex items-start gap-3">
                                        <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                                            <TrendingUp className="w-5 h-5 text-emerald-500" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="font-semibold text-white">{req.fullName}</p>
                                                <span className="px-2 py-0.5 text-xs bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold rounded-full">
                                                    Agent
                                                </span>
                                            </div>
                                            <p className="text-sm text-slate-400">{req.email} • {req.phone}</p>
                                            <p className="text-lg font-bold text-emerald-500 mt-1">
                                                GHS {req.amount.toFixed(2)}
                                            </p>
                                            {req.agentNotes && (
                                                <p className="text-sm text-slate-300 mt-1 bg-slate-800 px-3 py-1.5 rounded border border-slate-700 italic">
                                                    " {req.agentNotes} "
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-2 flex-shrink-0">
                                        <Button
                                            size="sm"
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                                            onClick={() => approveCreditRequest(req)}
                                            disabled={actionLoading}
                                        >
                                            <CheckCircle className="w-4 h-4 mr-1" />
                                            Approve Credit
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="border-red-500 text-red-500 hover:bg-red-500/10"
                                            onClick={() => openCreditRejectModal(req)}
                                            disabled={actionLoading}
                                        >
                                            <XCircle className="w-4 h-4 mr-1" />
                                            Reject Request
                                        </Button>
                                    </div>
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Filters */}
            <Card className="bg-card border-border">
                <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <Input
                                placeholder="Search agents..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 bg-slate-700/50 border-slate-600 text-white"
                            />
                        </div>
                        <div className="flex gap-2">
                            {(['all', 'agent', 'superagent', 'admin'] as const).map((role) => (
                                <Button
                                    key={role}
                                    variant={roleFilter === role ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setRoleFilter(role)}
                                    className={cn(
                                        roleFilter === role
                                            ? 'bg-emerald-500 text-white'
                                            : 'border-slate-600 text-slate-300'
                                    )}
                                >
                                    {role === 'superagent' ? 'SuperAgent' : role.charAt(0).toUpperCase() + role.slice(1)}
                                </Button>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Agents Grid */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <Card key={i} className="bg-[#1e293b] border-slate-700/50">
                            <CardContent className="p-5 space-y-4">
                                <div className="flex items-center gap-3">
                                    <Skeleton className="h-12 w-12 rounded-full bg-slate-700" />
                                    <div className="space-y-1.5">
                                        <Skeleton className="h-4 w-28 bg-slate-700" />
                                        <Skeleton className="h-3 w-36 bg-slate-700" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between"><Skeleton className="h-3 w-16 bg-slate-700" /><Skeleton className="h-3 w-20 bg-slate-700" /></div>
                                    <div className="flex justify-between"><Skeleton className="h-3 w-12 bg-slate-700" /><Skeleton className="h-5 w-16 rounded-full bg-slate-700" /></div>
                                </div>
                                <div className="flex gap-2 pt-2">
                                    <Skeleton className="h-8 flex-1 rounded bg-slate-700" />
                                    <Skeleton className="h-8 flex-1 rounded bg-slate-700" />
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : filteredAgents.length === 0 ? (
                <div className="text-center py-12 text-slate-400">No agents found</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredAgents.map((agent) => (
                        <Card key={agent.id} className="bg-[#1e293b] border-slate-700/50">
                            <CardContent className="p-4">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                                            {getInitials(agent.full_name)}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-white">{agent.full_name}</p>
                                            <span className={cn(
                                                "px-2 py-0.5 text-xs font-medium rounded-full",
                                                agent.role === 'admin' ? 'bg-purple-500/20 text-purple-400' :
                                                agent.role === 'superagent' ? 'bg-emerald-500/20 text-emerald-400' :
                                                'bg-blue-500/20 text-blue-400'
                                            )}>
                                                {agent.role === 'superagent' ? 'SuperAgent' : agent.role === 'admin' ? 'Admin' : agent.role === 'agent' ? 'Agent' : 'Customer'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 hover:bg-emerald-500/10"
                                            title="Credit Wallet"
                                            onClick={() => openManualCreditModal(agent)}
                                        >
                                            <Wallet className="w-4 h-4 text-emerald-400" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(agent)}>
                                            <Edit className="w-4 h-4 text-slate-400" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(agent)}>
                                            <Trash2 className="w-4 h-4 text-red-400" />
                                        </Button>
                                    </div>
                                </div>

                                <div className="space-y-2 text-sm">
                                    <div className="flex items-center gap-2 text-slate-400">
                                        <Mail className="w-4 h-4" />
                                        <span className="truncate">{agent.email}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-slate-400">
                                        <Phone className="w-4 h-4" />
                                        <span>{agent.phone}</span>
                                    </div>

                                    {/* Tier Specific Metadata Box */}
                                    {agent.role === 'superagent' && (
                                        <div className="mt-3 p-2.5 bg-emerald-950/30 border border-emerald-500/20 rounded-xl space-y-1 text-xs">
                                            <div className="flex items-center justify-between">
                                                <span className="font-bold text-emerald-400 flex items-center gap-1">
                                                    <Code className="w-3.5 h-3.5" /> Developer API Reseller
                                                </span>
                                                <span className={cn(
                                                    "px-1.5 py-0.5 text-[10px] font-bold rounded-full",
                                                    agent.apiAccess?.isActive ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-700 text-slate-400"
                                                )}>
                                                    {agent.apiAccess?.isActive ? "🟢 API Enabled" : "⚪ No Active Key"}
                                                </span>
                                            </div>
                                            <p className="text-slate-300 font-mono text-[11px] truncate">
                                                Key: {agent.apiAccess?.maskedKey || "No key generated"}
                                            </p>
                                        </div>
                                    )}

                                    {agent.role === 'agent' && (
                                        <div className="mt-3 p-2.5 bg-blue-950/30 border border-blue-500/20 rounded-xl space-y-1 text-xs">
                                            <div className="flex items-center justify-between">
                                                <span className="font-bold text-blue-400 flex items-center gap-1">
                                                    <Store className="w-3.5 h-3.5" /> Storefront Reseller
                                                </span>
                                                <span className={cn(
                                                    "px-1.5 py-0.5 text-[10px] font-bold rounded-full",
                                                    agent.store?.reviewStatus === 'APPROVED' ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"
                                                )}>
                                                    {agent.store?.reviewStatus === 'APPROVED' ? "🟢 Store Active" : agent.store ? "🟡 Pending Review" : "⚪ No Store"}
                                                </span>
                                            </div>
                                            {agent.store ? (
                                                <p className="text-slate-300 text-[11px] truncate">
                                                    Store: <span className="font-semibold text-white">{agent.store.name}</span> (/store/{agent.store.slug})
                                                </p>
                                            ) : (
                                                <p className="text-slate-400 text-[11px]">No storefront created</p>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-700">
                                    <div className="text-center">
                                        <p className="text-lg font-bold text-white">{agent.total_orders}</p>
                                        <p className="text-[10px] text-slate-400">Orders</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-lg font-bold text-blue-400">GH₵{agent.wallet_balance?.toFixed(2) || '0.00'}</p>
                                        <p className="text-[10px] text-slate-400">Wallet</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-lg font-bold text-emerald-400">GH₵{agent.total_revenue?.toFixed(0)}</p>
                                        <p className="text-[10px] text-slate-400">Revenue</p>
                                    </div>
                                </div>

                                {/* Role Change */}
                                <div className="mt-4">
                                    <Select value={agent.role} onValueChange={(value) => changeRole(agent.id, value as 'customer' | 'agent' | 'superagent' | 'admin')}>
                                        <SelectTrigger className="w-full h-9 bg-slate-700/50 border-slate-600 text-white text-sm">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-slate-800 border-slate-600">
                                            <SelectItem value="customer" className="text-white hover:bg-slate-700 focus:bg-slate-700">Customer</SelectItem>
                                            <SelectItem value="agent" className="text-white hover:bg-slate-700 focus:bg-slate-700">Agent</SelectItem>
                                            <SelectItem value="superagent" className="text-white hover:bg-slate-700 focus:bg-slate-700">SuperAgent</SelectItem>
                                            <SelectItem value="admin" className="text-white hover:bg-slate-700 focus:bg-slate-700">Admin</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Edit Modal */}
            <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
                <DialogContent className="bg-[#1e293b] border-slate-700 text-white">
                    <DialogHeader>
                        <DialogTitle>Edit Agent</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label className="text-slate-300">Full Name</Label>
                            <Input value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} className="bg-slate-700/50 border-slate-600 text-white" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-slate-300">Email</Label>
                            <Input value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="bg-slate-700/50 border-slate-600 text-white" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-slate-300">Phone</Label>
                            <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className="bg-slate-700/50 border-slate-600 text-white" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-slate-300">Role</Label>
                            <Select value={editForm.role} onValueChange={(value) => setEditForm({ ...editForm, role: value })}>
                                <SelectTrigger className="w-full bg-slate-700/50 border-slate-600 text-white">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-800 border-slate-600">
                                    <SelectItem value="customer" className="text-white hover:bg-slate-700 focus:bg-slate-700">Customer</SelectItem>
                                    <SelectItem value="agent" className="text-white hover:bg-slate-700 focus:bg-slate-700">Agent</SelectItem>
                                    <SelectItem value="superagent" className="text-white hover:bg-slate-700 focus:bg-slate-700">Agent (Super)</SelectItem>
                                    <SelectItem value="admin" className="text-white hover:bg-slate-700 focus:bg-slate-700">Admin</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowEditModal(false)} className="border-slate-600">Cancel</Button>
                        <Button onClick={saveEdit} disabled={actionLoading} className="bg-emerald-500 hover:bg-emerald-600">
                            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Modal */}
            <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
                <DialogContent className="bg-[#1e293b] border-slate-700 text-white">
                    <DialogHeader>
                        <DialogTitle>Remove Agent Role</DialogTitle>
                    </DialogHeader>
                    <p className="text-slate-400">
                        Remove agent privileges from <span className="text-white font-medium">{selectedAgent?.full_name}</span>? They will become a regular customer.
                    </p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowDeleteModal(false)} className="border-slate-600">Cancel</Button>
                        <Button onClick={confirmDelete} disabled={actionLoading} className="bg-red-500 hover:bg-red-600">
                            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Remove'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Reject Application Modal */}
            <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
                <DialogContent className="bg-card border-border text-foreground">
                    <DialogHeader>
                        <DialogTitle>Reject Application</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <p className="text-muted-foreground">
                            Reject the agent application from <span className="text-foreground font-medium">{selectedApplication?.fullName}</span>?
                        </p>
                        <div className="space-y-2">
                            <Label className="text-foreground">Reason for rejection (optional)</Label>
                            <Textarea
                                value={rejectNotes}
                                onChange={(e) => setRejectNotes(e.target.value)}
                                placeholder="Enter a note to send to the applicant..."
                                className="bg-accent/50 border-border text-foreground min-h-[100px]"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowRejectModal(false)} className="border-border">Cancel</Button>
                        <Button onClick={confirmReject} disabled={actionLoading} className="bg-red-500 hover:bg-red-600">
                            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Reject'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {/* Reject Wallet Credit Request Modal */}
            <Dialog open={showCreditRejectModal} onOpenChange={setShowCreditRejectModal}>
                <DialogContent className="bg-[#1e293b] border-slate-700 text-white">
                    <DialogHeader>
                        <DialogTitle>Reject Credit Request</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <p className="text-slate-400">
                            Reject the GHS {selectedCreditRequest?.amount.toFixed(2)} credit request from <span className="text-white font-medium">{selectedCreditRequest?.fullName}</span>?
                        </p>
                        <div className="space-y-2">
                            <Label className="text-slate-300">Reason for rejection (optional)</Label>
                            <Textarea
                                value={creditRejectNotes}
                                onChange={(e) => setCreditRejectNotes(e.target.value)}
                                placeholder="Enter a note or explanation for the agent..."
                                className="bg-slate-700/50 border-slate-600 text-white min-h-[100px]"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCreditRejectModal(false)} className="border-slate-600">Cancel</Button>
                        <Button onClick={confirmCreditReject} disabled={actionLoading} className="bg-red-500 hover:bg-red-600">
                            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Reject'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {/* Manual Admin Credit Modal */}
            <Dialog open={showManualCreditModal} onOpenChange={setShowManualCreditModal}>
                <DialogContent className="bg-[#1e293b] border-slate-700 text-white">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Wallet className={cn(
                                "w-5 h-5",
                                manualCreditAction === 'debit' ? 'text-red-400' :
                                manualCreditAction === 'set' ? 'text-blue-400' : 'text-emerald-400'
                            )} />
                            {manualCreditAction === 'credit' ? 'Credit Agent Wallet' :
                             manualCreditAction === 'debit' ? 'Debit Agent Wallet' : 'Set Agent Wallet Balance'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {manualCreditAgent && (
                            <div className="flex items-center gap-3 p-3 bg-slate-800/60 rounded-lg border border-slate-700">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm">
                                    {getInitials(manualCreditAgent.full_name)}
                                </div>
                                <div>
                                    <p className="font-semibold text-white">{manualCreditAgent.full_name}</p>
                                    <p className="text-xs text-slate-400">Current Balance: GH₵{(manualCreditAgent.wallet_balance || 0).toFixed(2)}</p>
                                </div>
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label className="text-slate-300">Action Type</Label>
                            <Select 
                                value={manualCreditAction} 
                                onValueChange={(value) => {
                                    setManualCreditAction(value as any);
                                    setManualCreditAmount('');
                                }}
                            >
                                <SelectTrigger className="w-full bg-slate-700/50 border-slate-600 text-white">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-800 border-slate-600">
                                    <SelectItem value="credit" className="text-white hover:bg-slate-700 focus:bg-slate-700">Credit (Add Funds)</SelectItem>
                                    <SelectItem value="debit" className="text-white hover:bg-slate-700 focus:bg-slate-700">Debit (Subtract Funds)</SelectItem>
                                    <SelectItem value="set" className="text-white hover:bg-slate-700 focus:bg-slate-700">Set Balance (Override)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-slate-300">
                                {manualCreditAction === 'set' ? 'New Balance (GHS)' : 'Amount (GHS)'}
                            </Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">GH₵</span>
                                <Input
                                    type="number"
                                    min={manualCreditAction === 'set' ? '0' : '0.01'}
                                    step="0.01"
                                    placeholder="0.00"
                                    value={manualCreditAmount}
                                    onChange={(e) => setManualCreditAmount(e.target.value)}
                                    className="pl-12 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-slate-300">Note <span className="text-slate-500">(optional)</span></Label>
                            <Textarea
                                value={manualCreditNote}
                                onChange={(e) => setManualCreditNote(e.target.value)}
                                placeholder="e.g. Top-up for completed reseller order, balance correction..."
                                className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 min-h-[80px]"
                            />
                        </div>
                        <div className={cn(
                            "flex items-start gap-2 p-3 border rounded-lg",
                            manualCreditAction === 'debit' ? 'bg-red-500/10 border-red-500/20 text-red-300' :
                            manualCreditAction === 'set' ? 'bg-blue-500/10 border-blue-500/20 text-blue-300' :
                            'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                        )}>
                            <CheckCircle2 className={cn(
                                "w-4 h-4 mt-0.5 flex-shrink-0",
                                manualCreditAction === 'debit' ? 'text-red-400' :
                                manualCreditAction === 'set' ? 'text-blue-400' : 'text-emerald-400'
                            )} />
                            <p className="text-xs">
                                {manualCreditAction === 'credit' && "This amount will be credited directly to the agent's wallet balance. The agent can then use this balance to make purchases."}
                                {manualCreditAction === 'debit' && "This amount will be deducted directly from the agent's wallet balance. The new balance will reflect immediately."}
                                {manualCreditAction === 'set' && "This agent's wallet balance will be set exactly to the specified amount (e.g. GHS 0.00). Useful for clearing outstanding balances or setting a base."}
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setShowManualCreditModal(false)}
                            className="border-slate-600 text-slate-300"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={confirmManualCredit}
                            disabled={actionLoading || !manualCreditAmount}
                            className={cn(
                                "text-white font-semibold",
                                manualCreditAction === 'debit' ? 'bg-red-600 hover:bg-red-700' :
                                manualCreditAction === 'set' ? 'bg-blue-600 hover:bg-blue-700' :
                                'bg-emerald-500 hover:bg-emerald-600'
                            )}
                        >
                            {actionLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : (
                                <Wallet className="w-4 h-4 mr-2" />
                            )}
                            {actionLoading ? 'Saving...' : 
                             manualCreditAction === 'credit' ? 'Credit Wallet' :
                             manualCreditAction === 'debit' ? 'Debit Wallet' : 'Set Balance'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
