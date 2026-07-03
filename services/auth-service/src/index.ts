import express, { Express, Request, Response } from 'express';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { logger } from './logger';

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3001;
const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';

process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught exception:', error.stack || error.message);
});

process.on('unhandledRejection', (reason: unknown) => {
  logger.error('Unhandled promise rejection:', reason);
});

// Database setup
const dbPath = path.join(__dirname, '../auth.db');
const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'OK', service: 'auth-service' });
});

// Initialize database tables
function initializeDatabase() {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        first_name TEXT,
        last_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `);
    logger.info('Database initialized successfully');

    // Insert demo users if they don't exist
    const countStmt = db.prepare('SELECT COUNT(*) as count FROM users');
    const result = countStmt.get() as any;
    
    if (result.count === 0) {
      const hash = '$2a$10$6cXMWu83yT2W5nIFPJH7POtmDADfyPyd9bitrgMBv3oQqHmx2TsbK'; // password123
      const insertStmt = db.prepare(
        'INSERT INTO users (email, password, first_name, last_name) VALUES (?, ?, ?, ?)'
      );
      insertStmt.run('test@example.com', hash, 'Test', 'User');
      insertStmt.run('alice@example.com', hash, 'Alice', 'Johnson');
      insertStmt.run('bob@example.com', hash, 'Bob', 'Smith');
      logger.info('Demo users created');
    }
  } catch (error) {
    logger.error('Failed to initialize database:', error);
  }
}

// Register endpoint
app.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    try {
      const insertStmt = db.prepare(
        'INSERT INTO users (email, password, first_name, last_name) VALUES (?, ?, ?, ?)'
      );
      const result = insertStmt.run(email, hashedPassword, firstName || null, lastName || null);

      logger.info(`User registered: ${email}`);
      res.status(201).json({
        message: 'User created successfully',
        user: { id: result.lastInsertRowid, email }
      });
    } catch (err: any) {
      if (err.message.includes('UNIQUE')) {
        logger.warn(`Registration rejected, email already exists: ${email}`);
        return res.status(409).json({ error: 'Email already exists' });
      }
      throw err;
    }
  } catch (error: any) {
    logger.error('Registration error:', error.stack || error.message);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login endpoint
app.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const selectStmt = db.prepare('SELECT * FROM users WHERE email = ?');
    const user = selectStmt.get(email) as any;

    if (!user) {
      logger.warn(`Login failed, unknown email: ${email}`);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      logger.warn(`Login failed, wrong password for: ${email}`);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      jwtSecret as string,
      { expiresIn: '24h' }
    );

    logger.info(`Login successful: ${email}`);
    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name
      }
    });
  } catch (error: any) {
    logger.error('Login error:', error.stack || error.message);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Verify token endpoint
app.post('/verify', (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, jwtSecret);

    res.json({ valid: true, user: decoded });
  } catch (error: any) {
    logger.warn('Token verification failed:', error.message);
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Centralized error handling for errors passed via next(err) or thrown synchronously in middleware
app.use((err: any, req: Request, res: Response, next: any) => {
  logger.error(`Unhandled error on ${req.method} ${req.originalUrl}: ${err.stack || err.message}`);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Initialize and start server
initializeDatabase();

const server = app.listen(port, () => {
  logger.info(`Auth Service listening on port ${port}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Shutting down Auth Service...');
  try {
    db.close();
    server.close();
  } catch (error: any) {
    logger.error('Error during shutdown:', error.stack || error.message);
  } finally {
    process.exit(0);
  }
});

export default app;
