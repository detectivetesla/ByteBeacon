const { getOrderById } = require('../integrations/datahouse');

async function testGetOrder() {
    const res1 = await getOrderById('ord_01M00RFSBKGQ0P3GKSH4Q0ZJMV');
    console.log('Get order by ID result:\n', JSON.stringify(res1, null, 2));

    const res2 = await getOrderById('TXN-2C2AB30FFC8D');
    console.log('\nGet order by Reference result:\n', JSON.stringify(res2, null, 2));

    process.exit(0);
}

testGetOrder();
