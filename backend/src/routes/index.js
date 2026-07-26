const express = require('express');
const { body, param, query } = require('express-validator');
const { authenticate, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');

// Controllers
const authController = require('../controllers/authController');
const reportController = require('../controllers/reportController');
const taskController = require('../controllers/taskController');
const assignmentController = require('../controllers/assignmentController');
const volunteerController = require('../controllers/volunteerController');
const dashboardController = require('../controllers/dashboardController');
const ngoController = require('../controllers/ngoController');
const matchController = require('../controllers/matchController');
const sosController = require('../controllers/sosController');
const notificationController = require('../controllers/notificationController');

const router = express.Router();
const satelliteRoutes = require("./satelliteRoutes");

router.use("/satellite", satelliteRoutes);
const disasterRoutes = require("./disasterRoutes");

router.use("/disaster", disasterRoutes);

// ─── AUTH ──────────────────────────────────────────────────────────────────────
router.post('/auth/signup',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('full_name').trim().isLength({ min: 2 }),
    body('role').optional().isIn(['admin', 'volunteer']),
  ],
  validate,
  authController.signup
);

router.post('/auth/login',
  [body('email').isEmail(), body('password').notEmpty()],
  validate,
  authController.login
);

router.post('/auth/refresh',
  [body('refreshToken').notEmpty()],
  validate,
  authController.refresh
);

router.post('/auth/logout', authController.logout);
router.get('/auth/me', authenticate, authController.me);

// ─── REPORTS ───────────────────────────────────────────────────────────────────
router.post('/reports',
  authenticate,
  [
    body('title').trim().isLength({ min: 5, max: 500 }),
    body('description').trim().isLength({ min: 10 }),
    body('category').isIn(['food', 'health', 'shelter', 'education', 'water', 'sanitation', 'mental_health', 'disaster_relief', 'other']),
    body('urgency').isIn(['low', 'medium', 'high', 'critical']),
    body('latitude').isFloat({ min: -90, max: 90 }),
    body('longitude').isFloat({ min: -180, max: 180 }),
    body('address').trim().isLength({ min: 3 }),
  ],
  validate,
  reportController.createReport
);

router.get('/reports', authenticate, reportController.getReports);
router.get('/reports/central/insights', authenticate, requireRole('admin'), reportController.getCentralInsights);

router.post('/reports/:id/convert',
  authenticate,
  requireRole('admin'),
  [param('id').isUUID()],
  validate,
  reportController.convertToTask
);

// ─── TASKS ─────────────────────────────────────────────────────────────────────
router.get('/tasks/map', taskController.getTasksForMap);
router.get('/tasks/insights', authenticate, taskController.getAreaInsights);
router.post(
  '/tasks',
  authenticate,
  requireRole('admin'),
  [
    body('title').trim().isLength({ min: 5, max: 500 }),
    body('description').trim().isLength({ min: 3 }),
    body('category').isIn(['food', 'health', 'shelter', 'education', 'water', 'sanitation', 'mental_health', 'disaster_relief', 'other']),
    body('urgency').isIn(['low', 'medium', 'high', 'critical']),
    body('latitude').isFloat({ min: -90, max: 90 }),
    body('longitude').isFloat({ min: -180, max: 180 }),
    body('required_skills').optional().isArray(),
    body('required_volunteers').optional().isInt({ min: 1, max: 50 }),
  ],
  validate,
  taskController.createTask
);
router.get('/tasks', authenticate, taskController.getTasks);
router.get('/tasks/:id', authenticate, [param('id').isUUID()], validate, taskController.getTaskById);
router.get('/tasks/:id/matches', authenticate, requireRole('admin'), [param('id').isUUID()], validate, taskController.getTaskMatches);
router.post('/tasks/:id/join-request', authenticate, requireRole('volunteer'), [param('id').isUUID()], validate, taskController.requestJoinTask);
router.put('/tasks/:id/leader', authenticate, requireRole('admin'), [param('id').isUUID(), body('volunteer_id').isUUID()], validate, taskController.setTaskLeader);
router.post('/tasks/start-session', authenticate, requireRole('volunteer'), taskController.startLeaderSession);
router.post('/tasks/end-session', authenticate, requireRole('volunteer'), taskController.endLeaderSession);

