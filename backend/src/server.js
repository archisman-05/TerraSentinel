require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const logger = require('./utils/logger');
const routes = require('./routes/index');
const { initializeSocket } = require('./websocket/socketManager');

const app = express();
const httpServer = http.createServer(app);
app.set('trust proxy', 1);

// ─── Security Middleware ───────────────────────────────────────────────────────
app.use(helmet({ crossOriginEmbedderPolicy: false }));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Rate Limiting ─────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
  message: { success: false, message: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  // Never throttle login so legitimate users can always sign in.
  skip: (req) => req.path === '/auth/login' || req.originalUrl === '/api/auth/login',
});

app.use('/api/', limiter);

// ─── General Middleware ────────────────────────────────────────────────────────
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('combined', {
  stream: { write: (msg) => logger.info(msg.trim()) },
  skip: (req) => req.path === '/health',
}));

// ─── Health Check ──────────────────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  const { pool } = require('./config/database');
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

// ─── API Routes ────────────────────────────────────────────────────────────────
app.use('/api', routes);

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack, path: req.path });

  if (err.code === '23505') {
    return res.status(409).json({ success: false, message: 'Duplicate entry' });
  }
  if (err.code === '23503') {
    return res.status(400).json({ success: false, message: 'Referenced resource not found' });
  }

  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

// ─── Initialize WebSocket ──────────────────────────────────────────────────────
initializeSocket(httpServer);

// ─── Start Server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 8080;
httpServer.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
  logger.info(`📡 WebSocket server ready`);
  logger.info(`💚 Health: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  httpServer.close(() => {
    logger.info('HTTP server closed');
    const { pool } = require('./config/database');
    pool.end(() => {
      logger.info('Database pool closed');
      process.exit(0);
    });
  });
});
const { query } = require('./config/database');

(async () => {
  try {
    const res = await query('SELECT NOW()');
    console.log('DB CONNECTED:', res.rows);
  } catch (err) {
    console.error('DB FAILED:', err.message);
  }
})();
module.exports = { app, httpServer };
