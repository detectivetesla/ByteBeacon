/**
 * Export utility functions for generating CSV, Excel (.xls/.xlsx), and JSON exports
 */

export interface ExportOptions {
    filename: string;
    format: 'csv' | 'excel' | 'xlsx' | 'json';
    sheetName?: string;
}

export interface ActivityLogExportRow {
    id?: string;
    userName?: string;
    userEmail?: string;
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
 * Escape special XML characters for Excel Spreadsheet XML
 */
function escapeXml(unsafe: string): string {
    return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
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
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#10B981" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#059669"/>
   </Borders>
  </Style>
  <Style ss:ID="Default">
   <Font ss:FontName="Calibri" ss:Size="11"/>
   <Alignment ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="Number">
   <Font ss:FontName="Calibri" ss:Size="11"/>
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <NumberFormat ss:Format="#,##0.00"/>
  </Style>
  <Style ss:ID="Date">
   <Font ss:FontName="Calibri" ss:Size="11"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="${escapeXml(sheetName)}">
  <Table>
   <Row ss:Height="24">`;

    headers.forEach(h => {
        xml += `\n    <Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`;
    });
    xml += `\n   </Row>`;

    data.forEach(item => {
        xml += `\n   <Row ss:Height="20">`;
        headers.forEach(h => {
            const value = item[h];
            if (typeof value === 'number') {
                xml += `\n    <Cell ss:StyleID="Number"><Data ss:Type="Number">${value}</Data></Cell>`;
            } else if (value === null || value === undefined) {
                xml += `\n    <Cell ss:StyleID="Default"><Data ss:Type="String"></Data></Cell>`;
            } else {
                const strVal = String(value);
                // Check if string looks like date
                const style = /^\d{4}-\d{2}-\d{2}/.test(strVal) || strVal.includes(', 202') ? 'Date' : 'Default';
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
 * Convert an array of objects to CSV format with UTF-8 BOM
 */
function arrayToCSV(data: Record<string, unknown>[]): string {
    if (data.length === 0) return '\uFEFF';

    const headers = Object.keys(data[0]);
    const headerRow = headers.map(h => `"${h.replace(/"/g, '""')}"`).join(',');

    const dataRows = data.map(item =>
        headers.map(header => {
            const value = item[header];
            if (typeof value === 'string') {
                return `"${value.replace(/"/g, '""')}"`;
            }
            if (value instanceof Date) {
                return `"${value.toISOString()}"`;
            }
            if (value === null || value === undefined) {
                return '""';
            }
            return String(value);
        }).join(',')
    );

    // Add UTF-8 BOM (\uFEFF) so Excel opens CSV files with proper encoding
    return '\uFEFF' + [headerRow, ...dataRows].join('\n');
}

/**
 * Download content as a file
 */
function downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Helper to execute download based on requested format
 */
function processDownload(formattedData: Record<string, unknown>[], options: ExportOptions): void {
    const timestamp = new Date().toISOString().split('T')[0];
    const fullFilename = `${options.filename}_${timestamp}`;
    const isExcel = options.format === 'excel' || options.format === 'xlsx';

    if (isExcel) {
        const xmlContent = arrayToExcelXML(formattedData, options.sheetName || options.filename);
        downloadFile(xmlContent, `${fullFilename}.xls`, 'application/vnd.ms-excel');
    } else if (options.format === 'csv') {
        const csvContent = arrayToCSV(formattedData);
        downloadFile(csvContent, `${fullFilename}.csv`, 'text/csv;charset=utf-8;');
    } else {
        const jsonContent = JSON.stringify(formattedData, null, 2);
        downloadFile(jsonContent, `${fullFilename}.json`, 'application/json');
    }
}

/**
 * Export Activity Logs data
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
            'Action': log.action || 'N/A',
            'Description': log.description || 'N/A',
            'IP Address': log.ipAddress || 'N/A',
            'Timestamp': log.createdAt ? new Date(log.createdAt).toLocaleString() : 'N/A'
        };
    });

    processDownload(formattedData, options);
}

/**
 * Export Users data
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
            'Joined Date': (u.created_at || u.createdAt) ? new Date((u.created_at || u.createdAt)!).toLocaleString() : 'N/A'
        };
    });

    processDownload(formattedData, options);
}

/**
 * Export Agents / Resellers data
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
            'Wallet Balance (GH₵)': a.wallet_balance ?? a.walletBalance ?? 0,
            'Total Orders': a.total_orders || 0,
            'Total Revenue (GH₵)': a.total_revenue || 0,
            'Created At': (a.created_at || a.createdAt) ? new Date((a.created_at || a.createdAt)!).toLocaleString() : 'N/A'
        };
    });

    processDownload(formattedData, options);
}

/**
 * Export Transactions data
 */
export function exportTransactions(
    transactions: unknown[],
    options: ExportOptions = { filename: 'transactions', format: 'csv' }
): void {
    const formattedData = transactions.map(txRow => {
        const tx = txRow as TransactionExportRow;
        const displayId = tx.serialId ? `ORD-${tx.serialId}` : (tx.id ? tx.id.slice(0, 12) : 'N/A');
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
            'Date Placed': (tx.created_at || tx.createdAt) ? new Date((tx.created_at || tx.createdAt)!).toLocaleString() : 'N/A',
            'Last Updated': tx.updatedAt ? new Date(tx.updatedAt).toLocaleString() : '—'
        };
    });

    processDownload(formattedData, options);
}

/**
 * Export Deposits data
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
            'Date': (dep.created_at || dep.createdAt) ? new Date((dep.created_at || dep.createdAt)!).toLocaleString() : 'N/A'
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
