import express, { Express, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
import { trace } from '@opentelemetry/api';
import { logger } from './logger';

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 8080;
const tracer = trace.getTracer('api-gateway');

// Logs the upstream/network error for a proxied request and forwards a safe response to the client
function handleProxyError(error: any, req: Request, res: Response): void {
  logger.error(
    `Proxy call failed for ${req.method} ${req.originalUrl}: ${error.message}`,
    error.response?.data ? { upstreamStatus: error.response.status, upstreamData: error.response.data } : ''
  );
  res.status(error.response?.status || 500).json({ error: error.message });
}

process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught exception:', error.stack || error.message);
});

process.on('unhandledRejection', (reason: unknown) => {
  logger.error('Unhandled promise rejection:', reason);
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Service URLs
const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
const accountServiceUrl = process.env.ACCOUNT_SERVICE_URL || 'http://localhost:3003';
const transactionServiceUrl = process.env.TRANSACTION_SERVICE_URL || 'http://localhost:3004';
const notificationServiceUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3005';

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'OK', service: 'api-gateway' });
});

// Auth endpoints
app.post('/api/auth/login', async (req: Request, res: Response) => {
  const span = tracer.startSpan('auth.login');
  try {
    const response = await axios.post(`${authServiceUrl}/login`, req.body);
    res.json(response.data);
  } catch (error: any) {
    handleProxyError(error, req, res);
  } finally {
    span.end();
  }
});

app.post('/api/auth/register', async (req: Request, res: Response) => {
  const span = tracer.startSpan('auth.register');
  try {
    const response = await axios.post(`${authServiceUrl}/register`, req.body);
    res.json(response.data);
  } catch (error: any) {
    handleProxyError(error, req, res);
  } finally {
    span.end();
  }
});

// Account endpoints
app.post('/api/accounts', async (req: Request, res: Response) => {
  const span = tracer.startSpan('accounts.create');
  try {
    const response = await axios.post(`${accountServiceUrl}/api/accounts`, req.body, {
      headers: req.headers
    });
    res.json(response.data);
  } catch (error: any) {
    handleProxyError(error, req, res);
  } finally {
    span.end();
  }
});

app.post('/api/accounts/with-card', async (req: Request, res: Response) => {
  const span = tracer.startSpan('accounts.create_with_card');
  try {
    const response = await axios.post(`${accountServiceUrl}/api/accounts/with-card`, req.body, {
      headers: req.headers
    });
    res.json(response.data);
  } catch (error: any) {
    handleProxyError(error, req, res);
  } finally {
    span.end();
  }
});

app.get('/api/accounts/:accountId', async (req: Request, res: Response) => {
  const span = tracer.startSpan('accounts.get');
  try {
    const response = await axios.get(`${accountServiceUrl}/api/accounts/${req.params.accountId}`, {
      headers: req.headers
    });
    res.json(response.data);
  } catch (error: any) {
    handleProxyError(error, req, res);
  } finally {
    span.end();
  }
});

app.get('/api/accounts', async (req: Request, res: Response) => {
  const span = tracer.startSpan('accounts.list');
  try {
    const response = await axios.get(`${accountServiceUrl}/api/accounts`, {
      params: req.query,
      headers: req.headers
    });
    res.json(response.data);
  } catch (error: any) {
    handleProxyError(error, req, res);
  } finally {
    span.end();
  }
});

app.put('/api/accounts/:accountId', async (req: Request, res: Response) => {
  const span = tracer.startSpan('accounts.update');
  try {
    const response = await axios.put(`${accountServiceUrl}/api/accounts/${req.params.accountId}`, req.body, {
      headers: req.headers
    });
    res.json(response.data);
  } catch (error: any) {
    handleProxyError(error, req, res);
  } finally {
    span.end();
  }
});

app.delete('/api/accounts/:accountId', async (req: Request, res: Response) => {
  const span = tracer.startSpan('accounts.delete');
  try {
    const response = await axios.delete(`${accountServiceUrl}/api/accounts/${req.params.accountId}`, {
      headers: req.headers
    });
    res.json(response.data);
  } catch (error: any) {
    handleProxyError(error, req, res);
  } finally {
    span.end();
  }
});

