# 🏦 HomeBanking Web Frontend

A modern React TypeScript web application providing a complete user interface for the HomeBanking microservices platform.

## 🎯 Features

- **Authentication**: User login and registration with JWT token management
- **Dashboard**: Overview of accounts, recent transactions, and notifications
- **Account Management**: Create, view, and manage multiple accounts
- **Transactions**: View transaction history and create new transactions
- **Notifications**: Receive and manage transaction notifications
- **Responsive Design**: Fully responsive UI that works on desktop and mobile devices
- **Real-time Updates**: Live data fetching from backend microservices
- **Error Handling**: Comprehensive error handling and user feedback

## 📋 Prerequisites

- Node.js 18+ and npm
- Backend API Gateway running on http://localhost:8080
- All microservices running (Auth, Account, Transaction, Notification services)

## 🚀 Installation & Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Create or update `.env` file:
```bash
REACT_APP_API_URL=http://localhost:8080
REACT_APP_ENV=development
```

### 3. Start Development Server
```bash
npm install --legacy-peer-deps
npm start
```

The application will open automatically at **http://localhost:3008**

**⚠️ Note:** The frontend runs on port 3008 (Grafana uses port 3000)

## 📁 Project Structure

```
src/
├── api/
│   └── client.ts                 # Axios HTTP client with JWT interceptors
├── services/
│   ├── authService.ts            # Authentication API calls
│   ├── accountService.ts         # Account management API calls
│   ├── transactionService.ts     # Transaction API calls
│   └── notificationService.ts    # Notification API calls
├── context/
│   └── UserContext.tsx           # Global user authentication state
├── pages/
│   ├── Login.tsx                 # Login page
│   ├── Register.tsx              # User registration page
│   ├── Dashboard.tsx             # Main dashboard
│   ├── Accounts.tsx              # Account management
│   ├── Transactions.tsx          # Transaction history & creation
│   ├── Notifications.tsx         # Notification center
│   ├── Login.css
│   ├── Register.css
│   ├── Dashboard.css
│   ├── Accounts.css
│   ├── Transactions.css
│   └── Notifications.css
├── App.tsx                       # Main app with routing
├── App.css
├── index.tsx                     # React entry point
├── index.css                     # Global styles
└── react-app-env.d.ts            # TypeScript definitions

public/
├── index.html                    # HTML entry point
└── favicon.ico                   # Browser tab icon
```

## 🔐 Authentication Flow

1. User navigates to http://localhost:3000
2. If not logged in, redirected to `/login`
3. User enters credentials and logs in
4. JWT token stored in `localStorage` under key `token`
5. Token automatically added to all API requests via axios interceptor
6. On 401 error, user automatically redirected to login
7. Token cleared on logout

## 🛣️ Route Structure

| Route | Component | Protected |
|-------|-----------|-----------|
| `/login` | Login | No |
| `/register` | Register | No |
| `/dashboard` | Dashboard | Yes |
| `/accounts` | Accounts | Yes |
| `/transactions` | Transactions | Yes |
| `/notifications` | Notifications | Yes |
| `/` | Redirects to `/dashboard` | - |

## 🔌 API Integration

All API calls go through the centralized axios client at `src/api/client.ts`:

### Features:
- Base URL configured from `REACT_APP_API_URL`
- Request interceptor adds JWT token to `Authorization` header
- Response interceptor handles 401 errors with auto-redirect to login
- All responses parsed as JSON

### Service Layer Pattern:
Each service file exports functions that use the axios client:

```typescript
// Example: accountService.ts
export const accountService = {
  listAccounts: (userId: number) => 
    client.get<Account[]>(`/api/accounts?user_id=${userId}`),
  createAccount: (account: CreateAccountRequest) => 
    client.post<Account>('/api/accounts', account),
  // ... more methods
};
```

## 🎨 Styling

- **Color Scheme**: Purple gradient (`#667eea` to `#764ba2`)
- **Framework**: Pure CSS (no CSS library dependency)
- **Responsive**: Mobile-first design with breakpoints at 768px and 480px
- **Components**: Cards, forms, buttons with consistent styling

## 📱 Responsive Breakpoints

- **Desktop**: Full width, multi-column grids
- **Tablet** (< 768px): Single column layouts, adjusted spacing
- **Mobile** (< 480px): Full-width elements, touch-friendly buttons

## 🧪 Testing the Application

### Demo Accounts
Two pre-created demo accounts are available:

**Account 1:**
- Email: `alice@example.com`
- Password: `password123`

**Account 2:**
- Email: `bob@example.com`
- Password: `password123`

### Typical User Flow:
1. Login with demo account
2. View dashboard with accounts and transactions
3. Navigate to Accounts page to manage accounts
4. Create a new account with initial balance
5. Navigate to Transactions page to view and create transactions
6. View notifications center
7. Logout to return to login page

## 🔧 Development

### Available Scripts

```bash
# Start development server with hot reload
npm start

# Build for production
npm run build

# Run tests
npm run test

# Build and run production build
npm run build
npx serve -s build -l 3000
```

### Environment Variables

```env
# API Base URL (required)
REACT_APP_API_URL=http://localhost:8080

# Environment (optional, used for logging/debugging)
REACT_APP_ENV=development
```

## 🐛 Troubleshooting

### Port 3000 Already in Use
```bash
# On macOS/Linux
lsof -i :3000
kill -9 <PID>

# On Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### Cannot Connect to API
- Verify API Gateway is running on http://localhost:8080
- Check network tab in browser DevTools
- Verify `REACT_APP_API_URL` is set correctly
- Check backend logs for errors

### JWT Token Not Working
- Clear `localStorage` and try logging in again
- Check token expiry (typical: 24 hours)
- Verify backend is issuing tokens correctly

### CORS Errors
- Ensure API Gateway has CORS enabled
- Check that `http://localhost:3000` is in allowed origins

## 📚 Dependencies

- **react**: UI library
- **react-router-dom**: Client-side routing
- **typescript**: Type safety
- **axios**: HTTP client
- No additional UI library (pure CSS styling)

## 🚀 Deployment

### Build for Production
```bash
npm run build
```

Creates optimized build in `build/` directory.

### Environment for Production
```env
REACT_APP_API_URL=https://api.yourdomain.com
REACT_APP_ENV=production
```

### Deploy to Hosting
- **Netlify**: Drag & drop `build/` folder
- **Vercel**: Connect GitHub repo
- **AWS S3 + CloudFront**: Upload `build/` to S3
- **Docker**: Create Dockerfile for containerization

## 📞 Support

For issues or questions:
1. Check the browser console for error messages
2. Review network requests in DevTools
3. Check backend service logs
4. Review `/memories/` directory for previous solutions

---

**Last Updated**: 2024
**Framework**: React 18 + TypeScript 5
