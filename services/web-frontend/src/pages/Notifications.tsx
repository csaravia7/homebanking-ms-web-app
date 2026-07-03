import React, { useEffect, useState } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  CircularProgress,
  Chip,
  Box,
  IconButton,
} from '@mui/material';
import { Delete as DeleteIcon, CheckCircle as CheckIcon } from '@mui/icons-material';
import { useUser } from '../context/UserContext';
import { Layout } from '../components/Layout';
import { notificationService } from '../services/notificationService';

interface Notification {
  id: string;
  userId: string;
  message: string;
  isRead: boolean;
  createdAt?: Date;
}

export default function Notifications() {
  const { user } = useUser();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const data = await notificationService.listNotifications(user?.id);
      setNotifications(data);
    } catch (err) {
      setError('Failed to load notifications');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      setError(null);
      await notificationService.markAsRead(notificationId);
      setNotifications(
        notifications.map((n) =>
          n.id === notificationId ? { ...n, isRead: true } : n
        )
      );
      setSuccess('Notification marked as read!');
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError('Failed to update notification');
      console.error(err);
    }
  };

  const handleDelete = async (notificationId: string) => {
    try {
      setError(null);
      await notificationService.deleteNotification(notificationId);
      setNotifications(notifications.filter((n) => n.id !== notificationId));
      setSuccess('Notification deleted!');
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError('Failed to delete notification');
      console.error(err);
    }
  };

  if (loading) {
    return (
      <Layout title="Notifications">
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
          <CircularProgress />
        </Box>
      </Layout>
    );
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <Layout title="Notifications">
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="body1" color="textSecondary">
            {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
          </Typography>
          {unreadCount > 0 && (
            <Chip
              label={`${unreadCount} unread`}
              color="primary"
              size="small"
              sx={{ mt: 1 }}
            />
          )}
        </Box>
      </Box>

      {/* Notifications Table */}
      <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e0e0e0' }}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
              <TableCell sx={{ fontWeight: 700 }}>Message</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {notifications.length > 0 ? (
              notifications.map((notification) => (
                <TableRow
                  key={notification.id}
                  sx={{
                    backgroundColor: notification.isRead ? 'transparent' : '#f0f8ff',
                    '&:hover': { backgroundColor: '#f9f9f9' },
                    borderBottom: '1px solid #e0e0e0',
                  }}
                >
                  <TableCell sx={{ fontWeight: notification.isRead ? 400 : 600 }}>
                    {notification.message}
                  </TableCell>
                  <TableCell>
                    {new Date(notification.createdAt || new Date()).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={notification.isRead ? 'Read' : 'Unread'}
                      color={notification.isRead ? 'default' : 'primary'}
                      size="small"
                      variant={notification.isRead ? 'outlined' : 'filled'}
                    />
                  </TableCell>
                  <TableCell align="center">
                    {!notification.isRead && (
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => handleMarkAsRead(notification.id)}
                        title="Mark as read"
                      >
                        <CheckIcon fontSize="small" />
                      </IconButton>
                    )}
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleDelete(notification.id)}
                      title="Delete"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                  <Typography color="textSecondary">
                    No notifications yet.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Layout>
  );
}