app.get('/api/accounts/:accountId/cards', async (req: Request, res: Response) => {
  const span = tracer.startSpan('accounts.cards');
  try {
    const response = await axios.get(`${accountServiceUrl}/api/accounts/${req.params.accountId}/cards`, {
      headers: req.headers
    });
    res.json(response.data);
  } catch (error: any) {
    handleProxyError(error, req, res);
  } finally {
    span.end();
  }
});

// Card endpoints
app.post('/api/cards', async (req: Request, res: Response) => {
  const span = tracer.startSpan('cards.create');
  try {
    const response = await axios.post(`${accountServiceUrl}/api/cards`, req.body, {
      headers: req.headers
    });
    res.json(response.data);
  } catch (error: any) {
    handleProxyError(error, req, res);
  } finally {
    span.end();
  }
});

app.get('/api/cards', async (req: Request, res: Response) => {
  const span = tracer.startSpan('cards.list');
  try {
    const response = await axios.get(`${accountServiceUrl}/api/cards`, {
      params: req.query,
      headers: req.headers
    });
    res.json(response.data);
  } catch (error: any) {
    handleProxyError(error, req, res);
  } finally {
    span.end();
  }
});

app.get('/api/cards/:cardId', async (req: Request, res: Response) => {
  const span = tracer.startSpan('cards.get');
  try {
    const response = await axios.get(`${accountServiceUrl}/api/cards/${req.params.cardId}`, {
      headers: req.headers
    });
    res.json(response.data);
  } catch (error: any) {
    handleProxyError(error, req, res);
  } finally {
    span.end();
  }
});

app.put('/api/cards/:cardId', async (req: Request, res: Response) => {
  const span = tracer.startSpan('cards.update');
  try {
    const response = await axios.put(`${accountServiceUrl}/api/cards/${req.params.cardId}`, req.body, {
      headers: req.headers
    });
    res.json(response.data);
  } catch (error: any) {
    handleProxyError(error, req, res);
  } finally {
    span.end();
  }
});

app.patch('/api/cards/:cardId/block', async (req: Request, res: Response) => {
  const span = tracer.startSpan('cards.block');
  try {
    const response = await axios.patch(`${accountServiceUrl}/api/cards/${req.params.cardId}/block`, {}, {
      headers: req.headers
    });
    res.json(response.data);
  } catch (error: any) {
    handleProxyError(error, req, res);
  } finally {
    span.end();
  }
});

app.patch('/api/cards/:cardId/activate', async (req: Request, res: Response) => {
  const span = tracer.startSpan('cards.activate');
  try {
    const response = await axios.patch(`${accountServiceUrl}/api/cards/${req.params.cardId}/activate`, {}, {
      headers: req.headers
    });
    res.json(response.data);
  } catch (error: any) {
    handleProxyError(error, req, res);
  } finally {
    span.end();
  }
});

app.delete('/api/cards/:cardId', async (req: Request, res: Response) => {
  const span = tracer.startSpan('cards.delete');
  try {
    const response = await axios.delete(`${accountServiceUrl}/api/cards/${req.params.cardId}`, {
      headers: req.headers
    });
    res.json(response.data);
  } catch (error: any) {
    handleProxyError(error, req, res);
  } finally {
    span.end();
  }
});

// Transaction endpoints
// Transaction types that credit the account (increase balance)
const CREDIT_TYPES = new Set(['DEPOSIT', 'INTEREST']);
// Transaction types that debit the account (decrease balance)
const DEBIT_TYPES  = new Set(['WITHDRAWAL', 'INTERNAL_TRANSFER', 'CARD_PAYMENT',
  'SERVICE_PAYMENT', 'INTERBANK_TRANSFER', 'INTERNATIONAL_TRANSFER', 'ATM_WITHDRAWAL', 'FEE']);

