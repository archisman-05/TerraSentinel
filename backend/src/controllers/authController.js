const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { query, withTransaction } = require('../config/database');
const logger = require('../utils/logger');

const generateTokens = (userId, role) => {
  const accessToken = jwt.sign(
    { userId, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );
  const refreshToken = jwt.sign(
    { userId, role, jti: uuidv4() },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
  return { accessToken, refreshToken };
};

// POST /api/auth/signup
const signup = async (req, res) => {
  const { email, password, full_name, role = 'volunteer', phone, skills = [] } = req.body;

  try {
    // Check existing user
    const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    const password_hash = await bcrypt.hash(password, 12);

    const result = await withTransaction(async (client) => {
      // Create user
      const userRes = await client.query(
        `INSERT INTO users (email, password_hash, full_name, role, phone)
         VALUES ($1, $2, $3, $4, $5) RETURNING id, email, full_name, role, phone`,
        [email.toLowerCase(), password_hash, full_name, role, phone || null]
      );
      const user = userRes.rows[0];

      // Create volunteer profile if role is volunteer
      if (role === 'volunteer') {
        await client.query(
          `INSERT INTO volunteer_profiles (user_id, skills) VALUES ($1, $2)`,
          [user.id, Array.isArray(skills) ? skills : []]
        );
      }

      return user;
    });

    const { accessToken, refreshToken } = generateTokens(result.id, result.role);

    // Store refresh token
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [result.id, refreshToken, expiresAt]
    );

    logger.info('New user registered', { userId: result.id, role: result.role });

    return res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: {
        user: { id: result.id, email: result.email, full_name: result.full_name, role: result.role, phone: result.phone },
        accessToken,
        refreshToken,
      },
    });
  } catch (err) {
    logger.error('Signup error', { error: err.message });
    return res.status(500).json({ success: false, message: 'Registration failed' });
  }
};

// POST /api/auth/login
const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await query(
      'SELECT id, email, password_hash, full_name, role, phone, is_active FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (!result.rows.length) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({ success: false, message: 'Account suspended' });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const { accessToken, refreshToken } = generateTokens(user.id, user.role);

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, refreshToken, expiresAt]
    );

    logger.info('User logged in', { userId: user.id });

    return res.json({
      success: true,
      data: {
        user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role, phone: user.phone },
        accessToken,
        refreshToken,
      },
    });
  } catch (err) {
    logger.error('Login error', { error: err.message, code: err.code });
    // Provide actionable error messages in development
    if (err.code === 'ECONNREFUSED' || err.code === '57P03' || err.code === '3D000') {
      return res.status(500).json({
        success: false,
        message: 'Database connection failed. Check DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD in your .env file and ensure PostgreSQL is running.',
      });
    }
    if (err.message?.includes('relation "users" does not exist')) {
      return res.status(500).json({
        success: false,
        message: 'Database schema not applied. Run: npm run setup',
      });
    }
    return res.status(500).json({ success: false, message: 'Login failed. Check server logs.' });
  }
};

// POST /api/auth/refresh
const refresh = async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ success: false, message: 'Refresh token required' });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    const stored = await query(
      'SELECT id, user_id, expires_at FROM refresh_tokens WHERE token = $1',
      [refreshToken]
    );

    if (!stored.rows.length || new Date(stored.rows[0].expires_at) < new Date()) {
      return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
    }

    // Rotate refresh token
    await query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(decoded.userId, decoded.role);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [decoded.userId, newRefreshToken, expiresAt]
    );

    return res.json({ success: true, data: { accessToken, refreshToken: newRefreshToken } });
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid refresh token' });
  }
};

// POST /api/auth/logout
const logout = async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
  }
  return res.json({ success: true, message: 'Logged out' });
};

// GET /api/auth/me
const me = async (req, res) => {
  try {
    let profileData = null;
    if (req.user.role === 'volunteer') {
      const vpRes = await query(
        `SELECT skills, languages, availability, address, city, radius_km, rating, total_tasks_done,
                lat, lng, grace_points, experience_years
         FROM volunteer_profiles WHERE user_id = $1`,
        [req.user.id]
      );
      if (vpRes.rows.length) profileData = vpRes.rows[0];
    }

    return res.json({
      success: true,
      data: { ...req.user, profile: profileData },
    });
  } catch (err) {
    logger.error('Get me error', { error: err.message });
    return res.status(500).json({ success: false, message: 'Failed to fetch profile' });
  }
};

module.exports = { signup, login, refresh, logout, me };
