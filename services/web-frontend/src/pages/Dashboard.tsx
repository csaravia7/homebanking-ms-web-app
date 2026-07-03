import React, { useEffect, useState } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  IconButton,
  Divider,
  Avatar,
  LinearProgress,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Add as AddIcon,
  ArrowForwardIos as ArrowNextIcon,
  ArrowBackIos as ArrowPrevIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  AccountBalanceWallet as WalletIcon,
  CreditCard as CardIcon,
  SwapHoriz as TxIcon,
  AccountBalance as BankIcon,
  Circle as DotIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { useFeatureFlags } from '../context/FeatureFlagContext';
import { Layout } from '../components/Layout';
import { accountService } from '../services/accountService';
import { transactionService } from '../services/transactionService';
import { cardService } from '../services/cardService';
import type { Account, Card as BankCard, Transaction } from '../types/index';
import { TransactionChart } from '../components/TransactionChart';

/* ─── Card visual gradients ──────────────────────────────────────── */
const CARD_GRADIENTS: Record<string, [string, string]> = {
  DEBIT:   ['#4776e6', '#8e54e9'],
  CREDIT:  ['#f7971e', '#ffd200'],
  PREPAID: ['#11998e', '#38ef7d'],
};

function BankCardVisual({ card, active }: { card: BankCard; active: boolean }) {
  const [c1, c2] = CARD_GRADIENTS[card.cardType] ?? ['#4776e6', '#8e54e9'];
  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: 360,
        mx: 'auto',
        borderRadius: 4,
        background: `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)`,
        color: '#fff',
        p: { xs: 2.5, sm: 3 },
        position: 'relative',
        overflow: 'hidden',
        boxShadow: active ? '0 20px 60px rgba(0,0,0,0.25)' : '0 8px 24px rgba(0,0,0,0.12)',
        transform: active ? 'scale(1)' : 'scale(0.93)',
        transition: 'all 0.4s cubic-bezier(.4,0,.2,1)',
        opacity: active ? 1 : 0.55,
        userSelect: 'none',
      }}
    >
      {/* decorative circles */}
      <Box sx={{ position:'absolute', top:-40, right:-40, width:130, height:130, borderRadius:'50%', bgcolor:'rgba(255,255,255,0.12)' }} />
      <Box sx={{ position:'absolute', bottom:-30, left:-20, width:100, height:100, borderRadius:'50%', bgcolor:'rgba(255,255,255,0.08)' }} />

      <Box sx={{ display:'flex', justifyContent:'space-between', mb: 3 }}>
        <Box sx={{ width:42, height:30, bgcolor:'rgba(255,215,0,0.85)', borderRadius:1.5 }} />
        <Typography variant="caption" fontWeight={700} letterSpacing={2} sx={{ opacity:0.9 }}>
          {card.cardType}
        </Typography>
      </Box>

      <Typography sx={{ fontFamily:'monospace', fontSize:{ xs:'0.95rem', sm:'1.1rem' }, letterSpacing:3, mb:2.5, fontWeight:500 }}>
        •••• •••• •••• {card.cardNumber.slice(-4)}
      </Typography>

      <Box sx={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end' }}>
        <Box>
          <Typography sx={{ fontSize:'0.6rem', opacity:0.7, mb:0.3, textTransform:'uppercase', letterSpacing:1 }}>Card Holder</Typography>
          <Typography fontWeight={600} sx={{ fontSize:{ xs:'0.85rem', sm:'0.95rem' } }}>{card.cardholderName}</Typography>
        </Box>
        <Box sx={{ textAlign:'right' }}>
          <Typography sx={{ fontSize:'0.6rem', opacity:0.7, mb:0.3, textTransform:'uppercase', letterSpacing:1 }}>Expires</Typography>
          <Typography fontWeight={600} sx={{ fontSize:'0.9rem' }}>{card.expiryDate}</Typography>
        </Box>
      </Box>
    </Box>
  );
}

