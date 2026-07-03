// Transaction Types
export enum TransactionType {
  INTERBANK_TRANSFER = 'INTERBANK_TRANSFER',
  CARD_PAYMENT = 'CARD_PAYMENT',
  SERVICE_PAYMENT = 'SERVICE_PAYMENT',
  INTERNAL_TRANSFER = 'INTERNAL_TRANSFER',
  INTERNATIONAL_TRANSFER = 'INTERNATIONAL_TRANSFER',
  DEPOSIT = 'DEPOSIT',
  WITHDRAWAL = 'WITHDRAWAL',
  ATM_WITHDRAWAL = 'ATM_WITHDRAWAL',
  INTEREST = 'INTEREST',
  FEE = 'FEE',
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

// Card Types
export enum CardType {
  DEBIT = 'DEBIT',
  CREDIT = 'CREDIT',
  PREPAID = 'PREPAID',
}

export enum CardStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  BLOCKED = 'BLOCKED',
  EXPIRED = 'EXPIRED',
}

// Interfaces
export interface Card {
  id: string;
  accountId: string;
  cardNumber: string;
  cardType: CardType;
  cardholderName: string;
  expiryDate: string;
  cvv: string;
  status: CardStatus;
  balance?: number;
  creditLimit?: number;
  availableCredit?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Account {
  id: string;
  userId: string;
  accountNumber: string;
  accountType: string;
  balance: number;
  currency: string;
  status: string;
  cards?: Card[];
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  accountId?: string;
  cardId?: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: number;
  description: string;
  recipientName?: string;
  recipientAccount?: string;
  fromAccount?: string;
  toAccount?: string;
  date: string;
  reference?: string;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  avatar?: string;
  createdAt: string;
}
