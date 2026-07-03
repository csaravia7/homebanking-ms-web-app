import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Alert,
  Button,
  IconButton,
  Tooltip,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
} from '@mui/material';
import {
  CreditCard as CardIcon,
  Lock as BlockIcon,
  CheckCircle as ActivateIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  AccountBalance as AccountIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { useFeatureFlags } from '../context/FeatureFlagContext';
import { Layout } from '../components/Layout';
import { accountService } from '../services/accountService';
import { cardService } from '../services/cardService';
import type { Account, Card as BankCard, CardType } from '../types/index';

const CARD_GRADIENTS: Record<string, string[]> = {
  DEBIT: ['#667eea', '#764ba2'],
  CREDIT: ['#f093fb', '#f5576c'],
  PREPAID: ['#4facfe', '#00f2fe'],
};

function maskNumber(n: string) {
  return `•••• •••• •••• ${n.slice(-4)}`;
}

function CardVisual({ card }: { card: BankCard }) {
  const [c1, c2] = CARD_GRADIENTS[card.cardType] ?? ['#667eea', '#764ba2'];
  return (
    <Box
      sx={{
        borderRadius: 3,
        background: `linear-gradient(135deg, ${c1}, ${c2})`,
        color: '#fff',
        p: 3,
        minWidth: 300,
        maxWidth: 340,
        boxShadow: 6,
        position: 'relative',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'transform 0.2s',
        '&:hover': { transform: 'translateY(-4px)' },
      }}
    >
      {/* Decorative circle */}
      <Box
        sx={{
          position: 'absolute',
          top: -30,
          right: -30,
          width: 120,
          height: 120,
          borderRadius: '50%',
          bgcolor: 'rgba(255,255,255,0.1)',
        }}
      />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ width: 40, height: 28, bgcolor: 'rgba(255,215,0,0.8)', borderRadius: 1 }} />
        <Typography variant="caption" fontWeight={700} letterSpacing={2}>
          {card.cardType}
        </Typography>
      </Box>
      <Typography variant="body1" letterSpacing={3} fontWeight={500} sx={{ mb: 2 }}>
        {maskNumber(card.cardNumber)}
      </Typography>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <Box>
          <Typography variant="caption" sx={{ opacity: 0.7 }}>CARD HOLDER</Typography>
          <Typography variant="body2" fontWeight={600}>{card.cardholderName}</Typography>
        </Box>
        <Box sx={{ textAlign: 'right' }}>
          <Typography variant="caption" sx={{ opacity: 0.7 }}>EXPIRES</Typography>
          <Typography variant="body2" fontWeight={600}>{card.expiryDate}</Typography>
        </Box>
      </Box>
    </Box>
  );
}

