import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar, Box, Toolbar, Typography, Button, Menu, MenuItem,
  Avatar, IconButton, Badge, Tooltip, Alert, Divider,
  useTheme, useMediaQuery, Drawer, List, ListItemButton,
  ListItemIcon, ListItemText,
} from '@mui/material';
import {
  Dashboard as DashboardIcon, AccountBalance as AccountsIcon,
  SwapHoriz as TransactionsIcon, Notifications as NotificationsIcon,
  Logout as LogoutIcon, CreditCard as CardsIcon,
  BugReport as BugIcon, Menu as MenuIcon,
  Security as SecurityIcon, Info as InfoIcon,
} from '@mui/icons-material';
import { useUser } from '../context/UserContext';
import { useFeatureFlags } from '../context/FeatureFlagContext';
import { FeatureFlagPanel } from './FeatureFlagPanel';

interface LayoutProps { children: React.ReactNode; title?: string; }

const NAV_ITEMS = [
  { label: 'Dashboard',     icon: DashboardIcon,    path: '/dashboard' },
  { label: 'Accounts',      icon: AccountsIcon,     path: '/accounts' },
  { label: 'Cards',         icon: CardsIcon,        path: '/cards' },
  { label: 'Transactions',  icon: TransactionsIcon, path: '/transactions' },
  { label: 'Notifications', icon: NotificationsIcon,path: '/notifications' },
];

