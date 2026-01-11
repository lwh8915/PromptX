/**
 * Notification Store - Zustand store for managing notifications and WebSocket connection
 */
import { create } from 'zustand';
import { notificationApi, type Notification } from '../api/client';

interface NotificationState {
    notifications: Notification[];
    unreadCount: number;
    isLoading: boolean;
    isConnected: boolean;
    websocket: WebSocket | null;

    // Actions
    fetchNotifications: () => Promise<void>;
    fetchUnreadCount: () => Promise<void>;
    markAsRead: (id: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    deleteNotification: (id: string) => Promise<void>;
    addNotification: (notification: Notification) => void;

    // WebSocket
    connectWebSocket: (userId: string) => void;
    disconnectWebSocket: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
    notifications: [],
    unreadCount: 0,
    isLoading: false,
    isConnected: false,
    websocket: null,

    fetchNotifications: async () => {
        set({ isLoading: true });
        try {
            const response = await notificationApi.getAll({ page_size: 50 });
            set({
                notifications: response.items,
                unreadCount: response.unread_count,
                isLoading: false
            });
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
            set({ isLoading: false });
        }
    },

    fetchUnreadCount: async () => {
        try {
            const response = await notificationApi.getUnreadCount();
            set({ unreadCount: response.unread_count });
        } catch (error) {
            console.error('Failed to fetch unread count:', error);
        }
    },

    markAsRead: async (id: string) => {
        try {
            await notificationApi.markAsRead(id);
            set(state => ({
                notifications: state.notifications.map(n =>
                    n.id === id ? { ...n, is_read: true } : n
                ),
                unreadCount: Math.max(0, state.unreadCount - 1)
            }));
        } catch (error) {
            console.error('Failed to mark as read:', error);
        }
    },

    markAllAsRead: async () => {
        try {
            await notificationApi.markAllAsRead();
            set(state => ({
                notifications: state.notifications.map(n => ({ ...n, is_read: true })),
                unreadCount: 0
            }));
        } catch (error) {
            console.error('Failed to mark all as read:', error);
        }
    },

    deleteNotification: async (id: string) => {
        try {
            await notificationApi.delete(id);
            set(state => {
                const notification = state.notifications.find(n => n.id === id);
                const wasUnread = notification && !notification.is_read;
                return {
                    notifications: state.notifications.filter(n => n.id !== id),
                    unreadCount: wasUnread ? Math.max(0, state.unreadCount - 1) : state.unreadCount
                };
            });
        } catch (error) {
            console.error('Failed to delete notification:', error);
        }
    },

    addNotification: (notification: Notification) => {
        set(state => ({
            notifications: [notification, ...state.notifications],
            unreadCount: notification.is_read ? state.unreadCount : state.unreadCount + 1
        }));
    },

    connectWebSocket: (userId: string) => {
        const { websocket } = get();
        if (websocket) {
            websocket.close();
        }

        // Determine WebSocket URL
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/api/notifications/ws/${userId}`;

        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log('[WS] Connected');
            set({ isConnected: true, websocket: ws });
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'new_notification') {
                    get().addNotification(data.notification);
                }
            } catch (error) {
                console.error('[WS] Failed to parse message:', error);
            }
        };

        ws.onclose = () => {
            console.log('[WS] Disconnected');
            set({ isConnected: false, websocket: null });
        };

        ws.onerror = (error) => {
            console.error('[WS] Error:', error);
        };

        // Ping to keep connection alive
        const pingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send('ping');
            }
        }, 30000);

        // Clean up interval when connection closes
        ws.addEventListener('close', () => {
            clearInterval(pingInterval);
        });
    },

    disconnectWebSocket: () => {
        const { websocket } = get();
        if (websocket) {
            websocket.close();
            set({ isConnected: false, websocket: null });
        }
    }
}));