/* ─── Stat tile ──────────────────────────────────────────────────── */
function StatTile({ label, value, icon, color, sub }: {
  label: string; value: string; icon: React.ReactNode; color: string; sub?: string;
}) {
  return (
    <Card sx={{ height:'100%', borderLeft:`4px solid ${color}` }}>
      <CardContent sx={{ display:'flex', alignItems:'center', gap:2, py:'14px !important' }}>
        <Avatar sx={{ bgcolor: color + '22', color, width:44, height:44 }}>
          {icon}
        </Avatar>
        <Box sx={{ minWidth:0 }}>
          <Typography variant="caption" color="text.secondary" noWrap>{label}</Typography>
          <Typography variant="h6" fontWeight={700} noWrap>{value}</Typography>
          {sub && <Typography variant="caption" color="text.secondary" noWrap>{sub}</Typography>}
        </Box>
      </CardContent>
    </Card>
  );
}

/* ─── Transaction row ────────────────────────────────────────────── */
function TxRow({ tx, accountMap, cardMap }: {
  tx: Transaction;
  accountMap: Map<string, string>;
  cardMap: Map<string, string>;
}) {
  const isCredit = tx.type?.includes('DEPOSIT');
  const sign = isCredit ? '+' : '-';
  const color = isCredit ? '#22c55e' : '#ef4444';
  const date = (tx as any).date || (tx as any).createdAt || '';
  const acctNum = tx.accountId ? accountMap.get(tx.accountId) : undefined;
  const cardNum = tx.cardId ? cardMap.get(tx.cardId) : undefined;
  return (
    <Box sx={{ display:'flex', alignItems:'center', gap:1.5, py:1.5, px:2, borderBottom:'1px solid #f0f0f0', '&:last-child':{ borderBottom:'none' }, '&:hover':{ bgcolor:'#fafafa' } }}>
      <Avatar sx={{ width:34, height:34, bgcolor: isCredit ? '#dcfce7' : '#fee2e2', color, flexShrink:0 }}>
        {isCredit ? <TrendingUpIcon fontSize="small" /> : <TrendingDownIcon fontSize="small" />}
      </Avatar>
      <Box sx={{ flex:1, minWidth:0 }}>
        <Typography variant="body2" fontWeight={600} noWrap>{tx.type?.replace(/_/g,' ')}</Typography>
        <Typography variant="caption" color="text.secondary" noWrap>{tx.description || '—'}</Typography>
      </Box>
      {/* Account number (hashed) */}
      <Box sx={{ textAlign:'center', flexShrink:0, display:{ xs:'none', sm:'block' } }}>
        <Typography variant="caption" color="text.disabled" sx={{ fontSize:'0.6rem', display:'block' }}>Account</Typography>
        <Typography variant="caption" sx={{ fontFamily:'monospace', fontSize:'0.72rem', color:'text.secondary' }}>
          {acctNum ? `****${acctNum.slice(-4)}` : '—'}
        </Typography>
      </Box>
      {/* Card number (hashed) */}
      <Box sx={{ textAlign:'center', flexShrink:0, display:{ xs:'none', md:'block' } }}>
        <Typography variant="caption" color="text.disabled" sx={{ fontSize:'0.6rem', display:'block' }}>Card</Typography>
        <Typography variant="caption" sx={{ fontFamily:'monospace', fontSize:'0.7rem', color:'text.secondary' }}>
          {cardNum ? `**** ${cardNum.slice(-4)}` : '—'}
        </Typography>
      </Box>
      <Box sx={{ textAlign:'right', flexShrink:0 }}>
        <Typography variant="body2" fontWeight={700} sx={{ color }}>{sign}${Math.abs(tx.amount||0).toLocaleString('en-US',{minimumFractionDigits:2})}</Typography>
        <Typography variant="caption" color="text.secondary">{date ? new Date(date).toLocaleDateString() : ''}</Typography>
      </Box>
      <Chip label={(tx as any).status || 'COMPLETED'} size="small"
        sx={{ fontSize:'0.6rem', height:18, ml:0.5,
          bgcolor: ((tx as any).status==='COMPLETED'||!(tx as any).status) ? '#dcfce7' : '#fee2e2',
          color: ((tx as any).status==='COMPLETED'||!(tx as any).status) ? '#166534' : '#991b1b' }} />
    </Box>
  );
}

