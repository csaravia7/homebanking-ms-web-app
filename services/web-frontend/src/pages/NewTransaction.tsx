import React, { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Typography, TextField, Button,
  FormControl, InputLabel, Select, MenuItem, Alert,
  CircularProgress, Divider, Chip,
} from '@mui/material';
import { Add as AddIcon, ArrowBack as BackIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { useFeatureFlags } from '../context/FeatureFlagContext';
import { Layout } from '../components/Layout';
import { accountService } from '../services/accountService';
import { transactionService } from '../services/transactionService';
import { Account, TransactionType } from '../types';

const DEBIT_TYPES = new Set([
  'WITHDRAWAL', 'INTERNAL_TRANSFER', 'CARD_PAYMENT',
  'SERVICE_PAYMENT', 'INTERBANK_TRANSFER', 'INTERNATIONAL_TRANSFER', 'ATM_WITHDRAWAL',
]);

const TX_TYPES = [
  { value: 'DEPOSIT',               label: 'Deposit' },
  { value: 'WITHDRAWAL',            label: 'Withdrawal' },
  { value: 'INTERNAL_TRANSFER',     label: 'Internal Transfer' },
  { value: 'CARD_PAYMENT',          label: 'Card Payment' },
  { value: 'SERVICE_PAYMENT',       label: 'Service Payment' },
  { value: 'INTERBANK_TRANSFER',    label: 'Interbank Transfer' },
  { value: 'INTERNATIONAL_TRANSFER',label: 'International Transfer' },
];

export default function NewTransaction() {
  const navigate = useNavigate();
  const { user } = useUser();
  const { getBadPayload, maybeDelay } = useFeatureFlags();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [formData, setFormData] = useState({
    accountId: '',
    type: 'DEPOSIT' as TransactionType,
    amount: 100,
    description: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    accountService.listAccounts(user?.id)
      .then(accs => {
        setAccounts(accs);
        if (accs.length > 0) setFormData(p => ({ ...p, accountId: accs[0].id }));
      })
      .catch(() => setError('Could not load accounts'))
      .finally(() => setLoadingAccounts(false));
  }, []);

  const selectedAccount = accounts.find(a => a.id === formData.accountId);
  const isDebit = DEBIT_TYPES.has(formData.type);
  const insufficientBalance = isDebit && selectedAccount ? (selectedAccount.balance ?? 0) < formData.amount : false;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (insufficientBalance) {
      setError(`Insufficient balance. Available: $${(selectedAccount?.balance ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
      return;
    }
    setLoading(true);
    try {
      await maybeDelay();
      const badPatch = getBadPayload('simulateTransactionErrors');
      await transactionService.createTransaction({
        accountId: formData.accountId,
        amount: formData.amount,
        type: formData.type,
        description: formData.description,
        ...badPatch,
      } as any);
      navigate('/transactions', { state: { success: 'Transaction created successfully!' } });
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.response?.data?.detail || err?.message;
      setError(msg || 'Failed to create transaction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout title="New Transaction">
      <Box sx={{ maxWidth: 580, width: '100%' }}>
        <Button startIcon={<BackIcon />} onClick={() => navigate('/transactions')} sx={{ mb: 2 }}>
          Back to Transactions
        </Button>

        <Card sx={{ borderRadius: 3 }}>
          <Box sx={{
            background: 'linear-gradient(120deg, #1e293b, #334155)',
            px: 3, py: 2.5, borderRadius: '12px 12px 0 0',
          }}>
            <Typography variant="h6" fontWeight={700} color="#fff">Create Transaction</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.65)' }}>
              Complete the form below to record a new transaction
            </Typography>
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
                You need at least one account to create a transaction.
              </Alert>
            )}

            <form onSubmit={handleSubmit}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>

                {/* Account selector */}
                <FormControl fullWidth disabled={loadingAccounts || accounts.length === 0}>
                  <InputLabel>Account</InputLabel>
                  <Select value={formData.accountId} label="Account"
                    onChange={e => setFormData(p => ({ ...p, accountId: e.target.value }))}>
                    {accounts.map(a => (
                      <MenuItem key={a.id} value={a.id}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: 2 }}>
                          <span>{a.accountType} — ****{a.accountNumber.slice(-4)}</span>
                          <Chip label={`$${(a.balance ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                            size="small" color="primary" variant="outlined" />
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {/* Balance info */}
                {selectedAccount && (
                  <Box sx={{ display: 'flex', gap: 1.5, p: 1.5, bgcolor: '#f8fafc', borderRadius: 2 }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Available Balance</Typography>
                      <Typography variant="body1" fontWeight={700} color="primary.main">
                        ${(selectedAccount.balance ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </Typography>
                    </Box>
                  </Box>
                )}

                {/* Transaction type */}
                <FormControl fullWidth>
                  <InputLabel>Transaction Type</InputLabel>
                  <Select value={formData.type} label="Transaction Type"
                    onChange={e => setFormData(p => ({ ...p, type: e.target.value as TransactionType }))}>
                    {TX_TYPES.map(t => (
                      <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {/* Amount */}
                <TextField
                  label="Amount"
                  type="number"
                  fullWidth
                  value={formData.amount}
                  onChange={e => setFormData(p => ({ ...p, amount: parseFloat(e.target.value) || 0 }))}
                  inputProps={{ min: 0.01, step: '0.01' }}
                  error={insufficientBalance}
                  helperText={
                    insufficientBalance
                      ? `Insufficient balance — Available: $${(selectedAccount?.balance ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                      : isDebit ? `Will debit from account balance` : 'Will credit account balance'
                  }
                />

                {/* Description */}
                <TextField
                  label="Description"
                  fullWidth
                  value={formData.description}
                  onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                  placeholder="e.g. Monthly salary, utility bill…"
                  multiline
                  rows={2}
                />

                <Divider />

                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button variant="outlined" fullWidth onClick={() => navigate('/transactions')} disabled={loading}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="contained" fullWidth
                    disabled={loading || accounts.length === 0 || insufficientBalance}
                    startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <AddIcon />}>
                    {loading ? 'Processing…' : 'Create Transaction'}
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
