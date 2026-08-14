const { getBundles } = require('../integrations/datahouse');

async function checkBundles() {
    const networks = ['MTN', 'TELECEL', 'AIRTELTIGO'];
    for (const net of networks) {
        const res = await getBundles({ network: net, type: 'data', refresh: true, limit: 50 });
        console.log(`\nNetwork: ${net} | Found: ${res.bundles?.length} bundles`);
        if (res.bundles) {
            res.bundles.forEach(b => {
                console.log(`  - [${b.id}] ${b.network} ${b.dataVolume} (DataHouse Agent Cost: GH₵ ${b.agentAmount}, Selling: GH₵ ${b.amount})`);
            });
        }
    }
    process.exit(0);
}

checkBundles();
