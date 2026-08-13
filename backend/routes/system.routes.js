const express = require('express');
const router = express.Router();
const { getMaintenanceStatus, processWorker, cronSync, getSystemConfig, getPortalStatus, beneficiaryPrecheck, getDataHouseDiagnostics } = require('../controllers/system.controller');

// Public route to check maintenance status
router.get('/maintenance', getMaintenanceStatus);

// Public route to check portal and queue processing status
router.get('/portal-status', getPortalStatus);

// Public route to get public system configuration
router.get('/config', getSystemConfig);

// Public route for MTN beneficiary pre-check (Up2U rule)
router.post('/beneficiary-precheck', beneficiaryPrecheck);

// DataHouse Authoritative Diagnostics Route
router.get('/datahouse-diagnostics', getDataHouseDiagnostics);

// Worker route to trigger order queue processing
// Secured with secret key in controller
router.post('/worker/process', processWorker);

// Vercel Cron route — processes queue + syncs statuses
// GET because Vercel cron jobs use GET requests
router.get('/cron/sync', cronSync);

module.exports = router;
