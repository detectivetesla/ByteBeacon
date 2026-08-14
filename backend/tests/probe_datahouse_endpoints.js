const datahouse = require('../integrations/datahouse');
const { getBundles, listOrders, listBeneficiaries, getWalletBalance, getAgentProfile } = datahouse;

async function probe() {
    console.log('--- Probing DataHouse Endpoints directly ---\n');

    // 1. Profile
    console.log('1. Profile (/agent/me):');
    const profile = await getAgentProfile();
    console.log('Profile result:', profile);

    // 2. Wallet
    console.log('\n2. Wallet (/agent/wallet/balance):');
    const wallet = await getWalletBalance();
    console.log('Wallet result:', wallet);

    // 3. Bundles with type=data
    console.log('\n3. Bundles (/agent/bundles?type=data):');
    const bundlesData = await getBundles({ type: 'data', refresh: true, limit: 5 });
    console.log('Bundles (type=data) result:', bundlesData.ok, 'Count:', bundlesData.bundles?.length, 'Sample:', bundlesData.bundles?.[0]);

    // 4. Bundles with network=MTN
    console.log('\n4. Bundles (/agent/bundles?network=MTN&type=data):');
    const mtnBundles = await getBundles({ network: 'MTN', type: 'data', refresh: true, limit: 5 });
    console.log('MTN Bundles result:', mtnBundles.ok, 'Count:', mtnBundles.bundles?.length, 'Sample:', mtnBundles.bundles?.[0]);

    // 5. Orders (/agent/orders)
    console.log('\n5. Orders (/agent/orders):');
    const orders = await listOrders({ limit: 5 });
    console.log('Orders result:', orders.ok, 'Count:', orders.orders?.length || orders.items?.length, 'Sample:', (orders.orders || orders.items)?.[0]);

    // 6. Beneficiaries (/agent/beneficiaries)
    console.log('\n6. Beneficiaries (/agent/beneficiaries):');
    const beneficiaries = await listBeneficiaries({ network: 'MTN', status: 'pending', limit: 5 });
    console.log('Beneficiaries result:', beneficiaries.ok, 'Count:', beneficiaries.beneficiaries?.length || beneficiaries.items?.length, 'Sample:', (beneficiaries.beneficiaries || beneficiaries.items)?.[0]);

    process.exit(0);
}

probe().catch(e => {
    console.error('Probe fatal error:', e);
    process.exit(1);
});
