import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { bundleService, walletService, transactionService, paymentService } from '@/services';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Wallet,
    Upload,
    Users,
    User,
    Download,
    PlusCircle,
    XCircle,
    FileSpreadsheet,
    Loader2,
    Phone,
    RefreshCw,
    Package,
    CreditCard
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { parseDataAmount, cn } from '@/lib/utils';
import { submitBulkOrderApi } from '@/services/bulk.service';
import { BatchProgressModal } from '@/components/dashboard/BatchProgressModal';
import * as XLSX from 'xlsx';

type Network = 'MTN' | 'TELECEL';

interface Bundle {
    id: string;
    network: string;
    data_amount: string;
    price_ghc: number;
    agent_price_ghc?: number;
    user_price?: number;
}

const networkConfig: Record<string, {
    name: string;
    color: string;
    bgColor: string;
    textColor: string;
    gradient: string;
    borderColor: string;
    glowShadow: string;
    lightBg: string;
    logo: string;
    tagline: string;
    accentColor: string;
    glowColor: string;
    mutedColor: string;
}> = {
    mtn: {
        name: 'MTN',
        color: 'bg-yellow-400',
        bgColor: 'bg-yellow-400/10',
        textColor: 'text-yellow-600 dark:text-yellow-400',
        gradient: 'bg-gradient-to-br from-yellow-400 via-yellow-500 to-amber-500',
        borderColor: 'border-yellow-400/30 hover:border-yellow-400/60',
        glowShadow: 'shadow-yellow-500/20',
        lightBg: 'bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-950/20 dark:to-amber-950/10',
        logo: '/mtn-logo.png',
        tagline: 'Ghana\'s #1 Network',
        accentColor: 'text-yellow-500',
        glowColor: 'bg-yellow-500',
        mutedColor: 'text-yellow-600/70 dark:text-yellow-400/70'
    },
    telecel: {
        name: 'TELECEL',
        color: 'bg-red-500',
        bgColor: 'bg-red-500/10',
        textColor: 'text-red-600 dark:text-red-400',
        gradient: 'bg-gradient-to-br from-red-500 via-red-600 to-rose-600',
        borderColor: 'border-red-500/30 hover:border-red-500/60',
        glowShadow: 'shadow-red-500/20',
        lightBg: 'bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/20 dark:to-rose-950/10',
        logo: '/telecel-logo.png',
        tagline: 'Feel the Speed',
        accentColor: 'text-red-500',
        glowColor: 'bg-red-500',
        mutedColor: 'text-red-600/70 dark:text-red-400/70'
    },
    airteltigo: {
        name: 'AIRTELTIGO',
        color: 'bg-blue-500',
        bgColor: 'bg-blue-500/10',
        textColor: 'text-blue-600 dark:text-blue-400',
        gradient: 'bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600',
        borderColor: 'border-blue-500/30 hover:border-blue-500/60',
        glowShadow: 'shadow-blue-500/20',
        lightBg: 'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/10',
        logo: '/airteltigo-logo.png',
        tagline: 'Life is Simple',
        accentColor: 'text-blue-500',
        glowColor: 'bg-blue-500',
        mutedColor: 'text-blue-600/70 dark:text-blue-400/70'
    },
};

// Sample bundles - in production these would come from the database
const sampleBundles: Record<string, Bundle[]> = {
    MTN: [
        { id: '1', network: 'MTN', data_amount: '1GB', price_ghc: 4.50 },
        { id: '2', network: 'MTN', data_amount: '2GB', price_ghc: 8.50 },
        { id: '3', network: 'MTN', data_amount: '5GB', price_ghc: 20.00 },
        { id: '4', network: 'MTN', data_amount: '10GB', price_ghc: 37.00 },
    ],
    TELECEL: [
        { id: '5', network: 'TELECEL', data_amount: '1GB', price_ghc: 5.00 },
        { id: '6', network: 'TELECEL', data_amount: '2GB', price_ghc: 9.00 },
        { id: '7', network: 'TELECEL', data_amount: '5GB', price_ghc: 22.00 },
        { id: '8', network: 'TELECEL', data_amount: '10GB', price_ghc: 40.00 },
    ],
    AIRTELTIGO: [
        { id: '9', network: 'AIRTELTIGO', data_amount: '1GB', price_ghc: 4.50 },
        { id: '10', network: 'AIRTELTIGO', data_amount: '2GB', price_ghc: 8.00 },
        { id: '11', network: 'AIRTELTIGO', data_amount: '5GB', price_ghc: 19.00 },
        { id: '12', network: 'AIRTELTIGO', data_amount: '10GB', price_ghc: 35.00 },
    ],
};

