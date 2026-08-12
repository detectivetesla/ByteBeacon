import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { io as socketIO, Socket } from 'socket.io-client';

export interface SocketInterface {
    on: (event: string, callback: (data: any) => void) => void;
    off: (event: string, callback?: (data: any) => void) => void;
    emit: (event: string, data: any) => void;
    disconnect: () => void;
}

interface SocketContextType {
    socket: SocketInterface | null;
    isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
    socket: null,
    isConnected: false,
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, role } = useAuth();
    const [socket, setSocket] = useState<SocketInterface | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const callbacksRef = useRef<Record<string, Array<(data: any) => void>>>({});
    const ioRef = useRef<Socket | null>(null);

    useEffect(() => {
        if (!user || !user.id) {
            if (ioRef.current) {
                ioRef.current.disconnect();
                ioRef.current = null;
            }
            setSocket(null);
            setIsConnected(false);
            return;
        }

        console.log('📡 Initializing Resilient Realtime Bridge for user:', user.id);

        // Determine socket URL based on window or env
        let socketUrl = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || '';
        if (!socketUrl || socketUrl.startsWith('/')) {
            socketUrl = typeof window !== 'undefined' ? window.location.origin : '';
        }
        socketUrl = socketUrl.replace(/\/api\/?$/, '');

        let realSocket: Socket | null = null;
        try {
            realSocket = socketIO(socketUrl, {
                transports: ['websocket', 'polling'],
                autoConnect: true,
                reconnection: true,
                reconnectionAttempts: 10,
                reconnectionDelay: 1000,
                auth: { token: localStorage.getItem('auth_token') }
            });
            ioRef.current = realSocket;

            realSocket.on('connect', () => {
                console.log('🔌 Socket.IO connected successfully:', realSocket?.id);
                setIsConnected(true);
                realSocket?.emit('join', { userId: user.id, role: role || 'customer' });
            });

            realSocket.on('disconnect', () => {
                console.log('🔌 Socket.IO disconnected');
                setIsConnected(false);
            });

            realSocket.onAny((event: string, data: any) => {
                console.log(`📡 Realtime Socket Event [${event}]:`, data);
                const callbacks = callbacksRef.current[event] || [];
                callbacks.forEach(cb => {
                    try {
                        cb(data);
                    } catch (err) {
                        console.error(`Error in event listener for ${event}:`, err);
                    }
                });
            });
        } catch (err) {
            console.warn('⚠️ Could not initialize socket.io-client connection:', err);
        }

        // 1. Create the bridge object that mimic's socket.io-client
        const bridge: SocketInterface = {
            on: (event, callback) => {
                if (!callbacksRef.current[event]) callbacksRef.current[event] = [];
                callbacksRef.current[event].push(callback);
            },
            off: (event, callback) => {
                if (!callbacksRef.current[event]) return;
                if (callback) {
                    callbacksRef.current[event] = callbacksRef.current[event].filter(cb => cb !== callback);
                } else {
                    delete callbacksRef.current[event];
                }
            },
            emit: (event, data) => {
                if (ioRef.current && ioRef.current.connected) {
                    ioRef.current.emit(event, data);
                } else {
                    console.log(`📡 Bridge emit fallback: ${event}`, data);
                }
            },
            disconnect: () => {
                console.log('📡 Bridge disconnecting');
                if (ioRef.current) ioRef.current.disconnect();
            }
        };

        // Set the state so children get the update
        setSocket(bridge);
        setIsConnected(true);

        // 2. Set up Supabase subscriptions (IF supabase is available)
        if (!supabase) {
            console.warn('📡 Supabase client is not available. Realtime subscriptions skipped.');
            return;
        }

        const channels: any[] = [];

        try {
            // Subscribe to Notifications
            const notificationsChannel = supabase
                .channel(`public:notifications:user_id=${user.id}`)
                .on('postgres_changes',
                    { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
                    (payload: any) => {
                        const data = payload.new;
                        console.log('🔔 New Notification received via Realtime:', data);
                        const callbacks = callbacksRef.current['newNotification'] || [];
                        callbacks.forEach(cb => cb({
                            id: data.id,
                            title: data.title,
                            message: data.message,
                            type: data.type,
                            isRead: data.is_read || false,
                            createdAt: data.created_at
                        }));
                    }
                )
                .subscribe();
            channels.push(notificationsChannel);

            // Subscribe to Messages
            const messagesChannel = supabase
                .channel(`public:messages:recipient_id=${user.id}`)
                .on('postgres_changes',
                    { event: 'INSERT', schema: 'public', table: 'messages', filter: `recipient_id=eq.${user.id}` },
                    (payload: any) => {
                        const data = payload.new;
                        console.log('📧 New Message received via Realtime:', data);
                        const callbacks = callbacksRef.current['newMessage'] || [];
                        callbacks.forEach(cb => cb({
                            id: data.id,
                            subject: data.subject,
                            body: data.body,
                            senderId: data.sender_id,
                            recipientId: data.recipient_id,
                            isRead: data.is_read || false,
                            createdAt: data.created_at
                        }));
                    }
                )
                .subscribe();
            channels.push(messagesChannel);

            // Subscribe to Transactions (Status Updates)
            const transactionsChannel = supabase
                .channel(`public:transactions:user_id=${user.id}`)
                .on('postgres_changes',
                    { event: 'UPDATE', schema: 'public', table: 'transactions', filter: `user_id=eq.${user.id}` },
                    (payload: any) => {
                        const data = payload.new;
                        console.log('💸 Transaction update received via Realtime:', data);
                        const callbacks = callbacksRef.current['transactionUpdate'] || [];
                        callbacks.forEach(cb => cb({
                            transactionId: data.id,
                            status: data.status,
                            message: data.status === 'completed' ? 'Order successful' : data.status === 'failed' ? 'Order failed' : 'Order updating...'
                        }));
                    }
                )
                .subscribe();
            channels.push(transactionsChannel);

            // Admin Only: New User registrations
            if (role === 'admin') {
                const adminChannel = supabase
                    .channel('public:users:admin')
                    .on('postgres_changes',
                        { event: 'INSERT', schema: 'public', table: 'users' },
                        (payload: any) => {
                            const data = payload.new;
                            console.log('👤 New User registered (Admin Alert):', data);
                            const callbacks = callbacksRef.current['admin:newUser'] || [];
                            callbacks.forEach(cb => cb({
                                userId: data.uuid,
                                email: data.email,
                                fullName: data.name,
                                registeredAt: data.created_at
                            }));
                        }
                    )
                    .subscribe();
                channels.push(adminChannel);
            }

            // Admin Only: All Transactions (Status Updates)
            if (role === 'admin') {
                const adminTransactionsChannel = supabase
                    .channel('public:transactions:admin')
                    .on('postgres_changes',
                        { event: 'UPDATE', schema: 'public', table: 'transactions' },
                        (payload: any) => {
                            const data = payload.new;
                            console.log('💸 [Admin] Transaction update received via Realtime:', data);
                            const callbacks = callbacksRef.current['transactionUpdate'] || [];
                            callbacks.forEach(cb => cb({
                                transactionId: data.id,
                                status: data.status,
                                message: `Transaction ${data.id.slice(0, 8)} updated to ${data.status}`
                            }));
                        }
                    )
                    .subscribe();
                channels.push(adminTransactionsChannel);
            }
        } catch (error) {
            console.error('❌ Error setting up Realtime channels:', error);
        }

        return () => {
            console.log('📡 Cleaning up Realtime subscriptions');
            if (ioRef.current) {
                ioRef.current.disconnect();
                ioRef.current = null;
            }
            channels.forEach(ch => {
                if (ch) supabase.removeChannel(ch);
            });
        };
    }, [user?.id, role]);

    return (
        <SocketContext.Provider value={{ socket, isConnected }}>
            {children}
        </SocketContext.Provider>
    );
};
