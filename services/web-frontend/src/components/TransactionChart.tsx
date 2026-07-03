import React, { useMemo } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { Box, Typography, Chip } from '@mui/material';
import { Transaction } from '../types';

const TYPE_COLORS: Record<string, string> = {
  DEPOSIT:                '#22c55e',
  WITHDRAWAL:             '#ef4444',
  INTERNAL_TRANSFER:      '#f59e0b',
  CARD_PAYMENT:           '#8b5cf6',
  SERVICE_PAYMENT:        '#ec4899',
  INTERBANK_TRANSFER:     '#6366f1',
  INTERNATIONAL_TRANSFER: '#e11d48',
  ATM_WITHDRAWAL:         '#06b6d4',
  INTEREST:               '#14b8a6',
  FEE:                    '#a855f7',
};

const TYPE_LABELS: Record<string, string> = {
  DEPOSIT:                'Deposit',
  WITHDRAWAL:             'Withdrawal',
  INTERNAL_TRANSFER:      'Internal Transfer',
  CARD_PAYMENT:           'Card Payment',
  SERVICE_PAYMENT:        'Service Payment',
  INTERBANK_TRANSFER:     'Interbank Transfer',
  INTERNATIONAL_TRANSFER: 'International Transfer',
  ATM_WITHDRAWAL:         'ATM Withdrawal',
  INTEREST:               'Interest',
  FEE:                    'Fee',
};

function ChartTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <Box sx={{ bgcolor:'#fff', border:'1px solid #e2e8f0', borderRadius:2, p:1.5, boxShadow:3, minWidth:150 }}>
      <Typography variant="caption" fontWeight={700} display="block">{d.label ?? d.name}</Typography>
      {d.count !== undefined && (
        <Typography variant="caption" color="text.secondary">{d.count} tx</Typography>
      )}
      <Typography variant="body2" fontWeight={700} sx={{ color: d.color, mt:0.3 }}>
        ${(d.amount ?? payload[0].value).toLocaleString('en-US',{minimumFractionDigits:2})}
      </Typography>
    </Box>
  );
}

interface Props { transactions: Transaction[]; }

export const TransactionChart: React.FC<Props> = ({ transactions }) => {
  const byType = useMemo(() => {
    const map: Record<string, { count: number; amount: number }> = {};
    transactions.forEach(tx => {
      const k = tx.type ?? 'UNKNOWN';
      if (!map[k]) map[k] = { count: 0, amount: 0 };
      map[k].count += 1;
      map[k].amount += tx.amount ?? 0;
    });
    return Object.entries(map).map(([type, v]) => ({
      type,
      label: TYPE_LABELS[type] ?? type.replace(/_/g,' '),
      color: TYPE_COLORS[type] ?? '#94a3b8',
      count: v.count,
      amount: v.amount,
    }));
  }, [transactions]);

  const barData = useMemo(() =>
    byType.map(d => ({
      name: d.label.length > 14 ? d.label.slice(0,13)+'…' : d.label,
      label: d.label, amount: d.amount, count: d.count, color: d.color,
    })), [byType]);

  const totalIn  = byType.filter(d => ['DEPOSIT','INTEREST'].includes(d.type)).reduce((s,d)=>s+d.amount,0);
  const totalOut = byType.filter(d => !['DEPOSIT','INTEREST'].includes(d.type)).reduce((s,d)=>s+d.amount,0);

  if (transactions.length === 0) {
    return (
      <Box sx={{ textAlign:'center', py:5 }}>
        <Typography sx={{ fontSize:40, mb:1 }}>📊</Typography>
        <Typography variant="body2" color="text.secondary" fontWeight={600}>No Transactions Yet</Typography>
        <Typography variant="caption" color="text.disabled">Analytics will appear once you create transactions.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width:'100%' }}>
      {/* ── Two-column layout using CSS grid ── */}
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: '220px 1fr' },
        gap: 3,
        width: '100%',
        alignItems: 'start',
      }}>
        {/* Left: Donut */}
        <Box>
          <Typography variant="caption" color="text.secondary" fontWeight={600}
            sx={{ mb:1, display:'block', textTransform:'uppercase', letterSpacing:1 }}>
            By Type ({transactions.length} total)
          </Typography>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={byType} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                paddingAngle={3} dataKey="count">
                {byType.map((e, i) => <Cell key={i} fill={e.color} stroke="none" />)}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <Box sx={{ display:'flex', flexWrap:'wrap', gap:0.6, mt:1 }}>
            {byType.map(d => (
              <Chip key={d.type} label={`${d.label} (${d.count})`} size="small"
                sx={{ height:20, fontSize:'0.6rem', bgcolor:d.color+'18', color:d.color,
                  fontWeight:700, border:`1px solid ${d.color}33` }} />
            ))}
          </Box>
        </Box>

        {/* Right: Bar chart — expands to fill remaining space */}
        <Box sx={{ width:'100%', minWidth:0 }}>
          <Typography variant="caption" color="text.secondary" fontWeight={600}
            sx={{ mb:1, display:'block', textTransform:'uppercase', letterSpacing:1 }}>
            Volume ($)
          </Typography>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={barData} barSize={28}
              margin={{ top:4, right:8, left:0, bottom:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize:11, fill:'#94a3b8' }} axisLine={false} tickLine={false}
                interval={0} />
              <YAxis tick={{ fontSize:10, fill:'#94a3b8' }} axisLine={false} tickLine={false}
                tickFormatter={v => v>=1000?`$${(v/1000).toFixed(0)}k`:`$${v}`} width={55} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="amount" radius={[5,5,0,0]}>
                {barData.map((e,i) => <Cell key={i} fill={e.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Total In / Total Out */}
          <Box sx={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:1.5, mt:1.5 }}>
            {[
              { label:'Total In',  value: totalIn,  color:'#22c55e' },
              { label:'Total Out', value: totalOut, color:'#ef4444' },
            ].map(s => (
              <Box key={s.label} sx={{ bgcolor:s.color+'11', borderRadius:2, p:1.2, textAlign:'center' }}>
                <Typography variant="caption" color="text.secondary" display="block">{s.label}</Typography>
                <Typography variant="body2" fontWeight={800} sx={{ color:s.color }}>
                  ${s.value.toLocaleString('en-US',{minimumFractionDigits:2})}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};