router.put('/tasks/:id/status',
  authenticate,
  [
    param('id').isUUID(),
    body('status').isIn(['pending', 'assigned', 'in_progress', 'completed', 'cancelled']),
  ],
  validate,
  taskController.updateTaskStatus
);

router.post('/tasks/:id/auto-assign',
  authenticate,
  requireRole('admin'),
  [param('id').isUUID()],
  validate,
  taskController.autoAssign
);

// ─── ASSIGNMENTS ────────────────────────────────────────────────────────────────
router.post('/assignments',
  authenticate,
  requireRole('admin'),
  [
    body('task_id').isUUID(),
    body('volunteer_id').isUUID(),
  ],
  validate,
  assignmentController.createAssignment
);

router.get('/assignments', authenticate, assignmentController.getAssignments);
router.put('/assignments/:id/accept', authenticate, [param('id').isUUID()], validate, assignmentController.acceptAssignment);
router.put(
  '/assignments/:id/reject',
  authenticate,
  [param('id').isUUID(), body('reason').trim().isLength({ min: 5, max: 1000 })],
  validate,
  assignmentController.rejectAssignment
);
router.put('/assignments/:id/complete', authenticate, [param('id').isUUID()], validate, assignmentController.completeAssignment);

// ─── VOLUNTEERS ─────────────────────────────────────────────────────────────────
router.get('/volunteers/map', volunteerController.getVolunteersForMap);
router.get('/volunteers', authenticate, requireRole('admin'), volunteerController.getVolunteers);
router.get('/volunteers/:id', authenticate, volunteerController.getVolunteerById);
router.put('/volunteers/profile', authenticate, requireRole('volunteer'), volunteerController.updateProfile);

// ─── NGOS ───────────────────────────────────────────────────────────────────────
router.get('/ngos/map', ngoController.getNgosForMap);

// ─── MATCHING ───────────────────────────────────────────────────────────────────
router.get('/match/nearby', authenticate, matchController.getNearby);

// ─── DASHBOARD ─────────────────────────────────────────────────────────────────
router.get('/dashboard/stats', authenticate, requireRole('admin'), dashboardController.getStats);
router.get('/dashboard/weekly-summary', authenticate, requireRole('admin'), dashboardController.getWeeklySummary);
router.get('/dashboard/volunteer-stats', authenticate, requireRole('volunteer'), dashboardController.getVolunteerStats);

// ─── SOS ────────────────────────────────────────────────────────────────────────
router.post(
  '/sos',
  [
    body('lat').isFloat({ min: -90, max: 90 }),
    body('lng').isFloat({ min: -180, max: 180 }),
    body('user_id').isString().trim().isLength({ min: 1 }),
    body('radius_km').optional().isFloat({ min: 1, max: 250 }),
  ],
  validate,
  sosController.postSos
);

router.post(
  '/sos/sms',
  [
    body('lat').isFloat({ min: -90, max: 90 }),
    body('lng').isFloat({ min: -180, max: 180 }),
    body('user_id').isString().trim().isLength({ min: 1 }),
    body('phones').optional().isArray(),
  ],
  validate,
  sosController.postSosSms
);
router.post(
  '/sos/ack',
  [
    body('sos_id').isString().trim().isLength({ min: 1 }),
    body('user_id').isString().trim().isLength({ min: 1 }),
    body('responder_id').isString().trim().isLength({ min: 1 }),
    body('responder_name').optional().isString(),
    body('message').optional().isString(),
  ],
  validate,
  sosController.postSosAck
);

// ─── NOTIFICATIONS ─────────────────────────────────────────────────────────────
router.get('/notifications', authenticate, notificationController.listNotifications);
router.put('/notifications/:id/read', authenticate, [param('id').isUUID()], validate, notificationController.markRead);
router.put(
  '/notifications/:id/respond',
  authenticate,
  requireRole('admin'),
  [param('id').isUUID(), body('action').isIn(['accept', 'reject']), body('message').optional().isString()],
  validate,
  notificationController.respondJoinRequest
);

module.exports = router;
