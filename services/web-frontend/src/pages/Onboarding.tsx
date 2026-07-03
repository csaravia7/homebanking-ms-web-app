import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Box,
  Card,
  CardContent,
  CardHeader,
  Stepper,
  Step,
  StepLabel,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Paper,
} from '@mui/material';
import { useUser } from '../context/UserContext';
import { accountService } from '../services/accountService';
import { CardType } from '../types';

const steps = ['Account Details', 'Card Information', 'Review', 'Confirmation'];

export default function Onboarding() {
  const navigate = useNavigate();
  const { user } = useUser();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    accountType: 'CHECKING',
    initialDeposit: 1000,
    currency: 'USD',
    cardholderName: `${user?.firstName} ${user?.lastName}`.trim(),
    cardType: 'DEBIT' as CardType,
  });
  const [createdData, setCreatedData] = useState<any>(null);

  const handleNext = async () => {
    if (activeStep === steps.length - 2) {
      // Confirm and create
      try {
        setLoading(true);
        setError(null);
        const response = await accountService.createAccountWithCard({
          accountType: formData.accountType as any,
          initialDeposit: formData.initialDeposit,
          currency: formData.currency,
          cardholderName: formData.cardholderName,
          cardType: formData.cardType,
        });
        setCreatedData(response);
        setActiveStep(activeStep + 1);
      } catch (err: any) {
        setError(err.message || 'Failed to create account and card');
        console.error(err);
      } finally {
        setLoading(false);
      }
    } else {
      setActiveStep(activeStep + 1);
    }
  };

  const handleBack = () => {
    setActiveStep(activeStep - 1);
  };

  const handleFinish = () => {
    navigate('/dashboard');
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #f5f5f5 0%, #ffffff 100%)',
        py: 4,
        px: 2,
      }}
    >
      <Container maxWidth="sm">
        <Card elevation={0} sx={{ border: '1px solid #e0e0e0' }}>
          <CardHeader
            title="Welcome to HomeBanking"
            subheader="Set up your account in 4 simple steps"
            titleTypographyProps={{ variant: 'h5', fontWeight: 700 }}
            sx={{ textAlign: 'center', pb: 1 }}
          />

          <CardContent sx={{ pt: 2 }}>
            {/* Stepper */}
            <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
              {steps.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {/* Step Content */}
            {activeStep === 0 && (
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                  Account Details
                </Typography>

                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Account Type</InputLabel>
                  <Select
                    value={formData.accountType}
                    label="Account Type"
                    onChange={(e) =>
                      setFormData({ ...formData, accountType: e.target.value })
                    }
                  >
                    <MenuItem value="CHECKING">Checking</MenuItem>
                    <MenuItem value="SAVINGS">Savings</MenuItem>
                    <MenuItem value="CREDIT">Credit</MenuItem>
                  </Select>
                </FormControl>

                <TextField
                  fullWidth
                  label="Initial Deposit"
                  type="number"
                  value={formData.initialDeposit}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      initialDeposit: parseFloat(e.target.value),
                    })
                  }
                  sx={{ mb: 2 }}
                  inputProps={{ step: '0.01' }}
                />

                <FormControl fullWidth>
                  <InputLabel>Currency</InputLabel>
                  <Select
                    value={formData.currency}
                    label="Currency"
                    onChange={(e) =>
                      setFormData({ ...formData, currency: e.target.value })
                    }
                  >
                    <MenuItem value="USD">US Dollar</MenuItem>
                    <MenuItem value="EUR">Euro</MenuItem>
                    <MenuItem value="GBP">British Pound</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            )}

            {activeStep === 1 && (
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                  Card Information
                </Typography>

                <TextField
                  fullWidth
                  label="Cardholder Name"
                  value={formData.cardholderName}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      cardholderName: e.target.value,
                    })
                  }
                  sx={{ mb: 2 }}
                />

                <FormControl fullWidth>
                  <InputLabel>Card Type</InputLabel>
                  <Select
                    value={formData.cardType}
                    label="Card Type"
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        cardType: e.target.value as CardType,
                      })
                    }
                  >
                    <MenuItem value="DEBIT">Debit Card</MenuItem>
                    <MenuItem value="CREDIT">Credit Card</MenuItem>
                    <MenuItem value="PREPAID">Prepaid Card</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            )}

            {activeStep === 2 && (
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                  Review Your Details
                </Typography>

                <Paper
                  sx={{
                    p: 2,
                    backgroundColor: '#f5f5f5',
                    border: '1px solid #e0e0e0',
                  }}
                >
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>Account Type:</strong> {formData.accountType}
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>Initial Deposit:</strong> $
                    {formData.initialDeposit.toFixed(2)}
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>Currency:</strong> {formData.currency}
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>Cardholder Name:</strong> {formData.cardholderName}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Card Type:</strong> {formData.cardType}
                  </Typography>
                </Paper>

                <Alert severity="info" sx={{ mt: 2 }}>
                  Please review your details. Click "Continue" to create your
                  account and card.
                </Alert>
              </Box>
            )}

            {activeStep === 3 && (
              <Box sx={{ textAlign: 'center' }}>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="h2" sx={{ color: 'success.main' }}>
                    ✓
                  </Typography>
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                  Welcome to HomeBanking!
                </Typography>
                <Typography color="textSecondary" sx={{ mb: 2 }}>
                  Your account and card have been created successfully. You can
                  now start managing your finances.
                </Typography>
                {createdData && (
                  <Paper
                    sx={{
                      p: 2,
                      backgroundColor: '#f0f8ff',
                      border: '1px solid #0078d4',
                      mb: 2,
                    }}
                  >
                    <Typography variant="body2" sx={{ mb: 0.5 }}>
                      <strong>Account Number:</strong>{' '}
                      {createdData.accountNumber}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Card Number:</strong> ****
                      {createdData.cardNumber?.slice(-4)}
                    </Typography>
                  </Paper>
                )}
              </Box>
            )}

            {/* Action Buttons */}
            <Box sx={{ display: 'flex', gap: 1, mt: 4, justifyContent: 'space-between' }}>
              <Button
                disabled={activeStep === 0 || loading}
                onClick={handleBack}
              >
                Back
              </Button>

              {activeStep === steps.length - 1 ? (
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleFinish}
                >
                  Go to Dashboard
                </Button>
              ) : (
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleNext}
                  disabled={loading}
                  startIcon={loading ? <CircularProgress size={20} /> : undefined}
                >
                  {activeStep === steps.length - 2 ? 'Create Account' : 'Continue'}
                </Button>
              )}
            </Box>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
