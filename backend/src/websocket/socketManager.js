const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

let io = null;

const initializeSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.WS_CORS_ORIGIN || process.env.FRONTEND_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Auth middleware for socket connections
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];

    if (!token) {
      // Allow unauthenticated connections for public events
      socket.userId = null;
      socket.userRole = 'guest';
      return next();
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      socket.userRole = decoded.role;
      next();
    } catch (err) {
      socket.userId = null;
      socket.userRole = 'guest';
      next();
    }
  });

  io.on('connection', (socket) => {
    logger.debug('WebSocket connected', { socketId: socket.id, userId: socket.userId });

    // Join personal room if authenticated
    if (socket.userId) {
      socket.join(`user:${socket.userId}`);
      socket.join(`volunteer:${socket.userId}`);
      if (socket.userRole === 'admin') socket.join('admin');
    }

    // Join a map room for real-time map updates
    socket.on('join:map', () => {
      socket.join('map');
      logger.debug('Client joined map room', { socketId: socket.id });
    });

    // Volunteer updates their location
    socket.on('volunteer:location', async (data) => {
      if (!socket.userId) return;
      const { lat, lng } = data;
      try {
        const { query } = require('../config/database');
        await query(
          `UPDATE volunteer_profiles SET location = ST_MakePoint($2, $1)::geography WHERE user_id = $3`,
          [parseFloat(lat), parseFloat(lng), socket.userId]
        );
        // Broadcast to map room
        io.to('map').emit('volunteer:moved', {
          userId: socket.userId,
          lat,
          lng,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        logger.error('Location update error', { error: err.message });
      }
    });

    // Volunteer status update
    socket.on('volunteer:status', async (data) => {
      if (!socket.userId) return;
      const { availability } = data;
      try {
        const { query } = require('../config/database');
        await query(
          `UPDATE volunteer_profiles SET availability = $1 WHERE user_id = $2`,
          [availability, socket.userId]
        );
        io.emit('volunteer:status_changed', { userId: socket.userId, availability });
      } catch (err) {
        logger.error('Status update error', { error: err.message });
      }
    });

    socket.on('disconnect', () => {
      logger.debug('WebSocket disconnected', { socketId: socket.id });
    });
  });

  logger.info('WebSocket server initialized');
  return io;
};

const getIO = () => io;

// Helper: emit to specific user
const emitToUser = (userId, event, data) => {
  if (io) io.to(`user:${userId}`).emit(event, data);
};

// Helper: broadcast to all
const broadcast = (event, data) => {
  if (io) io.emit(event, data);
};

module.exports = { initializeSocket, getIO, emitToUser, broadcast };
