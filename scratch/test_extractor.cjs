const datahouse = require('../backend/utils/datahouse');

const apiResponse = {
  "data": {
    "id": "74ab2c02-d0a7-48ae-bb56-f361fdea341a",
    "email": "orders@bytebeacon.com",
    "amount": "28.40",
    "status": "received",
    "userId": "c4c17641-b335-450b-9ae8-ad9e08cd1c29",
    "agentId": "d4e31537-cef9-436d-811e-df28e845e793",
    "channel": "agent_api",
    "network": "TELECEL",
    "bundleId": "75dbbc08-6609-4ca3-9ce1-eab139fded46",
    "lockedAt": null,
    "lockedBy": null,
    "publicId": "ord_01KWF9SVQVATHAHYVQH75QG95P",
    "createdAt": "2026-07-01T16:57:09.111Z",
    "deletedAt": null,
    "isSandbox": false,
    "updatedAt": "2026-07-01T16:57:09.111Z",
    "approvedAt": null,
    "approvedBy": null,
    "bundleType": "data",
    "exportedAt": null,
    "exportedBy": null,
    "phoneNumber": "0502397452",
    "referenceCode": "TXN-6E9ABDA72C2E",
    "idempotencyKey": "7256654c-9871-4f34-a1bb-666fdc0be545",
    "whatsappSender": null,
    "productCategory": "data_bundle"
  },
  "message": "Order placed and queued for processing.",
  "success": true,
  "statusCode": 201
};

const extracted = datahouse.extractProviderId(apiResponse, "7256654c-9871-4f34-a1bb-666fdc0be545", "0502397452");
console.log("EXTRACTED IDENTIFIER:", extracted);
if (extracted === "ord_01KWF9SVQVATHAHYVQH75QG95P") {
  console.log("SUCCESS! Correct publicId extracted.");
} else {
  console.log("FAILURE! Extracted:", extracted);
}
