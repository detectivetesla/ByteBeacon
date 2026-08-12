require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Import routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const bundleRoutes = require('./routes/bundle.routes');
const transactionRoutes = require('./routes/transaction.routes');
const walletRoutes = require('./routes/wallet.routes');
const adminRoutes = require('./routes/admin.routes');
const paymentRoutes = require('./routes/payment.routes');
const webhookRoutes = require('./routes/webhook.routes');
const systemRoutes = require('./routes/system.routes');
const partnerRoutes = require('./routes/partner.routes');

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const maintenanceMiddleware = require('./middleware/maintenance.middleware');
const { auth } = require('./middleware/auth');

const http = require('http');
const { Server } = require('socket.io');
const { securityHeaders, globalLimiter, authLimiter, paymentLimiter } = require('./middleware/security');

const app = express();

// Required for Cloudflare/Vercel to correctly identify client IPs for rate limiting
app.set('trust proxy', true);

// Apply security headers (Helmet)
app.use(securityHeaders);

// Apply global limiter to all routes
app.use(globalLimiter);

const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Initialize Socket.IO
const io = new Server(server, {
    cors: {
        origin: (origin, callback) => {
            if (!origin || process.env.NODE_ENV !== 'production') {
                callback(null, true);
            } else {
                const allowedOrigins = [
                    process.env.FRONTEND_URL,
                    process.env.STOREFRONT_URL,
                    'https://www.bytebeacon.online',
                    'https://bytebeacon.online',
                    'https://apisolutions.store',
                    'https://www.apisolutions.store'
                ].filter(Boolean);
                if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
                    callback(null, true);
                } else {
                    callback(new Error('Socket.IO: Not allowed by CORS'));
                }
            }
        },
        methods: ["GET", "POST"],
        credentials: true
    }
});

// Make io accessible in routing/controllers
app.set('io', io);

// Socket.IO Connection handling
io.on('connection', (socket) => {
    console.log('🔌 New client connected:', socket.id);

    socket.on('join', ({ userId, role }) => {
        if (userId) {
            socket.join(userId);
            console.log(`👤 User ${userId} joined their private room`);
        }
        if (role) {
            socket.join(`${role}s`); // join 'admins' or 'agents'
            console.log(`🏢 User joined room: ${role}s`);
        }
    });

    socket.on('disconnect', () => {
        console.log('❌ Client disconnected');
    });
});

// Middleware
app.use(cors((req, callback) => {
    let corsOptions = { credentials: true };
    const isDeveloperApi = req.path.startsWith('/api/v1') || req.path.startsWith('/api/portal02') || req.path.startsWith('/api/datahouse');
    
    if (isDeveloperApi || process.env.NODE_ENV !== 'production') {
        corsOptions.origin = true; // Allow all origins dynamically
    } else {
        const allowedOrigins = [
            process.env.FRONTEND_URL,
            process.env.STOREFRONT_URL,
            'https://www.bytebeacon.online',
            'https://bytebeacon.online',
            'https://apisolutions.store',
            'https://www.apisolutions.store'
        ].filter(Boolean);

        const origin = req.header('Origin');
        if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
            corsOptions.origin = true;
        } else {
            console.error(`CORS Blocked: ${origin}. Allowed: ${allowedOrigins.join(', ')}`);
            corsOptions.origin = false;
        }
    }
    callback(null, corsOptions);
}));
app.use(express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));
app.use(express.urlencoded({ extended: true }));

// Request Logger (Debug)
app.use((req, res, next) => {
    console.log(`📡 ${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'ByteBeacon API is running' });
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/system', systemRoutes);

// Apply maintenance check to all routes below
// We use a small wrapper to allow req.user to be populated if token exists
// but continue even if not (maintenance check will handle it)
const { getUserFromToken } = require('./middleware/auth');
const populateUserIfToken = async (req, res, next) => {
    const user = await getUserFromToken(req);
    if (user) {
        req.user = user;
    }
    next();
};

app.use(populateUserIfToken);
app.use(maintenanceMiddleware);

const { getUnreadNotificationsCount } = require('./controllers/user.controller');
app.get('/api/notifications/unread-count', auth, getUnreadNotificationsCount);

const agentStoreRoutes = require('./routes/agentStore.routes');

app.use('/api/users', userRoutes);
app.use('/api/bundles', bundleRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/agent-store', agentStoreRoutes);
app.use('/api/payment', paymentLimiter, paymentRoutes);
app.use('/api/v1', partnerRoutes);

// Portal-02 webhook routes (external service callback)
const portal02Routes = require('./routes/portal02.routes');
app.use('/api/portal02', paymentLimiter, portal02Routes);

// Datahouse webhook routes (external service callback)
const datahouseRoutes = require('./routes/datahouse.routes');
app.use('/api/datahouse', paymentLimiter, datahouseRoutes);

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // In production, you might want to exit
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    // In production, you might want to exit
});

// Database initialization
const { initializeTables } = require('./utils/dbInit');

// Background jobs
const { startStatusSyncJob } = require('./jobs/statusSync');

// Start server
// Start server optimization for Serverless/Vercel
// Start server optimization for Serverless/Vercel
// Only disable background jobs if explicitly on Vercel or in a serverless environment
const isServerless = process.env.VERCEL || process.env.NOW_REGION || (process.env.NODE_ENV === 'production' && !process.env.BACKEND_URL);

if (isServerless) {
    console.log('⚡ Serverless mode: Background jobs and persistent listeners disabled.');
} else {
    console.log('🏢 Persistent mode: Background jobs and socket listeners enabled.');
}

const startServer = async () => {
    try {
        // Initialize database tables (non-blocking in serverless if possible)
        initializeTables().catch(err => console.error('Database Init Error:', err.message));

        if (!isServerless) {
            server.listen(PORT, '0.0.0.0', () => {
                console.log(`🚀 ByteBeacon API running on http://0.0.0.0:${PORT}`);
                console.log(`📡 Local access: http://localhost:${PORT}`);
                console.log(`📦 Environment: ${process.env.NODE_ENV || 'development'}`);

                // Start background status sync job only in persistent environments
                startStatusSyncJob(io);
            });
        }
    } catch (err) {
        console.error('Failed to start server:', err.message);
    }
};

startServer();

module.exports = app;
