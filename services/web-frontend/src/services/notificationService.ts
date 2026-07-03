import api from '../api/client';

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  notification_type: string;
  read: boolean;
  created_at: string;
}

export interface CreateNotificationRequest {
  user_id: string;
  title: string;
  message: string;
  notification_type: string;
}

export const notificationService = {
  createNotification: async (data: CreateNotificationRequest): Promise<Notification> => {
    const response = await api.post('/api/notifications', data);
    return response.data;
  },

  listNotifications: async (userId: string): Promise<Notification[]> => {
    const response = await api.get(`/api/notifications?user_id=${userId}`);
    return Array.isArray(response.data) ? response.data : [];
  },

  markAsRead: async (notificationId: string): Promise<void> => {
    await api.put(`/api/notifications/${notificationId}/read`);
  },

  deleteNotification: async (notificationId: string): Promise<void> => {
    await api.delete(`/api/notifications/${notificationId}`);
  },
};
