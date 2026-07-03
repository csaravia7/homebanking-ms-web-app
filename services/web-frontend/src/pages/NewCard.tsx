import React, { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Typography, TextField, Button,
  FormControl, InputLabel, Select, MenuItem, Alert,
  CircularProgress, Divider, Chip,
} from '@mui/material';
import { CreditCard as CardIcon, ArrowBack as BackIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { useFeatureFlags } from '../context/FeatureFlagContext';
import { Layout } from '../components/Layout';
import { accountService } from '../services/accountService';
import { cardService } from '../services/cardService';
import type { Account, Card as BankCard, CardType } from '../types/index';

const CARD_GRADIENTS: Record<string, [string, string]> = {
  DEBIT:   ['#4776e6', '#8e54e9'],
  CREDIT:  ['#f7971e', '#ffd200'],
  PREPAID: ['#11998e', '#38ef7d'],
};

export default function NewCard() {
  const navigate = useNavigate();
  const { user } = useUser();
  const { getBadPayload, maybeDelay } = useFeatureFlags();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [existingCards, setExistingCards] = useState<BankCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [formData, setFormData] = useState({
    accountId: '',
    cardType: 'DEBIT' as CardType,
    cardholderName: '',
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) setFormData(p => ({ ...p, cardholderName: `${user.firstName} ${user.lastName}` }));
  }, [user]);

  useEffect(() => {
    const load = async () => {
      try {
        const accs = await accountService.listAccounts(user?.id);
        setAccounts(accs);
        if (accs.length > 0) setFormData(p => ({ ...p, accountId: accs[0].id }));
        const allCards: BankCard[] = [];
        for (const acc of accs) {
          try { allCards.push(...await cardService.getCards(acc.id)); } catch {}
        }
        setExistingCards(allCards);
      } catch {
        setError('Could not load accounts');
      } finally {
        setLoadingAccounts(false);
      }
    };
    load();
  }, []);

  const duplicateExists = existingCards.some(
    c => c.accountId === formData.accountId && c.cardType === formData.cardType
  );

  const [c1, c2] = CARD_GRADIENTS[formData.cardType] ?? ['#4776e6', '#8e54e9'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (duplicateExists) {
      setError(`A ${formData.cardType} card already exists for this account.`);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await maybeDelay();
      const badPatch = getBadPayload('simulateCardDeclined');
      await cardService.createCard(formData.accountId, {
        cardType: formData.cardType as any,
        cardholderName: formData.cardholderName,
        ...badPatch,
      } as any);
      navigate('/cards', { state: { success: 'Card created successfully!' } });
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.response?.data?.error || err?.message;
      setError(Array.isArray(msg) ? msg[0]?.msg : (msg || 'Failed to create card'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout title="New Card">
      <Box sx={{ maxWidth: 560, width: '100%' }}>
        <Button startIcon={<BackIcon />} onClick={() => navigate('/cards')} sx={{ mb: 2 }}>
          Back to Cards
        </Button>

        <Card sx={{ borderRadius: 3 }}>
          <Box sx={{
            background: `linear-gradient(135deg, ${c1}, ${c2})`,
            px: 3, py: 2.5, borderRadius: '12px 12px 0 0',
            transition: 'background 0.4s ease',
          }}>
            <Typography variant="h6" fontWeight={700} color="#fff">Issue New Card</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.75)' }}>
              Select account and card type
            </Typography>
          </Box>

          {/* Card preview */}
          <Box sx={{ bgcolor: '#f8fafc', px: 3, py: 2.5, borderBottom: '1px solid #e2e8f0' }}>
            <Box sx={{
              borderRadius: 3,
              background: `linear-gradient(135deg, ${c1}, ${c2})`,
              color: '#fff', p: 2.5, maxWidth: 320, position: 'relative', overflow: 'hidden',
            }}>
              <Box sx={{ position:'absolute', top:-30, right:-30, width:100, height:100, borderRadius:'50%', bgcolor:'rgba(255,255,255,0.1)' }} />
              <Box sx={{ display:'flex', justifyContent:'space-between', mb:2 }}>
                <Box sx={{ width:38, height:26, bgcolor:'rgba(255,215,0,0.8)', borderRadius:1 }} />
                <Typography variant="caption" fontWeight={700} letterSpacing={2}>{formData.cardType}</Typography>
              </Box>
              <Typography sx={{ fontFamily:'monospace', letterSpacing:3, mb:2, fontSize:'0.95rem' }}>
                •••• •••• •••• ••••
              </Typography>
              <Box sx={{ display:'flex', justifyContent:'space-between' }}>
                <Box>
                  <Typography sx={{ fontSize:'0.55rem', opacity:0.7, textTransform:'uppercase' }}>Cardholder</Typography>
                  <Typography fontWeight={600} sx={{ fontSize:'0.85rem' }}>
                    {formData.cardholderName || 'Your Name'}
                  </Typography>
                </Box>
                <Box sx={{ textAlign:'right' }}>
                  <Typography sx={{ fontSize:'0.55rem', opacity:0.7, textTransform:'uppercase' }}>Expires</Typography>
                  <Typography fontWeight={600} sx={{ fontSize:'0.85rem' }}>MM/YY</Typography>
                </Box>
              </Box>
            </Box>
          </Box>

          <CardContent sx={{ p: 3 }}>
            {error && (
              <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            {accounts.length === 0 && !loadingAccounts && (
              <Alert severity="warning" sx={{ mb: 3 }}
                action={<Button size="small" onClick={() => navigate('/accounts/new')}>Create Account</Button>}>
                You need an account before issuing a card.
              </Alert>
            )}

            <form onSubmit={handleSubmit}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>

                <FormControl fullWidth disabled={loadingAccounts || accounts.length === 0}>
                  <InputLabel>Account</InputLabel>
                  <Select value={formData.accountId} label="Account"
                    onChange={e => setFormData(p => ({ ...p, accountId: e.target.value }))}>
                    {accounts.map(a => (
                      <MenuItem key={a.id} value={a.id}>
                        <Box sx={{ display:'flex', justifyContent:'space-between', width:'100%', gap:2 }}>
                          <span>{a.accountType} — ****{a.accountNumber.slice(-4)}</span>
                          <Chip label={`$${(a.balance ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                            size="small" color="primary" variant="outlined" />
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl fullWidth>
                  <InputLabel>Card Type</InputLabel>
                  <Select value={formData.cardType} label="Card Type"
                    onChange={e => setFormData(p => ({ ...p, cardType: e.target.value as CardType }))}>
                    <MenuItem value="DEBIT">Debit — Linked to account balance</MenuItem>
                    <MenuItem value="CREDIT">Credit — Up to $5,000 credit limit</MenuItem>
                    <MenuItem value="PREPAID">Prepaid — Fixed amount</MenuItem>
                  </Select>
                </FormControl>

                {duplicateExists && (
                  <Alert severity="warning">
                    A {formData.cardType} card already exists for this account.
                  </Alert>
                )}

                <TextField
                  label="Cardholder Name"
                  fullWidth
                  value={formData.cardholderName}
                  onChange={e => setFormData(p => ({ ...p, cardholderName: e.target.value }))}
                  placeholder="Full name as it appears on card"
                />

                <Divider />

                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button variant="outlined" fullWidth onClick={() => navigate('/cards')} disabled={loading}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="contained" fullWidth
                    disabled={loading || accounts.length === 0 || duplicateExists}
                    startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <CardIcon />}>
                    {loading ? 'Issuing…' : 'Issue Card'}
                  </Button>
                </Box>
              </Box>
            </form>
          </CardContent>
        </Card>
      </Box>
    </Layout>
  );
}