app.post('/api/transactions', async (req: Request, res: Response) => {
  const span = tracer.startSpan('transactions.create');
  try {
    const txResponse = await axios.post(`${transactionServiceUrl}/transactions`, req.body, {
      headers: req.headers
    });
    const tx = txResponse.data;

    // Update account balance after successful transaction
    if (tx && tx.accountId && tx.amount) {
      try {
        // Use only auth header for internal service calls (avoid host header conflicts)
        const internalHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
        const authHeader = req.headers['authorization'];
        if (authHeader) internalHeaders['authorization'] = authHeader as string;

        const accResponse = await axios.get(`${accountServiceUrl}/api/accounts/${tx.accountId}`, {
          headers: internalHeaders
        });
        const account = accResponse.data;
        const currentBalance: number = account.balance ?? 0;
        const amount: number = parseFloat(tx.amount) ?? 0;

        let newBalance = currentBalance;
        if (CREDIT_TYPES.has(tx.type)) {
          newBalance = currentBalance + amount;
        } else if (DEBIT_TYPES.has(tx.type)) {
          newBalance = currentBalance - amount;
        }

        if (newBalance !== currentBalance) {
          await axios.put(`${accountServiceUrl}/api/accounts/${tx.accountId}`,
            { balance: newBalance }, { headers: internalHeaders });
        }
      } catch (balanceError) {
        // Balance update failure is non-fatal — transaction already recorded
        logger.error(`Balance update failed for accountId=${tx.accountId}:`, (balanceError as any)?.message);
      }
    }

    res.json(tx);
  } catch (error: any) {
    handleProxyError(error, req, res);
  } finally {
    span.end();
  }
});

app.get('/api/transactions', async (req: Request, res: Response) => {
  const span = tracer.startSpan('transactions.list');
  try {
    const response = await axios.get(`${transactionServiceUrl}/transactions`, {
      params: req.query,
      headers: req.headers
    });
    res.json(response.data);
  } catch (error: any) {
    handleProxyError(error, req, res);
  } finally {
    span.end();
  }
});

app.get('/api/transactions/:transactionId', async (req: Request, res: Response) => {
  const span = tracer.startSpan('transactions.get');
  try {
    const response = await axios.get(`${transactionServiceUrl}/transactions/${req.params.transactionId}`, {
      headers: req.headers
    });
    res.json(response.data);
  } catch (error: any) {
    handleProxyError(error, req, res);
  } finally {
    span.end();
  }
});

// Notification endpoints
app.post('/api/notifications', async (req: Request, res: Response) => {
  const span = tracer.startSpan('notifications.create');
  try {
    const response = await axios.post(`${notificationServiceUrl}/notifications`, req.body, {
      headers: req.headers
    });
    res.json(response.data);
  } catch (error: any) {
    handleProxyError(error, req, res);
  } finally {
    span.end();
  }
});

app.get('/api/notifications', async (req: Request, res: Response) => {
  const span = tracer.startSpan('notifications.list');
  try {
    const response = await axios.get(`${notificationServiceUrl}/notifications`, {
      params: req.query,
      headers: req.headers
    });
    res.json(response.data);
  } catch (error: any) {
    handleProxyError(error, req, res);
  } finally {
    span.end();
  }
});

app.get('/api/notifications/:notificationId', async (req: Request, res: Response) => {
  const span = tracer.startSpan('notifications.get');
  try {
    const response = await axios.get(`${notificationServiceUrl}/notifications/${req.params.notificationId}`, {
      headers: req.headers
    });
    res.json(response.data);
  } catch (error: any) {
    handleProxyError(error, req, res);
  } finally {
    span.end();
  }
});

app.put('/api/notifications/:notificationId/read', async (req: Request, res: Response) => {
  const span = tracer.startSpan('notifications.mark_read');
  try {
    const response = await axios.put(`${notificationServiceUrl}/notifications/${req.params.notificationId}/read`, {}, {
      headers: req.headers
    });
    res.json(response.data);
  } catch (error: any) {
    handleProxyError(error, req, res);
  } finally {
    span.end();
  }
});

app.delete('/api/notifications/:notificationId', async (req: Request, res: Response) => {
  const span = tracer.startSpan('notifications.delete');
  try {
    const response = await axios.delete(`${notificationServiceUrl}/notifications/${req.params.notificationId}`, {
      headers: req.headers
    });
    res.json(response.data);
  } catch (error: any) {
    handleProxyError(error, req, res);
  } finally {
    span.end();
  }
});

// Centralized error handling for errors passed via next(err) or thrown synchronously in middleware
app.use((err: any, req: Request, res: Response, next: any) => {
  logger.error(`Unhandled error on ${req.method} ${req.originalUrl}: ${err.stack || err.message}`);
  res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(port, () => {
  logger.info(`API Gateway listening on port ${port}`);
});
