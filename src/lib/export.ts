/**
 * ByteBeacon Export System
 * Centralized, hardened export library supporting direct backend API streaming
 * and client-side data conversion (CSV with UTF-8 BOM, Excel SpreadsheetML, JSON)
 * with robust spreadsheet formula injection protection.
 */

import { getToken, API_BASE_URL } from '@/services/api';

export interface ExportOptions {
    filename: string;
    format: 'csv' | 'excel' | 'xlsx' | 'json';
    sheetName?: string;
}

export interface ActivityLogExportRow {
    id?: string;
    userName?: string;
    userEmail?: string;
    userRole?: string;
    action?: string;
    description?: string;
    ipAddress?: string;
    createdAt?: string;
}

export interface UserExportRow {
    id?: string;
    full_name?: string;
    fullName?: string;
    email?: string;
    phone?: string;
    role?: string;
    isActive?: boolean;
    created_at?: string;
    createdAt?: string;
    walletBalance?: number;
    wallet_balance?: number;
    store_name?: string;
    store_status?: string;
}

export interface TransactionExportRow {
    id?: string;
    recipient_phone?: string;
    recipientPhone?: string;
    amount_ghc?: number | string;
    amount?: number | string;
    status?: string;
    created_at?: string;
    createdAt?: string;
    updatedAt?: string;
    paystack_reference?: string;
    serialId?: number;
    user_name?: string;
    userName?: string;
    user_email?: string;
    userEmail?: string;
    network?: string;
    data_amount?: string;
    dataAmount?: string;
    source?: string;
    paid?: string;
    sourceProvider?: string;
    balanceBefore?: number | null;
    balanceAfter?: number | null;
    data_bundles?: {
        network: string;
        data_amount: string;
    };
}

export interface DepositExportRow {
    id?: string;
    amount?: number | string;
    method?: string;
    status?: string;
    reference?: string;
    created_at?: string;
    createdAt?: string;
}

export interface OrderExportRow extends TransactionExportRow {}

export interface AgentExportRow extends UserExportRow {
    total_orders?: number;
    total_revenue?: number;
}

/**
 * Neutralize dangerous spreadsheet formulas to prevent CSV/Formula Injection attacks.
 * Prepends a single quote (') to strings starting with '=', '+', '-', '@', '\t', '\r'.
 */
export function sanitizeFormulaInjection(value: unknown): unknown {
    if (typeof value !== 'string') {
        return value;
    }

    const trimmed = value.trim();
    if (trimmed.length === 0) {
        return value;
    }

    const dangerousPrefixes = ['=', '+', '-', '@', '\t', '\r'];
    const firstChar = trimmed.charAt(0);

    if (dangerousPrefixes.includes(firstChar)) {
        // Allow pure numbers (e.g. -12.5 or +233)
        if ((firstChar === '-' || firstChar === '+') && !isNaN(Number(trimmed))) {
            return value;
        }
        return `'${value}`;
    }

    return value;
}

/**
 * Escape special XML characters for Excel Spreadsheet XML
 */
