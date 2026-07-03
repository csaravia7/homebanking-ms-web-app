import React from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Divider,
  Switch,
  FormControlLabel,
  Chip,
  Alert,
} from '@mui/material';
import { Close as CloseIcon, BugReport as BugIcon } from '@mui/icons-material';
import { useFeatureFlags, FeatureFlags } from '../context/FeatureFlagContext';

const FLAG_META: Record<
  keyof FeatureFlags,
  { label: string; description: string; severity: 'error' | 'warning' | 'info' }
> = {
  simulateTransactionErrors: {
    label: 'Transaction Failures',
    description: 'Randomly fails transaction creation with a 503 error',
    severity: 'error',
  },
  simulateAccountCreationErrors: {
    label: 'Account Creation Failures',
    description: 'Always fails when attempting to create a new account',
    severity: 'error',
  },
  simulateSlowNetwork: {
    label: 'Slow Network (2–4s delay)',
    description: 'Adds artificial latency to all API calls',
    severity: 'warning',
  },
  simulateCardDeclined: {
    label: 'Card Declined',
    description: 'New card creation returns a "Card declined" error',
    severity: 'error',
  },
  showMaintenanceBanner: {
    label: 'Maintenance Banner',
    description: 'Shows a banner warning of scheduled maintenance',
    severity: 'info',
  },
};

export function FeatureFlagPanel() {
  const { flags, toggle, panelOpen, closePanel } = useFeatureFlags();

  const activeCount = Object.values(flags).filter(Boolean).length;

  return (
    <Drawer
      anchor="right"
      open={panelOpen}
      onClose={closePanel}
      PaperProps={{ sx: { width: 380, p: 0 } }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 3,
          py: 2,
          bgcolor: '#1a1a2e',
          color: '#fff',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <BugIcon sx={{ color: '#ff6b6b' }} />
          <Typography variant="h6" fontWeight={700}>
            Feature Flags
          </Typography>
          {activeCount > 0 && (
            <Chip
              label={`${activeCount} active`}
              size="small"
              sx={{ bgcolor: '#ff6b6b', color: '#fff', fontWeight: 700 }}
            />
          )}
        </Box>
        <IconButton onClick={closePanel} sx={{ color: '#fff' }}>
          <CloseIcon />
        </IconButton>
      </Box>

      <Box sx={{ px: 3, py: 2 }}>
        <Alert severity="warning" sx={{ mb: 2, fontSize: '0.75rem' }}>
          These flags inject intentional errors and degraded behaviour for
          testing observability and error handling.
        </Alert>

        <Divider sx={{ mb: 2 }} />

        {(Object.keys(FLAG_META) as (keyof FeatureFlags)[]).map((key) => {
          const meta = FLAG_META[key];
          const active = flags[key];
          return (
            <Box
              key={key}
              sx={{
                mb: 2,
                p: 2,
                borderRadius: 2,
                border: '1px solid',
                borderColor: active ? `${meta.severity}.main` : 'divider',
                bgcolor: active
                  ? meta.severity === 'error'
                    ? 'error.50'
                    : meta.severity === 'warning'
                    ? 'warning.50'
                    : 'info.50'
                  : 'background.paper',
                transition: 'all 0.2s',
              }}
            >
              <Box
                sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" fontWeight={600}>
                      {meta.label}
                    </Typography>
                    {active && (
                      <Chip
                        label="ON"
                        size="small"
                        color={meta.severity as any}
                        sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700 }}
                      />
                    )}
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {meta.description}
                  </Typography>
                </Box>
                <Switch
                  checked={active}
                  onChange={() => toggle(key)}
                  color={meta.severity as any}
                  size="small"
                />
              </Box>
            </Box>
          );
        })}
      </Box>
    </Drawer>
  );
}
