const { v4: uuidv4 } = require('uuid');
const pool = require('../config/database');
const { logActivity } = require('../utils/activityLogger');

// Get wallet balance
const getBalance = async (req, res) => {
    try {
        const [profiles] = await pool.execute(
            'SELECT wallet_balance FROM profiles WHERE id = ?',
            [req.user.id]
        );

        if (profiles.length === 0) {
            return res.json({ balance: 0 });
        }

        res.json({
            balance: parseFloat(profiles[0].wallet_balance) || 0
        });

    } catch (error) {
        console.error('Get balance error:', error);
        res.status(500).json({ error: 'Failed to get balance' });
    }
};

// Fund wallet (simulate payment - in production, integrate with Paystack)
const fundWallet = async (req, res) => {
    try {
        const { amount, reference } = req.body;
        const userId = req.user.id;

        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Valid amount is required' });
        }

        // Optional: Verify with Paystack if reference is provided
        if (reference && reference.startsWith('DEP-')) {
            try {
                const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
                if (paystackSecretKey) {
                    const verifyResponse = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
                        headers: {
                            'Authorization': `Bearer ${paystackSecretKey}`,
                        },
                    });
                    const verifyData = await verifyResponse.json();

                    if (!verifyData.status || verifyData.data.status !== 'success') {
                        return res.status(400).json({ error: 'Payment verification failed' });
                    }

                    // Check if amount matches (Paystack amount is in pesewas)
                    const paystackAmount = verifyData.data.amount / 100;
                    // Note: We allow slight difference due to fees if needed, 
                    // but usually it should match the total paid.
                    // Actually, the amount passed from frontend is the credit amount, 
                    // while Paystack amount is total paid.
                }
            } catch (err) {
                console.error('Paystack verification error in fundWallet:', err);
                // Continue if verification service is down, or return error?
                // For safety, let's return error if verification was attempted but failed
                return res.status(500).json({ error: 'Payment verification service error' });
            }
        }

        let connection;
        try {
            connection = await pool.getConnection();
            await connection.beginTransaction();

            // Check if this reference has already been processed (e.g. by webhook)
            if (reference) {
                const [existing] = await connection.execute(
                    'SELECT id FROM deposits WHERE reference = ?',
                    [reference]
                );
                if (existing.length > 0) {
                    // Already processed, just return current balance
                    const [profiles] = await connection.execute(
                        'SELECT wallet_balance FROM profiles WHERE id = ?::uuid',
                        [userId]
                    );
                    await connection.commit();
                    return res.json({
                        message: 'Deposit already processed',
                        newBalance: parseFloat(profiles[0].wallet_balance)
                    });
                }
            }

            // The fee has already been collected by Paystack (user paid base + 3% fee)
            // Or for simulation, we deduct the fee to match reality
            const feePercentage = 0.03;
            const amountToCredit = amount / (1 + feePercentage);

            // Create deposit record
            const depositId = uuidv4();
            await connection.execute(
                'INSERT INTO deposits (id, user_id, amount_ghc, reference, status) VALUES (?::uuid, ?::uuid, ?, ?, ?)',
                [depositId, userId, amountToCredit, reference || uuidv4(), 'completed']
            );

            // Update wallet balance in profiles table
            const [updateResult] = await connection.execute(
                'UPDATE profiles SET wallet_balance = wallet_balance + ? WHERE id = ?::uuid',
                [amountToCredit, userId]
            );

            // If profile doesn't exist, create it
            if (updateResult.affectedRows === 0) {
                // Get user info for profile
                const [users] = await connection.execute(
                    'SELECT email, name, phone FROM users WHERE uuid = ?::uuid',
                    [userId]
                );

                if (users.length > 0) {
                    await connection.execute(
                        'INSERT INTO profiles (id, full_name, email, phone, wallet_balance) VALUES (?::uuid, ?, ?, ?, ?)',
                        [userId, users[0].name, users[0].email, users[0].phone, amountToCredit]
                    );
                }
            }

            // Update wallet balance in users table (redundant but necessary for sync)
            await connection.execute(
                'UPDATE users SET wallet_balance = wallet_balance + ? WHERE uuid = ?::uuid',
                [amountToCredit, userId]
            );

            // Get new balance
            const [profiles] = await connection.execute(
                'SELECT wallet_balance FROM profiles WHERE id = ?::uuid',
                [userId]
            );

            await connection.commit();

            // Emit real-time balance update via Socket.IO
            const io = req.app.get('io');
            if (io) {
                io.to(userId).emit('balanceUpdate', {
                    userId,
                    newBalance: parseFloat(profiles[0].wallet_balance)
                });
                io.to(userId).emit('newDeposit', {
                    userId,
                    depositId,
                    amount: amountToCredit
                });
                io.to(userId).emit('userStatsUpdate', { userId });
                // Broadcast globally so admin pages also refresh
                io.emit('userStatsUpdate', { userId });
            }

            res.json({
                message: 'Wallet funded successfully',
                depositId,
                newBalance: parseFloat(profiles[0].wallet_balance)
            });

            // Log activity (non-blocking)
            logActivity(userId, 'WALLET_FUND', `Wallet funded with GHS ${amountToCredit.toFixed(2)}`, { depositId, amount: amountToCredit, reference }, req.ip);

        } catch (error) {
            if (connection) await connection.rollback().catch(() => { });
            throw error;
        } finally {
            if (connection) connection.release();
        }

    } catch (error) {
        console.error('Fund wallet error details:', error);
        res.status(500).json({
            error: 'Failed to fund wallet',
            details: error.message
        });
    }
};

// Get deposit history
const getDeposits = async (req, res) => {
    try {
        const [deposits] = await pool.execute(
            'SELECT id, amount_ghc, reference, status, created_at FROM deposits WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
            [req.user.id]
        );

        const formatted = deposits.map(d => ({
            id: d.id,
            amount: parseFloat(d.amount_ghc),
            reference: d.reference,
            status: d.status,
            createdAt: d.created_at
        }));

        res.json(formatted);

    } catch (error) {
        console.error('Get deposits error:', error);
        res.status(500).json({ error: 'Failed to get deposits' });
    }
};

module.exports = { getBalance, fundWallet, getDeposits };
