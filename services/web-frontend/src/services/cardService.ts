import api from '../api/client';
import { Card, CardType, CardStatus } from '../types';

export const cardService = {
  async createCard(accountId: string, cardData: {
    cardType: CardType;
    cardholderName: string;
  }): Promise<Card> {
    const { data } = await api.post('/api/cards', { accountId, ...cardData });
    return data;
  },

  async getCards(accountId: string): Promise<Card[]> {
    const { data } = await api.get(`/api/cards?accountId=${accountId}`);
    return Array.isArray(data) ? data : [];
  },

  async getCard(cardId: string): Promise<Card> {
    const { data } = await api.get(`/api/cards/${cardId}`);
    return data;
  },

  async updateCard(cardId: string, updateData: Partial<Card>): Promise<Card> {
    const { data } = await api.put(`/api/cards/${cardId}`, updateData);
    return data;
  },

  async blockCard(cardId: string): Promise<Card> {
    const { data } = await api.patch(`/api/cards/${cardId}/block`, {});
    return data;
  },

  async activateCard(cardId: string): Promise<Card> {
    const { data } = await api.patch(`/api/cards/${cardId}/activate`, {});
    return data;
  },

  async deleteCard(cardId: string): Promise<void> {
    await api.delete(`/api/cards/${cardId}`);
  },
};