export default function Cards() {
  const { user } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const { getBadPayload, maybeDelay, flags } = useFeatureFlags();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cards, setCards] = useState<BankCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(
    (location.state as any)?.success ?? null
  );

  useEffect(() => {
    if (user) return; // cardholderName handled in NewCard page
  }, [user]);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      setLoading(true);
      const accs = await accountService.listAccounts(user?.id);
      setAccounts(accs);
      const allCards: BankCard[] = [];
      for (const acc of accs) {
        try {
          const c = await cardService.getCards(acc.id);
          allCards.push(...c);
        } catch {}
      }
      setCards(allCards);
    } catch (err) {
      setError('Failed to load cards');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCard = async () => {
    try {
      setCreating(true);
      setError(null);

      // ── Client-side duplicate validation ────────────────────────
      const alreadyExists = cards.some(
        c => c.accountId === selectedAccountId && c.cardType === cardType
      );
      if (alreadyExists) {
        setError(`A ${cardType} card already exists for this account.`);
        return;
      }

      await maybeDelay();

      // Feature flag: inject bad card type → server returns 422/409
      const badPatch = getBadPayload('simulateCardDeclined');
      const newCard = await cardService.createCard(selectedAccountId, {
        cardType: cardType as any,
        cardholderName,
        ...badPatch,
      } as any);
      setCards([...cards, newCard]);
      setSuccess('Card created successfully!');
      setAddCardDialog(false);
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.response?.data?.error || err?.message;
      setError(Array.isArray(msg) ? msg[0]?.msg : (msg || 'Failed to create card'));
    } finally {
      setCreating(false);
    }
  };

  const handleBlock = async (cardId: string) => {
    try {
      await cardService.blockCard(cardId);
      setCards(cards.map((c) => (c.id === cardId ? { ...c, status: 'BLOCKED' as any } : c)));
      setSuccess('Card blocked');
      setTimeout(() => setSuccess(null), 3000);
    } catch {
      setError('Failed to block card');
    }
  };

  const handleActivate = async (cardId: string) => {
    try {
      await cardService.activateCard(cardId);
      setCards(cards.map((c) => (c.id === cardId ? { ...c, status: 'ACTIVE' as any } : c)));
      setSuccess('Card activated');
      setTimeout(() => setSuccess(null), 3000);
    } catch {
      setError('Failed to activate card');
    }
  };

  const handleDelete = async (cardId: string) => {
    try {
      await cardService.deleteCard(cardId);
      setCards(cards.filter((c) => c.id !== cardId));
      setSuccess('Card removed');
      setTimeout(() => setSuccess(null), 3000);
    } catch {
      setError('Failed to delete card');
    }
  };

  const getAccount = (accountId: string) =>
    accounts.find((a) => a.id === accountId);

  if (loading) {
    return (
      <Layout title="My Cards">
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
          <CircularProgress />
        </Box>
      </Layout>
    );
  }

  return (
    <Layout title="My Cards">
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}
      {flags.showMaintenanceBanner && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Scheduled maintenance tonight 23:00–01:00. Some card operations may be unavailable.
        </Alert>
      )}

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>My Cards</Typography>
          <Typography variant="body2" color="text.secondary">
            {cards.length} card{cards.length !== 1 ? 's' : ''} across {accounts.length} account{accounts.length !== 1 ? 's' : ''}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/cards/new')}
          disabled={accounts.length === 0}
        >
          New Card
        </Button>
      </Box>

      {accounts.length === 0 ? (
        <Alert severity="info" action={
          <Button size="small" onClick={() => navigate('/accounts')}>Create Account</Button>
        }>
          You need an account before adding cards.
        </Alert>
      ) : (
        accounts.map((account) => {
          const accountCards = cards.filter((c) => c.accountId === account.id);
          return (
            <Box key={account.id} sx={{ mb: 4 }}>
              {/* Account Header */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  mb: 2,
                  pb: 1,
                  borderBottom: '2px solid',
                  borderColor: 'primary.main',
                }}
              >
                <AccountIcon color="primary" />
                <Typography variant="h6" fontWeight={600}>
                  {account.accountType} — {account.accountNumber}
                </Typography>
                <Chip
                  label={account.status}
                  size="small"
                  color={account.status === 'ACTIVE' ? 'success' : 'default'}
                />
                <Chip
                  label={`$${account.balance.toLocaleString()}`}
                  size="small"
                  variant="outlined"
                />
                <Box sx={{ ml: 'auto' }}>
                  <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => navigate('/cards/new')}
                  >
                    Add Card
                  </Button>
                </Box>
              </Box>

              {/* Cards Grid */}
              {accountCards.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ pl: 1 }}>
                  No cards for this account yet.
                </Typography>
              ) : (
                <Grid container spacing={3}>
                  {accountCards.map((card) => (
                    <Grid item key={card.id} xs={12} sm={6} md={4}>
                      <Box>
                        <CardVisual card={card} />
                        {/* Card Actions */}
                        <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '0 0 12px 12px', mt: -1 }}>
                          <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <Chip
                                label={card.status}
                                size="small"
                                color={
                                  card.status === 'ACTIVE'
                                    ? 'success'
                                    : card.status === 'BLOCKED'
                                    ? 'error'
                                    : 'default'
                                }
                              />
                              <Box>
                                {card.status === 'ACTIVE' ? (
                                  <Tooltip title="Block card">
                                    <IconButton size="small" color="warning" onClick={() => handleBlock(card.id)}>
                                      <BlockIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                ) : (
                                  <Tooltip title="Activate card">
                                    <IconButton size="small" color="success" onClick={() => handleActivate(card.id)}>
                                      <ActivateIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                )}
                                <Tooltip title="Remove card">
                                  <IconButton size="small" color="error" onClick={() => handleDelete(card.id)}>
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            </Box>
                          </CardContent>
                        </Card>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              )}
            </Box>
          );
        })
      )}

    </Layout>
  );
}