function escapeXml(unsafe: unknown): string {
    if (unsafe === null || unsafe === undefined) return '';
    return String(unsafe)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * Format a cell value cleanly
 */
function formatCellValue(value: unknown): string {
    if (value === null || value === undefined) {
        return '';
    }
    if (value instanceof Date) {
        return value.toISOString();
    }
    if (Array.isArray(value)) {
        return value.map(v => (typeof v === 'object' ? JSON.stringify(v) : String(v))).join('; ');
    }
    if (typeof value === 'object') {
        try {
            return JSON.stringify(value);
        } catch {
            return String(value);
        }
    }
    return String(value);
}

/**
 * Convert an array of objects to Excel XML Spreadsheet format (.xls / .xlsx)
 */
function arrayToExcelXML(data: Record<string, unknown>[], sheetName = 'Export'): string {
    if (data.length === 0) {
        return `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="${escapeXml(sheetName)}"><Table></Table></Worksheet></Workbook>`;
    }

    const headers = Object.keys(data[0]);

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Title>${escapeXml(sheetName)}</Title>
  <Created>${new Date().toISOString()}</Created>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Header">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#0F172A" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#334155"/>
   </Borders>
  </Style>
  <Style ss:ID="Default">
   <Font ss:FontName="Segoe UI" ss:Size="10"/>
   <Alignment ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="Number">
   <Font ss:FontName="Segoe UI" ss:Size="10"/>
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <NumberFormat ss:Format="#,##0.00"/>
  </Style>
  <Style ss:ID="Date">
   <Font ss:FontName="Segoe UI" ss:Size="10"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="${escapeXml(sheetName.slice(0, 31))}">
  <Table>
   <Row ss:Height="24">`;

    headers.forEach(h => {
        xml += `\n    <Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`;
    });
    xml += `\n   </Row>`;

    data.forEach(item => {
        xml += `\n   <Row ss:Height="20">`;
        headers.forEach(h => {
            const rawVal = item[h];
            const sanitized = sanitizeFormulaInjection(rawVal);

            if (typeof sanitized === 'number' && !isNaN(sanitized)) {
                xml += `\n    <Cell ss:StyleID="Number"><Data ss:Type="Number">${sanitized}</Data></Cell>`;
            } else if (sanitized === null || sanitized === undefined) {
                xml += `\n    <Cell ss:StyleID="Default"><Data ss:Type="String"></Data></Cell>`;
            } else {
                const strVal = formatCellValue(sanitized);
                const isDate = /^\d{4}-\d{2}-\d{2}/.test(strVal) || strVal.includes(', 202');
                const style = isDate ? 'Date' : 'Default';
                xml += `\n    <Cell ss:StyleID="${style}"><Data ss:Type="String">${escapeXml(strVal)}</Data></Cell>`;
            }
        });
        xml += `\n   </Row>`;
    });

    xml += `\n  </Table>
 </Worksheet>
</Workbook>`;

    return xml;
}

/**
 * Convert an array of objects to CSV format with RFC 4180 escaping and UTF-8 BOM
 */
function arrayToCSV(data: Record<string, unknown>[]): string {
    if (data.length === 0) return '\uFEFF';

    const headers = Object.keys(data[0]);
    const headerRow = headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(',');

    const dataRows = data.map(item =>
        headers.map(header => {
            const rawValue = item[header];
            const sanitized = sanitizeFormulaInjection(rawValue);
            const text = formatCellValue(sanitized);

            if (text.includes('"') || text.includes(',') || text.includes('\n') || text.includes('\r')) {
                return `"${text.replace(/"/g, '""')}"`;
            }
            return `"${text}"`;
        }).join(',')
    );

    // UTF-8 BOM (\uFEFF) for Excel unicode compatibility
    return '\uFEFF' + [headerRow, ...dataRows].join('\r\n');
}

/**
 * Download text/blob content as a file with automatic URL revocation
 */
export function downloadFile(content: string | Blob, filename: string, mimeType: string): void {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    try {
        link.click();
    } finally {
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 500);
    }
}

/**
 * Download export directly from a backend API endpoint with auth and error extraction
 */
