/**
 * ByteBeacon Centralized Export Utility
 * Handles RFC 4180 CSV generation with UTF-8 BOM, Excel SpreadsheetML XML,
 * JSON serialization, spreadsheet formula injection sanitization, and response streaming headers.
 */

/**
 * Neutralize dangerous spreadsheet formulas to prevent CSV/Formula Injection attacks.
 * If a string begins with =, +, -, @, \t, or \r, prepend a single quote (') so spreadsheet
 * engines (Excel, Google Sheets, LibreOffice) treat it strictly as text literal.
 *
 * @param {unknown} value
 * @returns {unknown}
 */
function sanitizeFormulaInjection(value) {
    if (typeof value !== 'string') {
        return value;
    }

    const trimmed = value.trim();
    if (trimmed.length === 0) {
        return value;
    }

    // Dangerous formula prefixes
    const dangerousPrefixes = ['=', '+', '-', '@', '\t', '\r'];
    const firstChar = trimmed.charAt(0);

    // If it starts with a dangerous character and isn't purely a standard negative number
    if (dangerousPrefixes.includes(firstChar)) {
        // Allow pure negative numbers like -12.34 or -5
        if (firstChar === '-' && !isNaN(Number(trimmed))) {
            return value;
        }
        // Allow pure positive numbers with plus sign like +123
        if (firstChar === '+' && !isNaN(Number(trimmed))) {
            return value;
        }
        // Prepend single quote to neutralize formula execution in Excel/Sheets
        return `'${value}`;
    }

    return value;
}

/**
 * Escape XML entities for Excel Spreadsheet XML
 *
 * @param {string} unsafe
 * @returns {string}
 */
