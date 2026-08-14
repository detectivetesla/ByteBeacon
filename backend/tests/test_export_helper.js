const { generateCSV, generateExcelXML, generateJSON } = require('../utils/exportHelper');

async function testExportHelper() {
    const data = [
        { phone: '0541234567', network: 'MTN', status: 'pending' },
        { phone: '0559876543', network: 'MTN', status: 'approved' }
    ];
    const columns = [
        { key: 'phone', label: 'Phone Number' },
        { key: 'network', label: 'Network' },
        { key: 'status', label: 'Status' }
    ];

    try {
        const csv = generateCSV(data, columns);
        console.log('CSV Export Length:', csv.length);
        console.log('CSV Content:\n', csv);
        const xml = generateExcelXML(data, columns, 'TestSheet');
        console.log('Excel XML Export Length:', xml.length);
        const json = generateJSON(data, columns);
        console.log('JSON Export Length:', json.length);
        console.log('✅ Export helper generation works perfectly!');
    } catch (e) {
        console.error('❌ Export helper error:', e.message);
    }
    process.exit(0);
}

testExportHelper();
