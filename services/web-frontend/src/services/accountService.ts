import api from '../api/client';
import { Account, Card, CardType } from '../types';

export interface CreateAccountRequest {
  accountType: string;
  initialDeposit?: number;
  currency?: string;
}

export interface CreateAccountWithCardRequest extends CreateAccountRequest {
  cardholderName: string;
  cardType: CardType;
}

export const accountService = {
  createAccount: async (data: CreateAccountRequest): Promise<Account> => {
    const response = await api.post('/api/accounts', data);
    return response.data;
  },

  createAccountWithCard: async (data: CreateAccountWithCardRequest): Promise<Account> => {
    const response = await api.post('/api/accounts/with-card', data);
    return response.data;
  },

  getAccount: async (accountId: string): Promise<Account> => {
    const response = await api.get(`/api/accounts/${accountId}`);
    return response.data;
  },

  listAccounts: async (userId?: string): Promise<Account[]> => {
    const response = await api.get('/api/accounts', {
      params: userId ? { userId } : {},
    });
    return Array.isArray(response.data) ? response.data : response.data ? [response.data] : [];
  },

  updateAccount: async (accountId: string, data: Partial<Account>): Promise<Account> => {
    const response = await api.put(`/api/accounts/${accountId}`, data);
    return response.data;
  },

  deleteAccount: async (accountId: string): Promise<void> => {
    await api.delete(`/api/accounts/${accountId}`);
  },

  getAccountCards: async (accountId: string): Promise<Card[]> => {
    const response = await api.get(`/api/accounts/${accountId}/cards`);
    return Array.isArray(response.data) ? response.data : [];
  },
};