/* ─── Main component ─────────────────────────────────────────────── */
export default function Dashboard() {
  const { user } = useUser();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMd = useMediaQuery(theme.breakpoints.up('md'));
  const { getBadPayload, maybeDelay } = useFeatureFlags();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cards, setCards] = useState<BankCard[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [cardIdx, setCardIdx] = useState(0);
  const [formData, setFormData] = useState({ accountType: 'CHECKING', initialDeposit: 1000, currency: 'USD' });
  const [totalBalance, setTotalBalance] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [txPage, setTxPage] = useState(0);
  const TX_PAGE_SIZE = 5;

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const accs = await accountService.listAccounts(user?.id);
      setAccounts(accs);
      const allCards: BankCard[] = [];
      for (const a of accs) {
        try { allCards.push(...await cardService.getCards(a.id)); } catch {}
      }
      setCards(allCards);
      const accountIds = accs.map(a => a.id);
      setTransactions(await transactionService.listUserTransactions(50, accountIds));
      setTotalBalance(accs.reduce((s, a) => s + (a.balance||0), 0));
    } catch { setError('Failed to load dashboard data'); }
    finally { setLoading(false); }
  };

  const handleCreateAccount = async () => {
    try {
      setError(null);
      await maybeDelay();

      const acctBadPatch = getBadPayload('simulateAccountCreationErrors');
      const newAcc = await accountService.createAccount({
        accountType: formData.accountType as any,
        initialDeposit: formData.initialDeposit,
        currency: formData.currency,
        ...acctBadPatch,
      } as any);

      try {
        const cardBadPatch = getBadPayload('simulateCardDeclined');
        const newCard = await cardService.createCard(newAcc.id, {
          cardType: 'CREDIT' as any,
          cardholderName: `${user?.firstName??''} ${user?.lastName??''}`.trim(),
          ...cardBadPatch,
        } as any);
        setCards(p => [...p, newCard]);
      } catch (ce: any) {
        const msg = ce?.response?.data?.detail || ce?.response?.data?.error || ce?.message;
        setError(`Account created, card failed: ${msg}`);
      }
      setAccounts(p => [...p, newAcc]);
      setTotalBalance(b => b + formData.initialDeposit);
      if (!error) { setSuccess('Account & credit card created!'); setTimeout(() => setSuccess(null), 4000); }
      setOpenDialog(false);
      setFormData({ accountType: 'CHECKING', initialDeposit: 1000, currency: 'USD' });
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.response?.data?.error || e?.message;
      setError(Array.isArray(msg) ? msg[0]?.msg : (msg || 'Failed to create account'));
    }
  };

  /* card navigation */
  const prevCard = () => setCardIdx(i => (i === 0 ? Math.max(0, cards.length-1) : i-1));
  const nextCard = () => setCardIdx(i => (i >= cards.length-1 ? 0 : i+1));

  /* stats */
  const deposits = transactions.filter(t => t.type?.includes('DEPOSIT')).reduce((s,t) => s+(t.amount||0), 0);
  const withdrawals = transactions.filter(t => !t.type?.includes('DEPOSIT')).reduce((s,t) => s+(t.amount||0), 0);

  /* lookup maps for tx rows */
  const accountMap = new Map(accounts.map(a => [a.id, a.accountNumber]));
  const cardMap = new Map(cards.map(c => [c.id, c.cardNumber]));

  /* paginated transactions */
  const txTotalPages = Math.ceil(transactions.length / TX_PAGE_SIZE);
  const pagedTx = transactions.slice(txPage * TX_PAGE_SIZE, (txPage + 1) * TX_PAGE_SIZE);

  if (loading) return (
    <Layout>
      <Box sx={{ display:'flex', justifyContent:'center', alignItems:'center', minHeight:'60vh' }}>
        <CircularProgress size={48} />
      </Box>
    </Layout>
  );

  return (
    <Layout>
      {error   && <Alert severity="error"   sx={{ mb:2 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb:2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

      {/* ── Hero balance bar ──────────────────────────────────────── */}
      <Box sx={{
        borderRadius: 3, mb: 3,
        background: 'linear-gradient(120deg, #0f172a 0%, #1e3a5f 60%, #0078d4 100%)',
        color: '#fff', p: { xs:2.5, sm:3.5 },
        display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Box>
          <Typography sx={{ fontSize:'0.75rem', opacity:0.7, letterSpacing:2, textTransform:'uppercase', mb:0.5 }}>
            Total Portfolio Balance
          </Typography>
          <Typography sx={{ fontSize:{ xs:'2rem', sm:'2.8rem', md:'3.2rem' }, fontWeight:800, lineHeight:1 }}>
            ${totalBalance.toLocaleString('en-US', { minimumFractionDigits:2 })}
          </Typography>
          <Typography sx={{ mt:0.8, opacity:0.7, fontSize:'0.85rem' }}>
            {accounts.length} account{accounts.length!==1?'s':''} · {cards.length} card{cards.length!==1?'s':''}
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} size="large"
          sx={{ bgcolor:'rgba(255,255,255,0.15)', backdropFilter:'blur(6px)', border:'1px solid rgba(255,255,255,0.25)',
            color:'#fff', fontWeight:700, borderRadius:2, px:3, flexShrink:0,
            '&:hover':{ bgcolor:'rgba(255,255,255,0.25)' } }}
          onClick={() => navigate('/accounts/new')}>
          New Account
        </Button>
      </Box>

      {/* ── Stat tiles ────────────────────────────────────────────── */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' },
          gap: 2,
          mb: 3,
          width: '100%',
        }}
      >
        {[
          { label:'Total Balance', value:`$${totalBalance.toLocaleString('en-US',{minimumFractionDigits:2})}`, icon:<WalletIcon/>, color:'#0078d4', sub:`${accounts.length} account${accounts.length!==1?'s':''}` },
          { label:'Total Deposits', value:`$${deposits.toLocaleString('en-US',{minimumFractionDigits:2})}`, icon:<TrendingUpIcon/>, color:'#22c55e', sub:'All time' },
          { label:'Total Spent',    value:`$${withdrawals.toLocaleString('en-US',{minimumFractionDigits:2})}`, icon:<TrendingDownIcon/>, color:'#ef4444', sub:'All time' },
          { label:'Transactions',   value:String(transactions.length), icon:<TxIcon/>, color:'#8b5cf6', sub:`${cards.length} card${cards.length!==1?'s':''}` },
        ].map(s => (
          <StatTile key={s.label} {...s} />
        ))}
      </Box>

      {/* ── Main 2-column layout ─────────────────────────────────── */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '380px 1fr', lg: '420px 1fr' },
          gap: 3,
          width: '100%',
          alignItems: 'start',
        }}
      >
        {/* LEFT column: Cards + Account Summary */}
        <Box>

          {/* Cards Carousel */}
          <Card sx={{ borderRadius:3, overflow:'hidden', mb:3 }}>
            <Box sx={{ background:'linear-gradient(135deg, #1e293b 0%, #334155 100%)', px:3, py:2 }}>
              <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <Typography variant="subtitle1" fontWeight={700} color="#fff">My Cards</Typography>
                <Button size="small" sx={{ color:'rgba(255,255,255,0.7)', fontSize:'0.7rem' }}
                  onClick={() => navigate('/cards')}>View all →</Button>
              </Box>
            </Box>

            {cards.length === 0 ? (
              <Box sx={{ textAlign:'center', py:5, px:3 }}>
                <CardIcon sx={{ fontSize:52, color:'text.disabled', mb:1 }} />
                <Typography color="text.secondary" variant="body2">No cards yet</Typography>
                <Typography variant="caption" color="text.disabled">Create an account to get your first card</Typography>
              </Box>
            ) : (
              <Box sx={{ py:3, px:2, bgcolor:'#f8fafc' }}>
                {/* Card visual */}
                <Box sx={{ position:'relative', overflow:'hidden' }}>
                  <Box sx={{ display:'flex', transition:'transform 0.4s ease', transform:`translateX(-${cardIdx * 100}%)` }}>
                    {cards.map((c, i) => (
                      <Box key={c.id} sx={{ minWidth:'100%', px:1 }}>
                        <BankCardVisual card={c} active={i === cardIdx} />
                      </Box>
                    ))}
                  </Box>
                </Box>

                {/* navigation */}
                {cards.length > 1 && (
                  <Box sx={{ display:'flex', alignItems:'center', justifyContent:'center', gap:1.5, mt:2 }}>
                    <IconButton size="small" onClick={prevCard} sx={{ bgcolor:'#fff', boxShadow:1, '&:hover':{ bgcolor:'#f1f5f9' } }}>
                      <ArrowPrevIcon sx={{ fontSize:14 }} />
                    </IconButton>
                    {cards.map((_, i) => (
                      <DotIcon key={i} sx={{ fontSize: i===cardIdx ? 10 : 7, color: i===cardIdx ? 'primary.main' : '#cbd5e1', cursor:'pointer', transition:'all 0.2s' }}
                        onClick={() => setCardIdx(i)} />
                    ))}
                    <IconButton size="small" onClick={nextCard} sx={{ bgcolor:'#fff', boxShadow:1, '&:hover':{ bgcolor:'#f1f5f9' } }}>
                      <ArrowNextIcon sx={{ fontSize:14 }} />
                    </IconButton>
                  </Box>
                )}

                {/* Active card info */}
                {cards[cardIdx] && (
                  <Box sx={{ mt:2, p:1.5, bgcolor:'#fff', borderRadius:2, border:'1px solid #e2e8f0' }}>
                    <Box sx={{ display:'flex', justifyContent:'space-between', mb:0.5 }}>
                      <Typography variant="caption" color="text.secondary">Card {cardIdx+1} of {cards.length}</Typography>
                      <Chip label={cards[cardIdx].status} size="small"
                        sx={{ height:18, fontSize:'0.6rem',
                          bgcolor: cards[cardIdx].status==='ACTIVE' ? '#dcfce7' : '#fee2e2',
                          color: cards[cardIdx].status==='ACTIVE' ? '#166534' : '#991b1b' }} />
                    </Box>
                    <Typography variant="body2" fontWeight={600}>{cards[cardIdx].cardholderName}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily:'monospace' }}>
                      •••• •••• •••• {cards[cardIdx].cardNumber.slice(-4)}
                    </Typography>
                  </Box>
                )}
              </Box>
            )}
          </Card>

          {/* Account Summary */}
          <Card sx={{ borderRadius:3 }}>
            <CardContent sx={{ pb:'12px !important' }}>
              <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', mb:1.5 }}>
                <Typography variant="subtitle2" fontWeight={700}>Accounts</Typography>
                <Button size="small" sx={{ fontSize:'0.7rem' }} onClick={() => navigate('/accounts')}>Manage →</Button>
              </Box>
              {accounts.length === 0 ? (
                <Typography variant="caption" color="text.secondary">No accounts yet</Typography>
              ) : (
                accounts.map(acc => (
                  <Box key={acc.id} sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', py:1, borderBottom:'1px solid #f1f5f9', '&:last-child':{ borderBottom:'none' } }}>
                    <Box sx={{ display:'flex', alignItems:'center', gap:1.5 }}>
                      <Avatar sx={{ width:32, height:32, bgcolor:'#eff6ff', color:'#2563eb', fontSize:'0.75rem', fontWeight:700 }}>
                        {acc.accountType[0]}
                      </Avatar>
                      <Box>
                        <Typography variant="caption" fontWeight={600} display="block" noWrap sx={{ maxWidth:120 }}>{acc.accountType}</Typography>
                        <Typography variant="caption" color="text.secondary" noWrap sx={{ fontFamily:'monospace', fontSize:'0.65rem' }}>
                          {acc.accountNumber.slice(-8)}
                        </Typography>
                      </Box>
                    </Box>
                    <Typography variant="body2" fontWeight={700} color="primary.main">
                      ${(acc.balance||0).toLocaleString('en-US',{minimumFractionDigits:2})}
                    </Typography>
                  </Box>
                ))
              )}
            </CardContent>
          </Card>
        </Box>

        {/* RIGHT column: Chart + Transactions */}
        <Box>

          {/* Transaction Chart */}
          <Card sx={{ borderRadius:3, mb:3 }}>
            <CardContent sx={{ pb:'8px !important' }}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb:1 }}>Transaction Analytics</Typography>
              <TransactionChart transactions={transactions} />
            </CardContent>
          </Card>

          {/* Recent Transactions — paginated 5 per page */}
          <Card sx={{ borderRadius:3 }}>
            <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', px:2.5, pt:2, pb:1 }}>
              <Box>
                <Typography variant="subtitle1" fontWeight={700}>Recent Transactions</Typography>
                {transactions.length > 0 && (
                  <Typography variant="caption" color="text.secondary">
                    Showing {txPage * TX_PAGE_SIZE + 1}–{Math.min((txPage + 1) * TX_PAGE_SIZE, transactions.length)} of {transactions.length}
                  </Typography>
                )}
              </Box>
              <Button size="small" sx={{ fontSize:'0.7rem' }} onClick={() => navigate('/transactions')}>View all →</Button>
            </Box>
            <Divider />
            {transactions.length === 0 ? (
              <Box sx={{ textAlign:'center', py:6 }}>
                <TxIcon sx={{ fontSize:44, color:'text.disabled', mb:1 }} />
                <Typography color="text.secondary" variant="body2">No transactions yet</Typography>
                <Button variant="outlined" size="small" sx={{ mt:2 }} onClick={() => navigate('/transactions')}>
                  Create Transaction
                </Button>
              </Box>
            ) : (
              <>
                {pagedTx.map(tx => <TxRow key={tx.id} tx={tx} accountMap={accountMap} cardMap={cardMap} />)}
                {txTotalPages > 1 && (
                  <Box sx={{ display:'flex', alignItems:'center', justifyContent:'center', gap:1, py:1.5, borderTop:'1px solid #f1f5f9' }}>
                    <IconButton size="small" disabled={txPage === 0} onClick={() => setTxPage(p => p - 1)}
                      sx={{ border:'1px solid #e2e8f0', width:28, height:28 }}>
                      <ArrowPrevIcon sx={{ fontSize:12 }} />
                    </IconButton>
                    {Array.from({ length: txTotalPages }, (_, i) => (
                      <Box key={i} onClick={() => setTxPage(i)}
                        sx={{ width:24, height:24, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
                          bgcolor: i === txPage ? 'primary.main' : 'transparent', color: i === txPage ? '#fff' : 'text.secondary',
                          fontSize:'0.7rem', fontWeight: i === txPage ? 700 : 400, cursor:'pointer', '&:hover':{ bgcolor: i === txPage ? 'primary.dark' : '#f1f5f9' } }}>
                        {i + 1}
                      </Box>
                    ))}
                    <IconButton size="small" disabled={txPage >= txTotalPages - 1} onClick={() => setTxPage(p => p + 1)}
                      sx={{ border:'1px solid #e2e8f0', width:28, height:28 }}>
                      <ArrowNextIcon sx={{ fontSize:12 }} />
                    </IconButton>
                  </Box>
                )}
              </>
            )}
          </Card>
        </Box>
      </Box>
    </Layout>
  );
}
