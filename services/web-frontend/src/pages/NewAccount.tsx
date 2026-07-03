import React, { useState } from 'react';
import {
  Box, Card, CardContent, Typography, TextField, Button,
  FormControl, InputLabel, Select, MenuItem, Alert,
  CircularProgress, Divider,
} from '@mui/material';
import { Add as AddIcon, ArrowBack as BackIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { useFeatureFlags } from '../context/FeatureFlagContext';
import { Layout } from '../components/Layout';
import { accountService } from '../services/accountService';
import { cardService } from '../services/cardService';

export default function NewAccount() {
  const navigate = useNavigate();
  const { user } = useUser();
  const { getBadPayload, maybeDelay } = useFeatureFlags();

  const [formData, setFormData] = useState({
    accountType: 'CHECKING',
    initialDeposit: 1000,
    currency: 'USD',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await maybeDelay();
      const acctBad = getBadPayload('simulateAccountCreationErrors');
      const newAccount = await accountService.createAccount({
        accountType: formData.accountType as any,
        initialDeposit: formData.initialDeposit,
        currency: formData.currency,
        ...acctBad,
      } as any);

      // Auto-create credit card
      try {
        const cardBad = getBadPayload('simulateCardDeclined');
        await cardService.createCard(newAccount.id, {
          cardType: 'CREDIT' as any,
          cardholderName: `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim(),
          ...cardBad,
        } as any);
      } catch {
        /* card creation failure is non-critical */
      }
      navigate('/accounts', { state: { success: 'Account created successfully!' } });
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.response?.data?.error || err?.message;
      setError(Array.isArray(msg) ? msg[0]?.msg : (msg || 'Failed to create account'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout title="New Account">
      <Box sx={{ maxWidth: 560, width: '100%' }}>
        <Button startIcon={<BackIcon />} onClick={() => navigate('/accounts')} sx={{ mb: 2 }}>
          Back to Accounts
        </Button>

        <Card sx={{ borderRadius: 3 }}>
          <Box sx={{
            background: 'linear-gradient(120deg, #0f172a, #1e3a5f)',
            px: 3, py: 2.5, borderRadius: '12px 12px 0 0',
          }}>
            <Typography variant="h6" fontWeight={700} color="#fff">Create New Account</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.65)' }}>
              A credit card will be issued automatically
            </Typography>
          </Box>

          <CardContent sx={{ p: 3 }}>
            {error && (
              <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                <FormControl fullWidth>
                  <InputLabel>Account Type</InputLabel>
                  <Select value={formData.accountType} label="Account Type"
                    onChange={e => setFormData(p => ({ ...p, accountType: e.target.value }))}>
                    <MenuItem value="CHECKING">Checking</MenuItem>
                    <MenuItem value="SAVINGS">Savings</MenuItem>
                    <MenuItem value="CREDIT">Credit</MenuItem>
                  </Select>
                </FormControl>

                <TextField
                  label="Initial Deposit"
                  type="number"
                  fullWidth
                  value={formData.initialDeposit}
                  onChange={e => setFormData(p => ({ ...p, initialDeposit: parseFloat(e.target.value) || 0 }))}
                  inputProps={{ min: 0, step: '0.01' }}
                  helperText="Minimum $0"
                />

                <FormControl fullWidth>
                  <InputLabel>Currency</InputLabel>
                  <Select value={formData.currency} label="Currency"
                    onChange={e => setFormData(p => ({ ...p, currency: e.target.value }))}>
                    <MenuItem value="USD">🇺🇸 USD — US Dollar</MenuItem>
                    <MenuItem value="EUR">🇪🇺 EUR — Euro</MenuItem>
                    <MenuItem value="GBP">🇬🇧 GBP — British Pound</MenuItem>
                  </Select>
                </FormControl>

                <Divider />

                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button variant="outlined" fullWidth onClick={() => navigate('/accounts')} disabled={loading}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="contained" fullWidth
                    startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <AddIcon />}
                    disabled={loading}>
                    {loading ? 'Creating…' : 'Create Account'}
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
