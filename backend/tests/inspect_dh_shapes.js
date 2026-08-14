const { listOrders, listBeneficiaries } = require('../integrations/datahouse');

async function inspect() {
    const ordersRes = await listOrders({ limit: 2 });
    console.log('Orders response full shape:', JSON.stringify(ordersRes, null, 2));

    const benRes = await listBeneficiaries({ limit: 2 });
    console.log('Beneficiaries response full shape:', JSON.stringify(benRes, null, 2));

    process.exit(0);
}

inspect();