export async function exportViaApi(
    endpoint: string,
    params: Record<string, any> = {},
    defaultFilename: string = 'export'
): Promise<{ success: boolean; filename: string }> {
    const token = getToken();
    const queryParams = new URLSearchParams();

    Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
            queryParams.append(key, String(val));
        }
    });

    const queryString = queryParams.toString();
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${API_BASE_URL}${cleanEndpoint}${queryString ? `?${queryString}` : ''}`;

    const headers: HeadersInit = {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
    };

    const response = await fetch(url, { headers });

    if (!response.ok) {
        let errorMessage = `Server returned HTTP ${response.status} (${response.statusText})`;
        try {
            const errJson = await response.json();
            if (errJson && (errJson.error || errJson.message)) {
                errorMessage = errJson.error || errJson.message;
            }
        } catch {
            // Non-JSON error body (e.g. HTML proxy error)
        }

        if (response.status === 401) {
            errorMessage = 'Your session has expired. Please sign in again to export.';
        } else if (response.status === 403) {
            errorMessage = 'You do not have permission to export this dataset.';
        } else if (response.status === 429) {
            errorMessage = 'Export rate limit reached. Please wait a few moments before trying again.';
        }

        throw new Error(errorMessage);
    }

    // Determine filename from Content-Disposition header if available
    let resolvedFilename = defaultFilename;
    const contentDisposition = response.headers.get('Content-Disposition') || response.headers.get('content-disposition');
    if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^";]+)"?/i);
        if (match && match[1]) {
            resolvedFilename = match[1].trim();
        }
    }

    const contentType = response.headers.get('Content-Type') || response.headers.get('content-type') || 'application/octet-stream';
    const blob = await response.blob();

    downloadFile(blob, resolvedFilename, contentType);
    return { success: true, filename: resolvedFilename };
}

/**
 * Execute client-side download based on requested format
 */
function processDownload(formattedData: Record<string, unknown>[], options: ExportOptions): void {
    const timestamp = new Date().toISOString().split('T')[0];
    const fullFilename = `${options.filename}_${timestamp}`;
    const isExcel = options.format === 'excel' || options.format === 'xlsx';

    if (isExcel) {
        const xmlContent = arrayToExcelXML(formattedData, options.sheetName || options.filename);
        downloadFile(xmlContent, `${fullFilename}.xls`, 'application/vnd.ms-excel;charset=utf-8;');
    } else if (options.format === 'csv') {
        const csvContent = arrayToCSV(formattedData);
        downloadFile(csvContent, `${fullFilename}.csv`, 'text/csv;charset=utf-8;');
    } else {
        const jsonContent = JSON.stringify(formattedData, null, 2);
        downloadFile(jsonContent, `${fullFilename}.json`, 'application/json;charset=utf-8;');
    }
}

/**
 * Export Activity Logs data (Client-side fallback)
 */
export function exportActivityLogs(
    logs: unknown[],
    options: ExportOptions = { filename: 'activity_logs', format: 'csv' }
): void {
    const formattedData = logs.map(logRow => {
        const log = logRow as ActivityLogExportRow;
        return {
            'Log ID': log.id || 'N/A',
            'User Name': log.userName || 'N/A',
            'User Email': log.userEmail || 'N/A',
            'User Role': log.userRole || 'N/A',
            'Action': log.action || 'N/A',
            'Description': log.description || 'N/A',
            'IP Address': log.ipAddress || 'N/A',
            'Timestamp': log.createdAt ? new Date(log.createdAt).toISOString() : 'N/A'
        };
    });

    processDownload(formattedData, options);
}

/**
 * Export Users data (Client-side fallback)
 */
export function exportUsers(
    users: unknown[],
    options: ExportOptions = { filename: 'users_list', format: 'csv' }
): void {
    const formattedData = users.map(userRow => {
        const u = userRow as UserExportRow;
        return {
            'User ID': u.id || 'N/A',
            'Full Name': u.full_name || u.fullName || 'N/A',
            'Email': u.email || 'N/A',
            'Phone': u.phone || 'N/A',
            'Role': u.role || 'customer',
            'Status': u.isActive !== false ? 'Active' : 'Suspended',
            'Wallet Balance (GH₵)': u.walletBalance ?? u.wallet_balance ?? 0,
            'Store Name': u.store_name || 'N/A',
            'Store Status': u.store_status || 'N/A',
            'Joined Date': (u.created_at || u.createdAt) ? new Date((u.created_at || u.createdAt)!).toISOString() : 'N/A'
        };
    });

    processDownload(formattedData, options);
}

/**
 * Export Agents data (Client-side fallback)
 */
export function exportAgents(
    agents: unknown[],
    options: ExportOptions = { filename: 'agents_list', format: 'csv' }
): void {
    const formattedData = agents.map(agentRow => {
        const a = agentRow as AgentExportRow;
        return {
            'Agent ID': a.id || 'N/A',
            'Full Name': a.full_name || a.fullName || 'N/A',
            'Email': a.email || 'N/A',
            'Phone': a.phone || 'N/A',
            'Role': a.role || 'agent',
            'Store Name': a.store_name || 'N/A',
            'Wallet Balance (GH₵)': a.wallet_balance ?? a.walletBalance ?? 0,
            'Total Orders': a.total_orders || 0,
            'Total Revenue (GH₵)': a.total_revenue || 0,
            'Created At': (a.created_at || a.createdAt) ? new Date((a.created_at || a.createdAt)!).toISOString() : 'N/A'
        };
    });

    processDownload(formattedData, options);
}

/**
 * Export Transactions data (Client-side fallback)
 */
export function exportTransactions(
    transactions: unknown[],
    options: ExportOptions = { filename: 'transactions', format: 'csv' }
): void {
    const formattedData = transactions.map(txRow => {
        const tx = txRow as TransactionExportRow;
        const displayId = tx.serialId ? `ORD-${tx.serialId}` : (tx.id ? `ORD-${tx.id.slice(0, 8).toUpperCase()}` : 'N/A');
        return {
            'Order ID': displayId,
            'Full ID': tx.id || 'N/A',
            'Customer Name': tx.user_name || tx.userName || 'Unknown',
            'Customer Email': tx.user_email || tx.userEmail || 'N/A',
            'Recipient Phone': tx.recipient_phone || tx.recipientPhone || 'N/A',
            'Network': tx.network || tx.data_bundles?.network || 'N/A',
            'Bundle Size': tx.data_amount || tx.dataAmount || tx.data_bundles?.data_amount || 'N/A',
            'Amount (GH₵)': tx.amount_ghc ?? tx.amount ?? 0,
            'Status': tx.status || 'N/A',
            'Source': tx.source || 'web',
            'Paid': tx.paid || 'yes',
            'Sourcing Provider': tx.sourceProvider || 'N/A',
            'Bal. Before (GH₵)': tx.balanceBefore ?? '—',
            'Bal. After (GH₵)': tx.balanceAfter ?? '—',
            'Date Placed': (tx.created_at || tx.createdAt) ? new Date((tx.created_at || tx.createdAt)!).toISOString() : 'N/A',
            'Last Updated': tx.updatedAt ? new Date(tx.updatedAt).toISOString() : '—'
        };
    });

    processDownload(formattedData, options);
}

/**
 * Export Deposits data (Client-side fallback)
 */
export function exportDeposits(
    deposits: unknown[],
    options: ExportOptions = { filename: 'deposits', format: 'csv' }
): void {
    const formattedData = deposits.map(depRow => {
        const dep = depRow as DepositExportRow;
        return {
            'Deposit ID': dep.id || 'N/A',
            'Reference': dep.reference || 'N/A',
            'Amount (GH₵)': dep.amount || 0,
            'Method': dep.method || 'Paystack',
            'Status': dep.status || 'N/A',
            'Date': (dep.created_at || dep.createdAt) ? new Date((dep.created_at || dep.createdAt)!).toISOString() : 'N/A'
        };
    });

    processDownload(formattedData, options);
}

/**
 * Export Orders data
 */
export function exportOrders(
    orders: unknown[],
    options: ExportOptions = { filename: 'orders', format: 'csv' }
): void {
    exportTransactions(orders, { ...options, filename: options.filename || 'orders' });
}

/**
 * Generic export function using custom headers mapping
 */
export function exportData(
    data: unknown[],
    headers: { key: string; label: string }[],
    options: ExportOptions
): void {
    const formattedData = data.map(item => {
        const formatted: Record<string, unknown> = {};
        headers.forEach(({ key, label }) => {
            const keys = key.split('.');
            let value: unknown = item;
            for (const k of keys) {
                value = (value as Record<string, unknown>)?.[k];
            }
            formatted[label] = value ?? 'N/A';
        });
        return formatted;
    });

    processDownload(formattedData, options);
}
