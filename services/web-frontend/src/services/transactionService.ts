import api from '../api/client';
import { Transaction, TransactionType, TransactionStatus } from '../types';

export interface CreateTransactionRequest {
  accountId?: string;
  cardId?: string;
  type: TransactionType;
  amount: number;
  description: string;
  recipientName?: string;
  recipientAccount?: string;
  toAccountId?: string;
}

export const transactionService = {
  createTransaction: async (data: CreateTransactionRequest): Promise<Transaction> => {
    const response = await api.post('/api/transactions', data);
    return response.data;
  },

  getTransaction: async (transactionId: string): Promise<Transaction> => {
    const response = await api.get(`/api/transactions/${transactionId}`);
    return response.data;
  },

  listTransactions: async (accountId?: string, cardId?: string): Promise<Transaction[]> => {
    const params = new URLSearchParams();
    if (accountId) params.append('accountId', accountId);
    if (cardId) params.append('cardId', cardId);
    
    const response = await api.get(`/api/transactions?${params.toString()}`);
    return Array.isArray(response.data) ? response.data : response.data ? [response.data] : [];
  },

  listUserTransactions: async (limit: number = 10, accountIds?: string[]): Promise<Transaction[]> => {
    const params = new URLSearchParams();
    params.append('limit', String(limit));
    if (accountIds && accountIds.length > 0) {
      params.append('accountIds', accountIds.join(','));
    }
    const response = await api.get(`/api/transactions?${params.toString()}`);
    return Array.isArray(response.data) ? response.data : [];
  },

  getTransactionsByType: async (type: TransactionType): Promise<Transaction[]> => {
    const response = await api.get(`/api/transactions/type/${type}`);
    return Array.isArray(response.data) ? response.data : [];
  },

  getTransactionStats: async (): Promise<any> => {
    const response = await api.get('/api/transactions/stats/summary');
    return response.data;
  },
};
