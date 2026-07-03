import React, { useEffect, useState } from 'react';
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Alert, CircularProgress, Chip, Box, Button, Typography,
} from '@mui/material';
import { Add as AddIcon, TrendingUp, TrendingDown } from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { Layout } from '../components/Layout';
import { accountService } from '../services/accountService';
import { transactionService } from '../services/transactionService';
import { cardService } from '../services/cardService';
import { Account, Transaction } from '../types';
import type { Card as BankCard } from '../types/index';

function hashAccount(num: string) {
  return num.length > 4 ? '****' + num.slice(-4) : num;
}
function hashCard(num: string) {
  return num.length >= 4 ? `**** **** **** ${num.slice(-4)}` : num;
}

export default function Transactions() {
  const { user } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cards, setCards] = useState<BankCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(
    (location.state as any)?.success ?? null
  );

  useEffect(() => {
    if (success) { const t = setTimeout(() => setSuccess(null), 5000); return () => clearTimeout(t); }
  }, [success]);

  useEffect(() => {
    const load = async () => {
      try {
        const accs = await accountService.listAccounts(user?.id);
        setAccounts(accs);
        const allCards: BankCard[] = [];
        for (const a of accs) {
          try { allCards.push(...await cardService.getCards(a.id)); } catch {}
        }
        setCards(allCards);
        const accountIds = accs.map(a => a.id);
        setTransactions(await transactionService.listUserTransactions(100, accountIds));
      } catch { setError('Failed to load transactions'); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const accountMap = new Map(accounts.map(a => [a.id, a.accountNumber]));
  const cardMap = new Map(cards.map(c => [c.id, c.cardNumber]));

  if (loading) return (
    <Layout title="Transactions">
      <Box sx={{ display:'flex', justifyContent:'center', py:10 }}><CircularProgress /></Box>
    </Layout>
  );

  return (
    <Layout title="Transactions">
      {error   && <Alert severity="error"   sx={{ mb:2 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb:2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

      <Box sx={{ display:'flex', justifyContent:'space-between', alignItems:'center', mb:3 }}>
        <Typography variant="body2" color="text.secondary">
          {transactions.length} transaction{transactions.length!==1?'s':''} recorded
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/transactions/new')}>
          New Transaction
        </Button>
      </Box>

      <TableContainer component={Paper} elevation={0} sx={{ border:'1px solid #e2e8f0', borderRadius:2 }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor:'#f8fafc' }}>
              {['Date','Type','Description','Account','Card','Amount','Status'].map(h => (
                <TableCell key={h} sx={{ fontWeight:700, fontSize:'0.8rem' }}
                  align={h==='Amount'?'right':undefined}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py:5, color:'text.secondary' }}>
                  No transactions yet. <Button size="small" onClick={() => navigate('/transactions/new')}>Create one →</Button>
                </TableCell>
              </TableRow>
            ) : transactions.map(tx => {
              const isCredit = tx.type?.includes('DEPOSIT');
              const acctNum = tx.accountId ? accountMap.get(tx.accountId) : undefined;
              const cardNum = tx.cardId ? cardMap.get(tx.cardId) : undefined;
              const date = (tx as any).createdAt || tx.date || '';
              const status = (tx as any).status || 'COMPLETED';
              return (
                <TableRow key={tx.id} sx={{ '&:hover':{ bgcolor:'#f8fafc' } }}>
                  <TableCell sx={{ fontSize:'0.8rem', color:'text.secondary', whiteSpace:'nowrap' }}>
                    {date ? new Date(date).toLocaleDateString() : '—'}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display:'flex', alignItems:'center', gap:0.8 }}>
                      {isCredit
                        ? <TrendingUp sx={{ fontSize:16, color:'#22c55e' }} />
                        : <TrendingDown sx={{ fontSize:16, color:'#ef4444' }} />}
                      <Typography variant="caption" fontWeight={600}>
                        {tx.type?.replace(/_/g,' ')}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ fontSize:'0.8rem', maxWidth:200 }}>
                    <Typography variant="caption" noWrap>{tx.description || '—'}</Typography>
                  </TableCell>
                  <TableCell sx={{ fontFamily:'monospace', fontSize:'0.75rem', color:'text.secondary' }}>
                    {acctNum ? hashAccount(acctNum) : '—'}
                  </TableCell>
                  <TableCell sx={{ fontFamily:'monospace', fontSize:'0.72rem', color:'text.secondary', whiteSpace:'nowrap' }}>
                    {cardNum ? hashCard(cardNum) : '—'}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight:700, whiteSpace:'nowrap',
                    color: isCredit ? '#22c55e' : '#ef4444' }}>
                    {isCredit ? '+' : '-'}${Math.abs(tx.amount||0).toLocaleString('en-US',{minimumFractionDigits:2})}
                  </TableCell>
                  <TableCell>
                    <Chip label={status} size="small"
                      sx={{ height:20, fontSize:'0.65rem',
                        bgcolor: status==='COMPLETED'?'#dcfce7':'#fee2e2',
                        color: status==='COMPLETED'?'#166534':'#991b1b' }} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Layout>
  );
}