function escapeXml(unsafe) {
    if (unsafe === null || unsafe === undefined) return '';
    return String(unsafe)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * Format a cell value cleanly for CSV or Excel
 *
 * @param {unknown} value
 * @returns {string}
 */
function formatCellValue(value) {
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
 * Escape a CSV field according to RFC 4180
 *
 * @param {unknown} rawValue
 * @returns {string}
 */
function escapeCSVField(rawValue) {
    const sanitized = sanitizeFormulaInjection(rawValue);
    const text = formatCellValue(sanitized);

    // If field contains quotes, commas, or newlines, wrap in quotes and escape quotes
    if (text.includes('"') || text.includes(',') || text.includes('\n') || text.includes('\r')) {
        return `"${text.replace(/"/g, '""')}"`;
    }
    return `"${text}"`;
}

/**
 * Generate CSV string with UTF-8 BOM
 *
 * @param {Array<object>} rows - Array of objects
 * @param {Array<{ key: string, label: string, transform?: Function }>} columns - Column definitions
 * @returns {string}
 */
function generateCSV(rows, columns) {
    // If no explicit columns provided, derive from first row
    const cols = columns && columns.length > 0
        ? columns
        : (rows.length > 0 ? Object.keys(rows[0]).map(k => ({ key: k, label: k })) : []);

    const headerLine = cols.map(c => `"${c.label.replace(/"/g, '""')}"`).join(',');

    const dataLines = rows.map(row => {
        return cols.map(col => {
            let val;
            if (typeof col.transform === 'function') {
                val = col.transform(row);
            } else if (col.key && col.key.includes('.')) {
                const parts = col.key.split('.');
                val = row;
                for (const part of parts) {
                    val = val ? val[part] : undefined;
                }
            } else if (col.key) {
                val = row[col.key];
            }
            return escapeCSVField(val);
        }).join(',');
    });

    // Prepend UTF-8 BOM (\uFEFF) for Excel unicode compatibility
    return '\uFEFF' + [headerLine, ...dataLines].join('\r\n');
}

/**
 * Generate Excel XML (SpreadsheetML) compatible with Excel & LibreOffice
 *
 * @param {Array<object>} rows
 * @param {Array<{ key: string, label: string, transform?: Function }>} columns
 * @param {string} sheetName
 * @returns {string}
 */
function generateExcelXML(rows, columns, sheetName = 'Export') {
    const cols = columns && columns.length > 0
        ? columns
        : (rows.length > 0 ? Object.keys(rows[0]).map(k => ({ key: k, label: k })) : []);

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

    cols.forEach(c => {
        xml += `\n    <Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXml(c.label)}</Data></Cell>`;
    });
    xml += `\n   </Row>`;

    rows.forEach(row => {
        xml += `\n   <Row ss:Height="20">`;
        cols.forEach(col => {
            let val;
            if (typeof col.transform === 'function') {
                val = col.transform(row);
            } else if (col.key && col.key.includes('.')) {
                const parts = col.key.split('.');
                val = row;
                for (const part of parts) {
                    val = val ? val[part] : undefined;
                }
            } else if (col.key) {
                val = row[col.key];
            }

            const sanitized = sanitizeFormulaInjection(val);

            if (typeof sanitized === 'number' && !isNaN(sanitized)) {
                xml += `\n    <Cell ss:StyleID="Number"><Data ss:Type="Number">${sanitized}</Data></Cell>`;
            } else if (sanitized === null || sanitized === undefined) {
                xml += `\n    <Cell ss:StyleID="Default"><Data ss:Type="String"></Data></Cell>`;
            } else {
                const strVal = formatCellValue(sanitized);
                const isDate = /^\d{4}-\d{2}-\d{2}/.test(strVal);
                const styleId = isDate ? 'Date' : 'Default';
                xml += `\n    <Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeXml(strVal)}</Data></Cell>`;
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
 * Format JSON export safely
 *
 * @param {Array<object>} rows
 * @param {Array<{ key: string, label: string, transform?: Function }>} columns
 * @returns {string}
 */
function generateJSON(rows, columns) {
    const cols = columns && columns.length > 0 ? columns : null;

    if (!cols) {
        return JSON.stringify(rows, null, 2);
    }

    const transformed = rows.map(row => {
        const item = {};
        cols.forEach(col => {
            let val;
            if (typeof col.transform === 'function') {
                val = col.transform(row);
            } else if (col.key && col.key.includes('.')) {
                const parts = col.key.split('.');
                val = row;
                for (const part of parts) {
                    val = val ? val[part] : undefined;
                }
            } else if (col.key) {
                val = row[col.key];
            }
            item[col.label] = val !== undefined ? val : null;
        });
        return item;
    });

    return JSON.stringify(transformed, null, 2);
}

/**
 * Send HTTP export file response with headers
 *
 * @param {object} res - Express response object
 * @param {object} options
 * @param {Array<object>} options.data - Data rows
 * @param {Array<object>} options.columns - Column definitions
 * @param {string} options.filename - Base filename without extension
 * @param {'csv'|'excel'|'xlsx'|'json'} [options.format='csv'] - Output format
 * @param {string} [options.sheetName] - Sheet name for Excel
 */
function sendExportResponse(res, { data = [], columns = [], filename = 'export', format = 'csv', sheetName = 'Export' }) {
    const fmt = (format || 'csv').toLowerCase();
    const dateStr = new Date().toISOString().slice(0, 10);
    const sanitizedBase = filename.replace(/[^a-zA-Z0-9_-]/g, '_');
    const fullFilename = `${sanitizedBase}_${dateStr}`;

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    if (fmt === 'excel' || fmt === 'xlsx') {
        const xml = generateExcelXML(data, columns, sheetName);
        const buffer = Buffer.from(xml, 'utf8');
        res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${fullFilename}.xls"`);
        res.setHeader('Content-Length', buffer.length);
        return res.status(200).send(buffer);
    }

    if (fmt === 'json') {
        const jsonStr = generateJSON(data, columns);
        const buffer = Buffer.from(jsonStr, 'utf8');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${fullFilename}.json"`);
        res.setHeader('Content-Length', buffer.length);
        return res.status(200).send(buffer);
    }

    // Default: CSV
    const csv = generateCSV(data, columns);
    const buffer = Buffer.from(csv, 'utf8');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fullFilename}.csv"`);
    res.setHeader('Content-Length', buffer.length);
    return res.status(200).send(buffer);
}

module.exports = {
    sanitizeFormulaInjection,
    escapeXml,
    formatCellValue,
    escapeCSVField,
    generateCSV,
    generateExcelXML,
    generateJSON,
    sendExportResponse
};