export default function DataBundlesPage() {
    const { network: networkParam } = useParams<{ network: string }>();
    const navigate = useNavigate();
    const { user, role } = useAuth();
    const { toast } = useToast();
    const isAgent = role === 'agent';

    const [bundles, setBundles] = useState<Bundle[]>([]);
    const [walletBalance, setWalletBalance] = useState(0);
    const [viewMode, setViewMode] = useState<'normal' | 'grid'>('grid');
    const [selectedBundle, setSelectedBundle] = useState<Bundle | null>(null);
    const [recipientPhone, setRecipientPhone] = useState('');
    const [purchasing, setPurchasing] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'paystack'>('wallet');
    const [loading, setLoading] = useState(true);
    const [subTab, setSubTab] = useState<'single' | 'bulk' | 'excel'>('single');
    const [singleForm, setSingleForm] = useState({ phone: '', bundleId: '', isRecurring: false });
    const [bulkRecipients, setBulkRecipients] = useState([{ id: '1', phone: '', bundleId: '' }]);
    const [excelFile, setExcelFile] = useState<File | null>(null);
    const [batchSubmissionId, setBatchSubmissionId] = useState<string | null>(null);
    const [showBatchProgress, setShowBatchProgress] = useState(false);
    const [submittingBulk, setSubmittingBulk] = useState(false);
    const [excelParsedData, setExcelParsedData] = useState<{ phone: string; dataAmount: string }[]>([]);
    const [excelParseError, setExcelParseError] = useState<string | null>(null);
    const [submittingExcel, setSubmittingExcel] = useState(false);

    const networkKey = networkParam?.toLowerCase() || 'mtn';
    const config = networkConfig[networkKey] || networkConfig.mtn;
    const networkName = config.name;

    // ── Excel helpers ──

    /** Generate and download an .xlsx template file */
    const downloadTemplate = (type: 'simple' | 'full') => {
        const wb = XLSX.utils.book_new();
        if (type === 'simple') {
            const ws = XLSX.utils.aoa_to_sheet([
                ['Recipient', 'Volume'],
                ['0241234567', '1GB'],
                ['0551234567', '2GB'],
            ]);
            XLSX.utils.book_append_sheet(wb, ws, 'Recipients');
        } else {
            const ws = XLSX.utils.aoa_to_sheet([
                ['Beneficiary Msisdn', 'Data (MB)'],
                ['0241234567', '1000'],
                ['0551234567', '2000'],
            ]);
            XLSX.utils.book_append_sheet(wb, ws, 'Recipients');
        }
        XLSX.writeFile(wb, `${networkName}_bulk_template_${type}.xlsx`);
    };

    /** Normalize a data amount string like "1GB", "1000", "1000MB" → "1GB" */
    const normalizeDataAmount = (raw: string): string => {
        const s = raw.trim().toUpperCase();
        // Already in xGB format
        if (/^\d+(\.\d+)?\s*GB$/i.test(s)) return s.replace(/\s+/g, '');
        // MB format — convert to GB
        const mbMatch = s.match(/^(\d+(\.\d+)?)\s*(MB)?$/i);
        if (mbMatch) {
            const mb = parseFloat(mbMatch[1]);
            if (mb >= 1000) return `${(mb / 1000).toFixed(mb % 1000 === 0 ? 0 : 1)}GB`;
            return `${mb}MB`;
        }
        return s; // return as-is, matching will be attempted later
    };

    /** Parse uploaded Excel/CSV file and extract phone + dataAmount rows */
    const parseExcelFile = async (file: File) => {
        setExcelParseError(null);
        setExcelParsedData([]);

        try {
            const data = await file.arrayBuffer();
            const wb = XLSX.read(data, { type: 'array' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

            if (rows.length < 2) {
                setExcelParseError('File is empty or has no data rows (only a header).');
                return;
            }

            // Detect header format
            const header = (rows[0] || []).map((h: any) => String(h).trim().toLowerCase());
            let phoneCol = -1;
            let dataCol = -1;

            // Try to find phone column
            for (let i = 0; i < header.length; i++) {
                if (['recipient', 'phone', 'msisdn', 'beneficiary msisdn', 'beneficiary', 'number', 'phone number'].includes(header[i])) {
                    phoneCol = i;
                    break;
                }
            }
            // Try to find data column
            for (let i = 0; i < header.length; i++) {
                if (['volume', 'data', 'data (mb)', 'data_amount', 'bundle', 'size', 'data amount', 'dataamount'].includes(header[i])) {
                    dataCol = i;
                    break;
                }
            }

            // Fallback: assume col 0 = phone, col 1 = data
            if (phoneCol === -1) phoneCol = 0;
            if (dataCol === -1 && rows[0].length > 1) dataCol = 1;

            const parsed: { phone: string; dataAmount: string }[] = [];
            const errors: string[] = [];

            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (!row || row.length === 0) continue;

                const rawPhone = String(row[phoneCol] || '').trim();
                if (!rawPhone || rawPhone.length < 9) {
                    if (rawPhone) errors.push(`Row ${i + 1}: Invalid phone "${rawPhone}"`);
                    continue;
                }

                let dataAmount = '';
                if (dataCol >= 0 && row[dataCol] != null) {
                    dataAmount = normalizeDataAmount(String(row[dataCol]));
                }

                parsed.push({ phone: rawPhone, dataAmount });
            }

            if (parsed.length === 0) {
                setExcelParseError(`No valid rows found. ${errors.length > 0 ? errors.slice(0, 3).join('; ') : 'Check your file format.'}`);
                return;
            }

            setExcelParsedData(parsed);
            if (errors.length > 0) {
                toast({
                    title: `⚠️ ${errors.length} rows skipped`,
                    description: errors.slice(0, 2).join('; ') + (errors.length > 2 ? ` and ${errors.length - 2} more...` : ''),
                });
            }
            toast({
                title: '✅ File Parsed',
                description: `${parsed.length} valid recipients found in ${file.name}`,
            });
        } catch (err: any) {
            console.error('Excel parse error:', err);
            setExcelParseError(err.message || 'Failed to parse file.');
        }
    };

    /** Submit parsed Excel data via bulk API */
    const submitExcelOrder = async () => {
        if (excelParsedData.length === 0 || submittingExcel) return;
        setSubmittingExcel(true);

        try {
            // Group by dataAmount
            const groups: Record<string, string[]> = {};
            let defaultDataAmount = '';

            for (const row of excelParsedData) {
                // If row has a data amount, use it. Otherwise use the first bundle's data_amount as default.
                const da = row.dataAmount || defaultDataAmount || bundles[0]?.data_amount || '1GB';
                if (!defaultDataAmount && !row.dataAmount && bundles.length > 0) {
                    defaultDataAmount = bundles[0].data_amount;
                }
                if (!groups[da]) groups[da] = [];
                groups[da].push(row.phone);
            }

            let totalQueued = 0;
            let lastSubId = '';
            const groupEntries = Object.entries(groups);

            for (const [dataAmount, phones] of groupEntries) {
                // Find matching bundle
                const matchedBundle = bundles.find(b =>
                    b.data_amount.toUpperCase() === dataAmount.toUpperCase()
                );

                const result = await submitBulkOrderApi({
                    network: networkName,
                    dataAmount: matchedBundle?.data_amount || dataAmount,
                    bundleId: matchedBundle?.id,
                    recipients: phones,
                    source: 'Dashboard (Excel Upload)',
                });

                if (result.success) {
                    totalQueued += result.data.totalRecipients;
                    lastSubId = result.data.submissionId;
                }
            }

            if (totalQueued > 0) {
                toast({
                    title: '✅ Excel Order Submitted',
                    description: `${totalQueued} recipients queued across ${groupEntries.length} bundle group(s).`,
                });
                setBatchSubmissionId(lastSubId);
                setShowBatchProgress(true);
                setExcelFile(null);
                setExcelParsedData([]);
            } else {
                toast({
                    title: 'Submission Failed',
                    description: 'Could not submit any orders from the Excel data.',
                    variant: 'destructive',
                });
            }
        } catch (err: any) {
            console.error('Excel submission error:', err);
            toast({
                title: 'Error',
                description: err.message || 'An unexpected error occurred.',
                variant: 'destructive',
            });
        } finally {
            setSubmittingExcel(false);
        }
    };

    const fetchBundles = useCallback(async () => {
        console.log('Fetching bundles for network:', networkName, 'networkKey:', networkKey);
        setLoading(true);
        try {
            const data = await bundleService.getByNetwork(networkName);
            console.log('API Response data:', data);

            if (!data || data.length === 0) {
                console.log('No data from API, using sample data for:', networkName);
                // Use sample data if database is empty
                const fallbackData = sampleBundles[networkName.toUpperCase()] || sampleBundles.MTN;
                console.log('Fallback bundles:', fallbackData);
                setBundles(fallbackData);
            } else {
                // Map API response to component format
                const mappedBundles = data
                    .filter(b => b.isActive)
                    .map(b => ({
                        id: b.id,
                        network: b.network,
                        data_amount: b.dataAmount,
                        price_ghc: b.priceGhc,
                        agent_price_ghc: b.agentPrice || b.priceGhc,
                        user_price: b.userPrice || b.priceGhc,
                    })).sort((a, b) => parseDataAmount(a.data_amount) - parseDataAmount(b.data_amount));
                console.log('Mapped bundles:', mappedBundles);
                setBundles(mappedBundles);
            }
        } catch (err) {
            console.error('Error fetching bundles:', err);
            const fallbackData = sampleBundles[networkName.toUpperCase()] || sampleBundles.MTN;
            console.log('Error fallback bundles:', fallbackData);
            setBundles(fallbackData);
        }
        setLoading(false);
    }, [networkName]);

    const fetchWalletBalance = useCallback(async () => {
        if (!user) return;

        try {
            const data = await walletService.getBalance();
            setWalletBalance(data.balance || 0);
        } catch (err) {
            console.error('Error fetching wallet:', err);
        }
    }, [user]);

    useEffect(() => {
        fetchBundles();
        fetchWalletBalance();
    }, [fetchBundles, fetchWalletBalance]);

    const handleSelectBundle = (bundle: Bundle) => {
        setSelectedBundle(bundle);
        setRecipientPhone('');
        setPaymentMethod('wallet');
        setShowModal(true);
    };

    const processPurchase = async () => {
        if (!selectedBundle || !recipientPhone || !user) return;

        if (recipientPhone.length < 10) {
            toast({
                title: 'Invalid phone number',
                description: 'Please enter a valid phone number',
                variant: 'destructive',
                duration: 3000,
            });
            return;
        }

        const finalPrice = selectedBundle.user_price || selectedBundle.price_ghc;

        if (paymentMethod === 'wallet') {
            if (walletBalance < finalPrice) {
                toast({
                    title: 'Insufficient balance',
                    description: 'Please top up your wallet or select Paystack to pay directly.',
                    variant: 'destructive',
                    duration: 3000,
                });
                return;
            }

            setPurchasing(true);

            try {
                // Make purchase through API
                const response: any = await transactionService.purchase({
                    bundleId: selectedBundle.id,
                    recipientPhone: recipientPhone,
                });

                if (response.status === 'pending_mtn_approval' || response.success === false) {
                    toast({
                        title: '⚠️ MTN Number Pending Approval',
                        description: response.message || 'This recipient\'s MTN number has not been verified. Your order was NOT placed and you were NOT charged. The number has been submitted for MTN approval.',
                        variant: 'destructive',
                        duration: 8000,
                    });
                    setShowModal(false);
                    return;
                }

                // Refresh wallet balance
                const balanceData = await walletService.getBalance();
                setWalletBalance(balanceData.balance);

                toast({
                    title: 'Order placed!',
                    description: `${selectedBundle.data_amount} bundle for ${recipientPhone} is being processed`,
                });

                setShowModal(false);
            } catch (error: unknown) {
                const err = error as any;
                console.error('Purchase error:', err);
                const code = err?.code || err?.data?.code;
                if (code === 'BENEFICIARY_NOT_VALIDATED' || code === 'BENEFICIARY_PENDING_MTN_APPROVAL') {
                    toast({
                        title: '⚠️ MTN Number Pending Approval',
                        description: err?.data?.message || err.message || 'This recipient\'s MTN number has not been verified. Your order was NOT placed and you were NOT charged.',
                        variant: 'destructive',
                        duration: 8000,
                    });
                    setShowModal(false);
                    return;
                }
                toast({
                    title: 'Purchase failed',
                    description: err.message || 'An error occurred. Please try again.',
                    variant: 'destructive',
                    duration: 5000,
                });
            } finally {
                setPurchasing(false);
            }
        } else {
            // Paystack Direct Checkout
            setPurchasing(true);
            try {
                if (!user.email) {
                    throw new Error('User email not found. Required for Paystack checkout.');
                }

                const response = await paymentService.processPayment({
                    email: user.email,
                    amount: finalPrice,
                    bundleId: selectedBundle.id,
                    recipientPhone: recipientPhone,
                    network: selectedBundle.network,
                    dataAmount: selectedBundle.data_amount,
                });

                if (response.success && response.authorization_url) {
                    toast({
                        title: 'Payment Initialized',
                        description: 'Redirecting to Paystack to complete payment...',
                    });
                    // Redirect to Paystack secure checkout page
                    window.location.href = response.authorization_url;
                } else {
                    throw new Error('Failed to start Paystack checkout process.');
                }
            } catch (error: unknown) {
                const err = error as any;
                console.error('Paystack purchase process error:', err);
                const code = err?.code || err?.data?.code;
                if (code === 'BENEFICIARY_NOT_VALIDATED' || code === 'BENEFICIARY_PENDING_MTN_APPROVAL') {
                    toast({
                        title: '⚠️ MTN Number Pending Approval',
                        description: err?.data?.message || err.message || 'This recipient\'s MTN number has not been verified. Your order was NOT placed and you were NOT charged.',
                        variant: 'destructive',
                        duration: 8000,
                    });
                    setShowModal(false);
                    return;
                }
                toast({
                    title: 'Checkout Failed',
                    description: err.message || 'Could not start payment checkout. Please try again.',
                    variant: 'destructive',
                    duration: 3000,
                });
            } finally {
                setPurchasing(false);
            }
        }
    };

    const getPrice = (bundle: Bundle) => {
        return bundle.user_price || bundle.price_ghc;
    };

    const getOriginalPrice = (price: number) => {
        return (price * 1.15).toFixed(2);
    };

    const getSavings = (bundle: Bundle) => {
        const basePrice = bundle.price_ghc;
        const orgPrice = basePrice * 1.15;
        const actualPrice = getPrice(bundle);
        return (orgPrice - actualPrice).toFixed(2);
    };

    return (
        <div className="space-y-6">
            {/* Header with Network Theme */}
            <div className={cn(
                "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 sm:p-6 rounded-xl border-2",
                config.lightBg,
                config.borderColor
            )}>
                <div className="flex items-center gap-4">
                    <img
                        src={config.logo}
                        alt={networkName}
                        className="w-14 h-14 rounded-full object-cover shadow-lg ring-2 ring-white/50"
                    />
                    <div>
                        <h1 className={cn("font-display text-2xl font-bold", config.textColor)}>{networkName} Data Bundles</h1>
                        <p className="text-muted-foreground">
                            Purchase data bundles for single or multiple recipients
                        </p>
                    </div>
                </div>
                <Link to="/dashboard/wallet">
                    <Button variant="outline" className={cn("gap-2 border-2", config.borderColor)}>
                        <Wallet className="w-4 h-4" />
                        Wallet: GH₵ {walletBalance.toFixed(2)}
                    </Button>
                </Link>
            </div>

            {/* Network Selector Header */}
            <div className={cn(
                "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 p-6 sm:p-8 rounded-2xl border-2 transition-all duration-500 shadow-xl backdrop-blur-sm relative overflow-hidden mb-6",
                config.lightBg,
                config.borderColor
            )}>
                {/* Decorative background glow */}
                <div className={cn(
                    "absolute top-0 right-0 w-64 h-64 blur-[100px] opacity-20 -mr-32 -mt-32 rounded-full",
                    config.glowColor
                )} />

                <div className="flex items-center gap-6 relative z-10">
                    <div className={cn(
                        "w-20 h-20 sm:w-24 sm:h-24 rounded-3xl p-3 shadow-2xl flex items-center justify-center transform transition-transform duration-500 hover:scale-105",
                        "bg-white dark:bg-slate-900 border-2",
                        config.borderColor
                    )}>
                        <img
                            src={config.logo}
                            alt={config.name}
                            className="w-full h-full object-contain"
                        />
                    </div>
                    <div>
                        <div className="flex items-baseline gap-2">
                            <h1 className="font-display text-3xl md:text-5xl font-black tracking-tight">{config.name}</h1>
                            <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full", config.bgColor, config.textColor)}>ACTIVE</span>
                        </div>
                        <p className={cn("text-lg font-medium opacity-80", config.mutedColor)}>{config.tagline}</p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-3 relative z-10">
                    {(['mtn', 'telecel', 'airteltigo'] as const).map((net) => (
                        <Button
                            key={net}
                            variant="ghost"
                            onClick={() => {
                                navigate(`/dashboard/bundles/${net}`);
                                setSelectedBundle(null);
                            }}
                            className={cn(
                                "capitalize font-bold transition-all duration-300 border-2 rounded-xl min-w-[100px] h-11",
                                networkKey === net
                                    ? `gradient-${net} text-white border-transparent shadow-lg shadow-${net}/20`
                                    : `${networkConfig[net].textColor} ${networkConfig[net].borderColor} hover:gradient-${net} hover:text-white hover:border-transparent hover:shadow-lg shadow-${net}/10`
                            )}
                        >
                            {net}
                        </Button>
                    ))}
                </div>
            </div>

            {/* View Mode Toggle and Progress */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-card/50 backdrop-blur-md p-4 rounded-2xl border border-border/50 shadow-sm mb-8">
                <div className="flex items-center gap-6">
                    <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider">View:</span>
                    <div className="flex p-1 bg-muted rounded-xl gap-1">
                        <button
                            onClick={() => setViewMode('normal')}
                            className={cn(
                                "px-6 py-2 text-xs font-black uppercase tracking-widest transition-all rounded-lg",
                                viewMode === 'normal' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            Normal
                        </button>
                        <button
                            onClick={() => setViewMode('grid')}
                            className={cn(
                                "px-6 py-2 text-xs font-black uppercase tracking-widest transition-all rounded-lg",
                                viewMode === 'grid' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            Grid
                        </button>
                    </div>
                </div>

                {/* Progress indicator */}
                <div className="flex items-center gap-8 px-4">
                    <div className="flex items-center gap-3">
                        <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black shadow-lg shadow-primary/20", config.gradient, "text-white")}>
                            1
                        </div>
                        <span className="text-xs font-black uppercase tracking-widest">Plan</span>
                    </div>
                    <div className={cn("w-12 h-0.5 rounded-full", config.bgColor)} />
                    <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-muted border border-border flex items-center justify-center text-[10px] font-black text-muted-foreground">
                            2
                        </div>
                        <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Confirm</span>
                    </div>
                </div>
            </div>

            {/* Bundles */}
            <div>
                <h2 className="font-display text-xl font-bold mb-2">{networkName} Bundles</h2>
                <p className="text-sm text-muted-foreground mb-4">Choose your data package</p>

                {/* Debug info - only visible in dev */}
                {process.env.NODE_ENV === 'development' && (
                    <div className="mb-4 p-2 bg-red-500/10 text-[10px] font-mono rounded">
                        Network: {networkName} | Bundles count: {bundles.length} | Loading: {loading ? 'YES' : 'NO'}
                    </div>
                )}

                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <Card key={i} className="overflow-hidden border-2 border-border/50">
                                <CardContent className="p-0">
                                    <div className="p-5 space-y-4">
                                        <div className="flex justify-between items-start">
                                            <Skeleton className="w-12 h-12 rounded-2xl" />
                                            <div className="text-right space-y-1">
                                                <Skeleton className="h-3 w-12 ml-auto" />
                                                <Skeleton className="h-6 w-20" />
                                            </div>
                                        </div>
                                        <div className="space-y-2 mt-4">
                                            <div className="flex items-baseline gap-2">
                                                <Skeleton className="h-10 w-20" />
                                                <Skeleton className="h-3 w-12" />
                                            </div>
                                            <div className="flex gap-2">
                                                <Skeleton className="h-5 w-16 rounded" />
                                                <Skeleton className="h-5 w-16 rounded" />
                                            </div>
                                        </div>
                                        <Skeleton className="h-10 w-full rounded-md" />
                                    </div>
                                </CardContent>
                                <div className="h-1.5 w-full bg-muted" />
                            </Card>
                        ))}
                    </div>
                ) : bundles.length > 0 ? (
                    viewMode === 'grid' ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {bundles.map((bundle) => {
                                const displayPrice = getPrice(bundle);
                                return (
                                    <Card
                                        key={bundle.id}
                                        className={cn(
                                            "relative group overflow-hidden transition-all duration-300",
                                            "hover:shadow-2xl hover:-translate-y-1.5",
                                            "border-2",
                                            config.borderColor,
                                            selectedBundle?.id === bundle.id ? "ring-2 ring-primary border-primary" : "",
                                            isAgent && "ring-1 ring-emerald-500/20"
                                        )}
                                        onClick={() => handleSelectBundle(bundle)}
                                    >
                                        {/* Background Accent Glow */}
                                        <div className={cn(
                                            "absolute -right-4 -top-4 w-24 h-24 rounded-full blur-3xl opacity-0 group-hover:opacity-20 transition-opacity duration-500",
                                            config.glowColor
                                        )} />

                                        {isAgent && (
                                            <div className="absolute top-2 right-2 z-20 px-2 py-0.5 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase rounded border border-emerald-500/20">
                                                Agent Price
                                            </div>
                                        )}

                                        <CardContent className="p-0">
                                            <div className={cn(
                                                "p-5 flex flex-col h-full",
                                                "bg-gradient-to-b from-card/50 to-card"
                                            )}>
                                                <div className="flex justify-between items-start mb-6">
                                                    <div className={cn(
                                                        "w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner transform transition-transform group-hover:rotate-12",
                                                        config.bgColor
                                                    )}>
                                                        <Package className={cn("w-6 h-6", config.textColor)} />
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Price</p>
                                                        <p className={cn("text-xl font-display font-black", config.textColor)}>
                                                            GH₵ {displayPrice.toFixed(2)}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="mt-auto">
                                                    <div className="flex items-baseline gap-2 mb-4">
                                                        <h3 className="text-4xl font-display font-black tracking-tight">{bundle.data_amount}</h3>
                                                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{config.name}</span>
                                                    </div>

                                                    <div className="flex flex-wrap gap-2 mb-6">
                                                        <span className="px-2 py-0.5 rounded bg-muted text-[10px] font-bold uppercase tracking-wider">30 Days</span>
                                                        <span className="px-2 py-0.5 rounded bg-muted text-[10px] font-bold uppercase tracking-wider">Reliable</span>
                                                    </div>

                                                    <Button
                                                        className={cn(
                                                            "w-full font-black text-xs uppercase tracking-widest transition-all duration-300 group-hover:shadow-lg border-2",
                                                            selectedBundle?.id === bundle.id
                                                                ? `gradient-${networkKey} text-white border-transparent`
                                                                : cn("bg-muted hover:text-white border-transparent", config.gradient)
                                                        )}
                                                        variant="ghost"
                                                    >
                                                        {selectedBundle?.id === bundle.id ? "Selected" : "Select Plan"}
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardContent>

                                        {/* Decorative bottom line */}
                                        <div className={cn("absolute bottom-0 left-0 h-1.5 w-full opacity-30 transform origin-left transition-transform group-hover:scale-x-110", config.gradient)} />
                                    </Card>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Sub-tabs for Normal Mode - Responsive wrap */}
                            <div className="flex flex-wrap p-1 bg-muted rounded-xl gap-1 max-w-2xl">
                                {(['single', 'bulk', 'excel'] as const).map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => setSubTab(tab)}
                                        className={cn(
                                            "flex-1 min-w-[100px] py-2 text-sm font-medium rounded-lg capitalize transition-all",
                                            subTab === tab ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        {tab} Order
                                    </button>
                                ))}
                            </div>

                            {/* Single Order Form */}
                            {subTab === 'single' && (
                                <Card className="max-w-2xl border-primary/20 bg-card/50 backdrop-blur-sm">
                                    <CardHeader className="pb-4">
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            <div className="p-2 rounded-lg bg-primary/20 text-primary">
                                                <User className="w-5 h-5" />
                                            </div>
                                            Single Order
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
                                        <div className="grid gap-4">
                                            <div className="space-y-2">
                                                <Label>Recipient Phone Number</Label>
                                                <div className="relative">
                                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                                                    <Input
                                                        placeholder="e.g. 0241234567"
                                                        value={singleForm.phone}
                                                        onChange={(e) => setSingleForm({ ...singleForm, phone: e.target.value })}
                                                        className="pl-10 h-12 text-lg bg-background/50 border-border/50 focus:border-primary"
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Package</Label>
                                                <Select value={singleForm.bundleId} onValueChange={(value) => setSingleForm({ ...singleForm, bundleId: value })}>
                                                    <SelectTrigger className="w-full h-12 bg-background/50 border-border/50 focus:border-primary text-foreground">
                                                        <SelectValue placeholder="Select package" />
                                                    </SelectTrigger>
                                                    <SelectContent className="bg-background border-border max-h-60">
                                                        {bundles.map(b => (
                                                            <SelectItem key={b.id} value={b.id} className="hover:bg-accent focus:bg-accent">
                                                                {b.data_amount} - GH₵{getPrice(b).toFixed(2)}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <input
                                                type="checkbox"
                                                id="recurring"
                                                checked={singleForm.isRecurring}
                                                onChange={(e) => setSingleForm({ ...singleForm, isRecurring: e.target.checked })}
                                                className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                                            />
                                            <Label htmlFor="recurring" className="text-sm flex items-center gap-2 cursor-pointer">
                                                <RefreshCw className="w-3.5 h-3.5" />
                                                Make this a recurring order
                                            </Label>
                                        </div>
                                        <Button
                                            size="lg"
                                            className={cn(
                                                "w-full h-14 text-lg font-bold text-white shadow-lg transition-all duration-300",
                                                `gradient-${networkKey} hover:brightness-110 shadow-${networkKey}/20`
                                            )}
                                            disabled={!singleForm.phone || !singleForm.bundleId || purchasing}
                                            onClick={async () => {
                                                const bundle = bundles.find(b => b.id === singleForm.bundleId);
                                                if (bundle) {
                                                    setSelectedBundle(bundle);
                                                    setRecipientPhone(singleForm.phone);
                                                    setShowModal(true);
                                                }
                                            }}
                                        >
                                            Place Order
                                        </Button>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Bulk Order Form */}
                            {subTab === 'bulk' && (
                                <Card className="border-primary/20 bg-card/50 backdrop-blur-sm">
                                    <CardHeader className="pb-4 border-b border-border/50">
                                        <div className="flex items-center justify-between">
                                            <CardTitle className="text-lg flex items-center gap-2">
                                                <div className="p-2 rounded-lg bg-primary/20 text-primary">
                                                    <Users className="w-5 h-5" />
                                                </div>
                                                Bulk Order
                                            </CardTitle>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="gap-2 border-primary/50 text-primary hover:bg-primary/10"
                                                onClick={() => setBulkRecipients([...bulkRecipients, { id: Date.now().toString(), phone: '', bundleId: '' }])}
                                            >
                                                <PlusCircle className="w-4 h-4" />
                                                Add Recipient
                                            </Button>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="pt-6 space-y-4">
                                        <div className="space-y-3">
                                            {bulkRecipients.map((recipient, index) => (
                                                <div key={recipient.id} className="flex flex-col sm:flex-row gap-3 items-end sm:items-center bg-muted/30 p-4 rounded-xl border border-border/30">
                                                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                                                        {index + 1}
                                                    </div>
                                                    <div className="flex-1 space-y-1 w-full">
                                                        <Input
                                                            placeholder="Recipient phone number"
                                                            value={recipient.phone}
                                                            onChange={(e) => {
                                                                const newRecipients = [...bulkRecipients];
                                                                newRecipients[index].phone = e.target.value;
                                                                setBulkRecipients(newRecipients);
                                                            }}
                                                            className="h-11 bg-background/50 border-border/30"
                                                        />
                                                    </div>
                                                    <div className="flex-1 space-y-1 w-full">
                                                        <Select
                                                            value={recipient.bundleId}
                                                            onValueChange={(value) => {
                                                                const newRecipients = [...bulkRecipients];
                                                                newRecipients[index].bundleId = value;
                                                                setBulkRecipients(newRecipients);
                                                            }}
                                                        >
                                                            <SelectTrigger className="w-full h-11 bg-background/50 border-border/30 text-foreground">
                                                                <SelectValue placeholder="Select package" />
                                                            </SelectTrigger>
                                                            <SelectContent className="bg-background border-border max-h-60">
                                                                {bundles.map(b => (
                                                                    <SelectItem key={b.id} value={b.id} className="hover:bg-accent focus:bg-accent">
                                                                        {b.data_amount} - GH₵{getPrice(b).toFixed(2)}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-11 w-11 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                        disabled={bulkRecipients.length === 1}
                                                        onClick={() => setBulkRecipients(bulkRecipients.filter(r => r.id !== recipient.id))}
                                                    >
                                                        <XCircle className="w-5 h-5" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="pt-6 border-t border-border/50">
                                            <Button
                                                size="lg"
                                                className={cn(
                                                    "w-full h-14 text-lg font-bold text-white shadow-lg transition-all duration-300",
                                                    `gradient-${networkKey} hover:brightness-110 shadow-${networkKey}/20`
                                                )}
                                                disabled={bulkRecipients.some(r => !r.phone || !r.bundleId) || submittingBulk}
                                                onClick={async () => {
                                                    if (submittingBulk) return;
                                                    setSubmittingBulk(true);

                                                    try {
                                                        // Group recipients by their selected bundle
                                                        const groupedByBundle: Record<string, { bundle: Bundle; phones: string[] }> = {};
                                                        for (const r of bulkRecipients) {
                                                            const bundle = bundles.find(b => b.id === r.bundleId);
                                                            if (!bundle) continue;
                                                            if (!groupedByBundle[r.bundleId]) {
                                                                groupedByBundle[r.bundleId] = { bundle, phones: [] };
                                                            }
                                                            groupedByBundle[r.bundleId].phones.push(r.phone.trim());
                                                        }

                                                        const groups = Object.values(groupedByBundle);

                                                        // If all recipients share the same bundle, submit as one batch
                                                        if (groups.length === 1) {
                                                            const { bundle, phones } = groups[0];
                                                            const result = await submitBulkOrderApi({
                                                                network: networkName,
                                                                dataAmount: bundle.data_amount,
                                                                bundleId: bundle.id,
                                                                recipients: phones,
                                                                source: 'Dashboard (Bulk)',
                                                            });

                                                            if (result.success) {
                                                                toast({
                                                                    title: '✅ Bulk Order Submitted',
                                                                    description: `${result.data.totalRecipients} recipients queued. Reference: ${result.data.referenceCode}`,
                                                                });
                                                                setBatchSubmissionId(result.data.submissionId);
                                                                setShowBatchProgress(true);
                                                                setBulkRecipients([{ id: '1', phone: '', bundleId: '' }]);
                                                            } else {
                                                                toast({
                                                                    title: 'Submission Failed',
                                                                    description: result.message || 'Could not submit bulk order.',
                                                                    variant: 'destructive',
                                                                });
                                                            }
                                                        } else {
                                                            // Multiple bundles selected — submit one batch per bundle group
                                                            let totalQueued = 0;
                                                            let lastRef = '';
                                                            let lastSubId = '';
                                                            for (const { bundle, phones } of groups) {
                                                                const result = await submitBulkOrderApi({
                                                                    network: networkName,
                                                                    dataAmount: bundle.data_amount,
                                                                    bundleId: bundle.id,
                                                                    recipients: phones,
                                                                    source: 'Dashboard (Bulk)',
                                                                });
                                                                if (result.success) {
                                                                    totalQueued += result.data.totalRecipients;
                                                                    lastRef = result.data.referenceCode;
                                                                    lastSubId = result.data.submissionId;
                                                                }
                                                            }
                                                            if (totalQueued > 0) {
                                                                toast({
                                                                    title: '✅ Bulk Orders Submitted',
                                                                    description: `${totalQueued} recipients queued across ${groups.length} bundle groups.`,
                                                                });
                                                                setBatchSubmissionId(lastSubId);
                                                                setShowBatchProgress(true);
                                                                setBulkRecipients([{ id: '1', phone: '', bundleId: '' }]);
                                                            } else {
                                                                toast({
                                                                    title: 'Submission Failed',
                                                                    description: 'Could not submit any bulk orders.',
                                                                    variant: 'destructive',
                                                                });
                                                            }
                                                        }
                                                    } catch (err: any) {
                                                        console.error('Bulk order submission error:', err);
                                                        toast({
                                                            title: 'Error',
                                                            description: err.message || 'An unexpected error occurred.',
                                                            variant: 'destructive',
                                                        });
                                                    } finally {
                                                        setSubmittingBulk(false);
                                                    }
                                                }}
                                            >
                                                {submittingBulk ? (
                                                    <>
                                                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                                        Submitting...
                                                    </>
                                                ) : (
                                                    `Place Bulk Order (${bulkRecipients.length} recipients)`
                                                )}
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Excel Upload section */}
                            {subTab === 'excel' && (
                                <Card className="border-dashed border-primary/40 bg-card/20 backdrop-blur-sm">
                                    <CardHeader className="pb-4">
                                        <div className="flex items-center justify-between">
                                            <CardTitle className="text-lg flex items-center gap-2">
                                                <div className={cn("p-2 rounded-lg bg-opacity-20", config.bgColor, config.textColor)}>
                                                    <FileSpreadsheet className="w-5 h-5" />
                                                </div>
                                                Excel Upload Order
                                            </CardTitle>
                                            <div className="flex gap-2">
                                                <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={() => downloadTemplate('simple')}>
                                                    <Download className="w-3.5 h-3.5" />
                                                    Simple Template
                                                </Button>
                                                <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={() => downloadTemplate('full')}>
                                                    <Download className="w-3.5 h-3.5" />
                                                    Full Template
                                                </Button>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="pt-6">
                                        <div
                                            className={cn(
                                                "border-2 border-dashed border-border/50 rounded-2xl p-12 text-center transition-all",
                                                "hover:border-primary/50 hover:bg-primary/5 cursor-pointer"
                                            )}
                                            onDragOver={(e) => e.preventDefault()}
                                            onDrop={(e) => {
                                                e.preventDefault();
                                                const file = e.dataTransfer.files[0];
                                                if (file) {
                                                    setExcelFile(file);
                                                    parseExcelFile(file);
                                                }
                                            }}
                                            onClick={() => document.getElementById('excel-upload')?.click()}
                                        >
                                            <input
                                                type="file"
                                                id="excel-upload"
                                                className="hidden"
                                                accept=".xlsx,.xls,.csv"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                        setExcelFile(file);
                                                        parseExcelFile(file);
                                                    }
                                                }}
                                            />
                                            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 text-primary">
                                                <Upload className="w-8 h-8" />
                                            </div>
                                            <h3 className="text-xl font-bold mb-2">
                                                {excelFile ? excelFile.name : 'Upload Excel or CSV File'}
                                            </h3>
                                            <p className="text-muted-foreground mb-6">
                                                {excelFile
                                                    ? `${excelParsedData.length} valid recipients parsed`
                                                    : 'Drag and drop your file here, or click to browse'}
                                            </p>
                                            {!excelFile && (
                                                <Button className="font-semibold px-8">
                                                    Choose File
                                                </Button>
                                            )}

                                            <div className="mt-8 flex flex-wrap justify-center gap-4 text-xs">
                                                <span className="text-muted-foreground uppercase tracking-wider font-bold">Supported formats:</span>
                                                <div className="flex gap-2">
                                                    <span className="px-2 py-1 bg-yellow-400/10 text-yellow-600 rounded-md border border-yellow-400/20">
                                                        Simple: Recipient, Volume
                                                    </span>
                                                    <span className="px-2 py-1 bg-primary/10 text-primary rounded-md border border-primary/20">
                                                        Full: Beneficiary Msisdn, Data (MB)
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Parse Error */}
                                        {excelParseError && (
                                            <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm">
                                                <strong>Parse Error:</strong> {excelParseError}
                                            </div>
                                        )}

                                        {/* Parsed Data Preview */}
                                        {excelParsedData.length > 0 && (
                                            <div className="mt-6 space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <h4 className="font-semibold text-sm">Preview ({excelParsedData.length} recipients)</h4>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-xs text-muted-foreground hover:text-destructive"
                                                        onClick={() => {
                                                            setExcelFile(null);
                                                            setExcelParsedData([]);
                                                            setExcelParseError(null);
                                                        }}
                                                    >
                                                        <XCircle className="w-3.5 h-3.5 mr-1" /> Clear
                                                    </Button>
                                                </div>
                                                <div className="max-h-60 overflow-y-auto rounded-xl border border-border/50">
                                                    <table className="w-full text-sm">
                                                        <thead className="bg-muted/50 sticky top-0">
                                                            <tr>
                                                                <th className="text-left px-4 py-2 font-semibold text-muted-foreground">#</th>
                                                                <th className="text-left px-4 py-2 font-semibold text-muted-foreground">Phone</th>
                                                                <th className="text-left px-4 py-2 font-semibold text-muted-foreground">Data Amount</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {excelParsedData.slice(0, 50).map((row, idx) => (
                                                                <tr key={idx} className="border-t border-border/30">
                                                                    <td className="px-4 py-2 text-muted-foreground font-mono text-xs">{idx + 1}</td>
                                                                    <td className="px-4 py-2 font-medium">{row.phone}</td>
                                                                    <td className="px-4 py-2">
                                                                        {row.dataAmount ? (
                                                                            <span className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs font-semibold">
                                                                                {row.dataAmount}
                                                                            </span>
                                                                        ) : (
                                                                            <span className="text-muted-foreground text-xs">Default ({bundles[0]?.data_amount || 'N/A'})</span>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                            {excelParsedData.length > 50 && (
                                                                <tr className="border-t border-border/30">
                                                                    <td colSpan={3} className="px-4 py-3 text-center text-muted-foreground text-sm">
                                                                        ...and {excelParsedData.length - 50} more recipients
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </tbody>
                                                    </table>
                                                </div>

                                                <Button
                                                    className={cn(
                                                        "w-full h-14 text-lg font-bold text-white shadow-lg transition-all duration-300",
                                                        `gradient-${networkKey} hover:brightness-110 shadow-${networkKey}/20`
                                                    )}
                                                    disabled={submittingExcel}
                                                    onClick={submitExcelOrder}
                                                >
                                                    {submittingExcel ? (
                                                        <>
                                                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                                            Submitting {excelParsedData.length} recipients...
                                                        </>
                                                    ) : (
                                                        `Process Excel Order (${excelParsedData.length} recipients)`
                                                    )}
                                                </Button>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    )
                ) : (
                    <Card className="p-12 text-center border-dashed border-2 border-border/50 bg-muted/20">
                        <div className="flex flex-col items-center gap-4">
                            <div className="p-4 rounded-full bg-muted">
                                <XCircle className="w-10 h-10 text-muted-foreground" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold">No Bundles Available</h3>
                                <p className="text-muted-foreground mt-1">We couldn't find any data bundles for {networkName} at the moment.</p>
                            </div>
                            <Button variant="outline" onClick={fetchBundles} className="mt-4 gap-2">
                                <RefreshCw className="w-4 h-4" />
                                Try Again
                            </Button>
                        </div>
                    </Card>
                )}
            </div>

            {/* Purchase Modal */}
            <Dialog open={showModal} onOpenChange={setShowModal}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Complete Purchase</DialogTitle>
                        <DialogDescription>
                            Enter the phone number to receive the data bundle
                        </DialogDescription>
                    </DialogHeader>

                    {selectedBundle && (
                        <div className="space-y-6">
                            <div className="bg-muted rounded-lg p-4">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-muted-foreground">Network</span>
                                    <span className="font-semibold">{selectedBundle.network}</span>
                                </div>
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-muted-foreground">Data</span>
                                    <span className="font-semibold">{selectedBundle.data_amount}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">Price</span>
                                    <div className="text-right">
                                        <span className={cn("font-display text-xl font-bold", config.textColor)}>
                                            GH₵{getPrice(selectedBundle).toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="recipient">Recipient Phone Number</Label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                                    <Input
                                        id="recipient"
                                        type="tel"
                                        placeholder="e.g. 0241234567"
                                        value={recipientPhone}
                                        onChange={(e) => setRecipientPhone(e.target.value)}
                                        className="pl-10"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Select Payment Method</Label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setPaymentMethod('wallet')}
                                        className={cn(
                                            "flex flex-col items-center justify-center p-3 rounded-lg border-2 text-center transition-all bg-[#0f172a]/40",
                                            paymentMethod === 'wallet'
                                                ? "border-emerald-500 text-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.15)] bg-emerald-500/5"
                                                : "border-slate-700/60 hover:border-slate-600 text-slate-400"
                                        )}
                                    >
                                        <Wallet className="w-5 h-5 mb-1.5" />
                                        <span className="text-xs font-bold">Wallet Balance</span>
                                        <span className="text-[10px] opacity-80 mt-0.5">GHS {walletBalance.toFixed(2)}</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPaymentMethod('paystack')}
                                        className={cn(
                                            "flex flex-col items-center justify-center p-3 rounded-lg border-2 text-center transition-all bg-[#0f172a]/40",
                                            paymentMethod === 'paystack'
                                                ? "border-blue-500 text-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.15)] bg-blue-500/5"
                                                : "border-slate-700/60 hover:border-slate-600 text-slate-400"
                                        )}
                                    >
                                        <CreditCard className="w-5 h-5 mb-1.5" />
                                        <span className="text-xs font-bold">Paystack Card</span>
                                        <span className="text-[10px] opacity-80 mt-0.5">Direct Checkout</span>
                                    </button>
                                </div>
                            </div>

                            <Button
                                onClick={processPurchase}
                                className={cn(
                                    "w-full transition-all duration-300 shadow-xl text-white font-bold h-12 text-base",
                                    paymentMethod === 'wallet'
                                        ? `gradient-${networkKey} hover:brightness-110 shadow-${networkKey}/20`
                                        : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:brightness-110 shadow-blue-500/20"
                                )}
                                size="lg"
                                disabled={purchasing || !recipientPhone}
                            >
                                {purchasing ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                        Processing...
                                    </>
                                ) : paymentMethod === 'wallet' ? (
                                    `Pay GH₵${getPrice(selectedBundle).toFixed(2)} via Wallet`
                                ) : (
                                    `Pay GH₵${getPrice(selectedBundle).toFixed(2)} via Paystack`
                                )}
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Batch Progress Modal */}
            <BatchProgressModal
                submissionId={batchSubmissionId}
                open={showBatchProgress}
                onClose={() => setShowBatchProgress(false)}
            />
        </div>
    );
}