function Footer() {
  return (
    <Box component="footer" sx={{ bgcolor:'#0f172a', color:'rgba(255,255,255,0.7)', pt:3, pb:2, px:{ xs:2, sm:4, md:6 }, width:'100%' }}>
      <Box sx={{ display:'flex', flexWrap:'wrap', gap:4, justifyContent:'space-between', mb:2 }}>
        <Box sx={{ minWidth:180 }}>
          <Typography variant="subtitle1" fontWeight={700} color="#fff" sx={{ mb:0.5 }}>🏦 HomeBanking</Typography>
          <Typography variant="caption" sx={{ opacity:0.6, lineHeight:1.6 }}>
            Modern banking platform built with React, FastAPI, Spring Boot &amp; Node.js microservices.
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" fontWeight={700} color="#fff" sx={{ mb:1, display:'block', textTransform:'uppercase', letterSpacing:1 }}>Pages</Typography>
          {NAV_ITEMS.map(n => (
            <Typography key={n.path} component="a" href={n.path} variant="caption"
              sx={{ display:'block', color:'rgba(255,255,255,0.6)', textDecoration:'none', mb:0.4, '&:hover':{ color:'#fff' } }}>
              {n.label}
            </Typography>
          ))}
        </Box>
        <Box>
          <Typography variant="caption" fontWeight={700} color="#fff" sx={{ mb:1, display:'block', textTransform:'uppercase', letterSpacing:1 }}>Stack</Typography>
          {['React 18 + TypeScript','Material-UI v5','FastAPI (Python)','Spring Boot (Java)','Node.js / Express','PostgreSQL'].map(t => (
            <Typography key={t} variant="caption" sx={{ display:'block', color:'rgba(255,255,255,0.6)', mb:0.4 }}>{t}</Typography>
          ))}
        </Box>
        <Box>
          <Typography variant="caption" fontWeight={700} color="#fff" sx={{ mb:1, display:'block', textTransform:'uppercase', letterSpacing:1 }}>Features</Typography>
          {['Feature Flags','Balance Validation','Card Duplicate Check','JWT Auth','API Gateway','OpenTelemetry'].map(f => (
            <Typography key={f} variant="caption" sx={{ display:'block', color:'rgba(255,255,255,0.6)', mb:0.4 }}>{f}</Typography>
          ))}
        </Box>
      </Box>
      <Divider sx={{ borderColor:'rgba(255,255,255,0.1)', mb:1.5 }} />
      <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:1 }}>
        <Typography variant="caption" sx={{ opacity:0.5 }}>© {new Date().getFullYear()} HomeBanking · Microservices Demo Platform</Typography>
        <Box sx={{ display:'flex', gap:2 }}>
          <Box sx={{ display:'flex', alignItems:'center', gap:0.5 }}>
            <SecurityIcon sx={{ fontSize:12, opacity:0.5 }} />
            <Typography variant="caption" sx={{ opacity:0.5 }}>JWT Secured</Typography>
          </Box>
          <Box sx={{ display:'flex', alignItems:'center', gap:0.5 }}>
            <InfoIcon sx={{ fontSize:12, opacity:0.5 }} />
            <Typography variant="caption" sx={{ opacity:0.5 }}>v1.0.0</Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export const Layout: React.FC<LayoutProps> = ({ children, title }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user, logout } = useUser();
  const { flags, openPanel } = useFeatureFlags();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [mobileDrawer, setMobileDrawer] = React.useState(false);
  const activeFlags = Object.values(flags).filter(Boolean).length;

  const handleLogout = () => { logout(); navigate('/login'); setAnchorEl(null); };
  const getInitials = () => user ? `${user.firstName?.[0]||''}${user.lastName?.[0]||''}`.toUpperCase() : '?';

  return (
    <Box sx={{ display:'flex', flexDirection:'column', minHeight:'100vh', width:'100%', maxWidth:'100vw', overflowX:'hidden', bgcolor:'#f0f2f5' }}>

      {/* AppBar */}
      <AppBar position="sticky" elevation={0}
        sx={{ width:'100%', bgcolor:'#fff', borderBottom:'1px solid #e2e8f0', color:'text.primary', zIndex:1200 }}>
        <Toolbar sx={{ width:'100%', px:{ xs:1.5, sm:3, md:4 }, minHeight:{ xs:56, sm:64 } }}>
          {isMobile && <IconButton edge="start" onClick={() => setMobileDrawer(true)} sx={{ mr:1 }}><MenuIcon /></IconButton>}
          <Typography variant="h6" onClick={() => navigate('/dashboard')}
            sx={{ fontWeight:800, color:'primary.main', cursor:'pointer', fontSize:{ xs:'1rem', sm:'1.15rem' }, letterSpacing:-0.5, mr:'auto' }}>
            🏦 HomeBanking
          </Typography>
          {!isMobile && (
            <Box sx={{ display:'flex', gap:0, mr:2 }}>
              {NAV_ITEMS.map(item => {
                const active = location.pathname === item.path;
                return (
                  <Button key={item.path} startIcon={<item.icon sx={{ fontSize:'1rem' }} />}
                    onClick={() => navigate(item.path)} size="small"
                    sx={{ px:1.5, py:0.75, borderRadius:1.5, color: active ? 'primary.main' : 'text.secondary',
                      fontWeight: active ? 700 : 500, bgcolor: active ? '#eff6ff' : 'transparent',
                      fontSize:'0.8rem', '&:hover':{ bgcolor:'action.hover', color:'primary.main' } }}>
                    {item.label}
                  </Button>
                );
              })}
            </Box>
          )}
          <Box sx={{ display:'flex', alignItems:'center', gap:0.5 }}>
            <Tooltip title={activeFlags > 0 ? `${activeFlags} flag(s) active` : 'Feature Flags (dev)'}>
              <IconButton onClick={openPanel} size="small"
                sx={{ opacity: activeFlags > 0 ? 1 : 0.12, '&:hover':{ opacity:1 }, transition:'opacity 0.2s' }}>
                <Badge badgeContent={activeFlags || undefined} color="error"><BugIcon fontSize="small" /></Badge>
              </IconButton>
            </Tooltip>
            <Tooltip title={user?.email ?? ''}>
              <IconButton onClick={e => setAnchorEl(e.currentTarget)} sx={{ p:0.5 }}>
                <Avatar sx={{ width:34, height:34, bgcolor:'primary.main', fontSize:'0.85rem', fontWeight:700 }}>
                  {getInitials()}
                </Avatar>
              </IconButton>
            </Tooltip>
            <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}
              anchorOrigin={{ vertical:'bottom', horizontal:'right' }}
              transformOrigin={{ vertical:'top', horizontal:'right' }}
              PaperProps={{ sx:{ mt:0.5, minWidth:200, borderRadius:2, boxShadow:'0 8px 32px rgba(0,0,0,0.12)' } }}>
              <Box sx={{ px:2, py:1.5, borderBottom:'1px solid #f1f5f9' }}>
                <Typography variant="body2" fontWeight={700}>{user?.firstName} {user?.lastName}</Typography>
                <Typography variant="caption" color="text.secondary">{user?.email}</Typography>
              </Box>
              {NAV_ITEMS.map(n => (
                <MenuItem key={n.path} onClick={() => { navigate(n.path); setAnchorEl(null); }} dense>
                  <ListItemIcon sx={{ minWidth:32 }}><n.icon sx={{ fontSize:'1rem' }} /></ListItemIcon>
                  {n.label}
                </MenuItem>
              ))}
              <Divider />
              <MenuItem onClick={handleLogout} dense sx={{ color:'error.main' }}>
                <ListItemIcon sx={{ minWidth:32 }}><LogoutIcon fontSize="small" color="error" /></ListItemIcon>
                Logout
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Mobile Drawer */}
      <Drawer anchor="left" open={mobileDrawer} onClose={() => setMobileDrawer(false)}
        PaperProps={{ sx:{ width:260 } }}>
        <Box sx={{ p:2, borderBottom:'1px solid #f1f5f9' }}>
          <Typography variant="subtitle1" fontWeight={800} color="primary.main">🏦 HomeBanking</Typography>
          <Typography variant="caption" color="text.secondary">{user?.email}</Typography>
        </Box>
        <List dense>
          {NAV_ITEMS.map(item => {
            const active = location.pathname === item.path;
            return (
              <ListItemButton key={item.path} selected={active}
                onClick={() => { navigate(item.path); setMobileDrawer(false); }}
                sx={{ borderRadius:1, mx:1, mb:0.5 }}>
                <ListItemIcon sx={{ minWidth:36 }}>
                  <item.icon color={active ? 'primary' : 'inherit'} sx={{ fontSize:'1.1rem' }} />
                </ListItemIcon>
                <ListItemText primary={item.label}
                  primaryTypographyProps={{ fontWeight: active ? 700 : 400, fontSize:'0.9rem' }} />
              </ListItemButton>
            );
          })}
        </List>
        <Divider sx={{ mt:'auto' }} />
        <ListItemButton onClick={handleLogout} sx={{ color:'error.main', m:1 }}>
          <ListItemIcon sx={{ minWidth:36 }}><LogoutIcon fontSize="small" color="error" /></ListItemIcon>
          <ListItemText primary="Logout" primaryTypographyProps={{ color:'error', fontWeight:600 }} />
        </ListItemButton>
      </Drawer>

      {/* Maintenance Banner */}
      {flags.showMaintenanceBanner && (
        <Alert severity="info" sx={{ borderRadius:0, py:0.5, width:'100%' }}>
          🔧 Scheduled maintenance tonight 23:00–01:00. Some features may be temporarily unavailable.
        </Alert>
      )}

      <FeatureFlagPanel />

      {/* Main */}
      <Box component="main"
        sx={{ flex:1, width:'100%', maxWidth:'100%', py:{ xs:2, md:3 }, px:{ xs:1.5, sm:2.5, md:3, lg:4 },
          bgcolor:'#f0f2f5', boxSizing:'border-box', overflowX:'hidden' }}>
        {title && <Typography variant="h5" sx={{ mb:2.5, fontWeight:700 }}>{title}</Typography>}
        {children}
      </Box>

      <Footer />
    </Box>
  );
};
