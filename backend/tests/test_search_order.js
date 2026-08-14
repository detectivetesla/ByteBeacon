const { listOrders } = require('../integrations/datahouse');

async function testSearchOrder() {
    const res = await listOrders({ search: 'TXN-2C2AB30FFC8D' });
    console.log('Search order by reference result:\n', JSON.stringify(res, null, 2));
    process.exit(0);
}

testSearchOrder();
