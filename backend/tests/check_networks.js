const { getBundles } = require('../integrations/datahouse');

async function checkAt() {
    const resAll = await getBundles({ type: 'data', refresh: true, limit: 100 });
    const networks = new Set(resAll.bundles?.map(b => b.network));
    console.log('All unique networks on DataHouse:', Array.from(networks));
    process.exit(0);
}

checkAt();
