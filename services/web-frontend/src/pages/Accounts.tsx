import React, { useEffect, useState } from 'react';
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, IconButton, Alert, CircularProgress, Chip, Box, Button, Typography,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { Layout } from '../components/Layout';
import { accountService } from '../services/accountService';
import { Account } from '../types';

export default function Accounts() {
  const { user } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(
    (location.state as any)?.success ?? null
  );

  useEffect(() => {
    accountService.listAccounts(user?.id)
      .then(setAccounts)
      .catch(() => setError('Failed to load accounts'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (success) { const t = setTimeout(() => setSuccess(null), 5000); return () => clearTimeout(t); }
  }, [success]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this account? This action cannot be undone.')) return;
    try {
      await accountService.deleteAccount(id);
      setAccounts(a => a.filter(x => x.id !== id));
      setSuccess('Account deleted.');
    } catch { setError('Failed to delete account.'); }
  };

  if (loading) return (
    <Layout title="Accounts">
      <Box sx={{ display:'flex', justifyContent:'center', py:10 }}><CircularProgress /></Box>
    </Layout>
  );

  return (
    <Layout title="Accounts">
      {error   && <Alert severity="error"   sx={{ mb:2 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb:2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

      <Box sx={{ display:'flex', justifyContent:'space-between', alignItems:'center', mb:3 }}>
        <Typography variant="body2" color="text.secondary">
          {accounts.length} account{accounts.length!==1?'s':''} found
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/accounts/new')}>
          New Account
        </Button>
      </Box>

      <TableContainer component={Paper} elevation={0} sx={{ border:'1px solid #e2e8f0', borderRadius:2 }}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor:'#f8fafc' }}>
              {['Account Number','Type','Balance','Status','Created','Actions'].map(h => (
                <TableCell key={h} sx={{ fontWeight:700, fontSize:'0.8rem' }}
                  align={h==='Balance'||h==='Actions'?'right':undefined}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {accounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py:5, color:'text.secondary' }}>
                  No accounts yet. <Button size="small" onClick={() => navigate('/accounts/new')}>Create one →</Button>
                </TableCell>
              </TableRow>
            ) : accounts.map(acc => (
              <TableRow key={acc.id} sx={{ '&:hover':{ bgcolor:'#f8fafc' } }}>
                <TableCell sx={{ fontFamily:'monospace', fontWeight:600, fontSize:'0.85rem' }}>
                  {acc.accountNumber}
                </TableCell>
                <TableCell>{acc.accountType}</TableCell>
                <TableCell align="right" sx={{ fontWeight:700, color:'primary.main' }}>
                  ${(acc.balance??0).toLocaleString('en-US',{minimumFractionDigits:2})}
                </TableCell>
                <TableCell>
                  <Chip label={acc.status} size="small"
                    color={acc.status==='ACTIVE'?'success':'warning'} />
                </TableCell>
                <TableCell sx={{ fontSize:'0.8rem', color:'text.secondary' }}>
                  {new Date(acc.createdAt||new Date()).toLocaleDateString()}
                </TableCell>
                <TableCell align="right">
                  <IconButton size="small" color="error" onClick={() => handleDelete(acc.id)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Layout>
  );
}
