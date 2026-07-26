const { query } = require('../config/database');
const { findBestVolunteers } = require('../services/matchingService');
const { autoAssignForTask } = require('../services/assignmentService');
const geminiService = require('../services/geminiService');
const { getIO } = require('../websocket/socketManager');
const logger = require('../utils/logger');

// ==========================
// POST /api/tasks (admin)
// ==========================
const createTask = async (req, res) => {
  const {
    title,
    description,
    category,
    urgency,
    latitude,
    longitude,
    address,
    required_skills,
    required_volunteers = 1,
  } = req.body;

  try {
    const result = await query(
      `INSERT INTO tasks
         (created_by, title, description, category, urgency, status,
          required_skills, required_volunteers, lat, lng, address)
       VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        req.user.id,
        title,
        description,
        category,
        urgency,
        Array.isArray(required_skills) ? required_skills : [],
        required_volunteers || 1,
        parseFloat(latitude),
        parseFloat(longitude),
        address || null,
      ]
    );

    const task = result.rows[0];

    const io = getIO();
    if (io) {
      io.emit('task:new', {
        id: task.id,
        title: task.title,
        category: task.category,
        urgency: task.urgency,
        status: task.status,
        lat: task.lat,
        lng: task.lng,
      });
    }

    // Auto-assign immediately (best-effort; do not fail task creation)
    let autoAssignment = null;
    try {
      autoAssignment = await autoAssignForTask(task.id, req.user.id);
    } catch (e) {
      logger.warn('Auto-assignment skipped/failed', { taskId: task.id, error: e.message });
    }

    return res.status(201).json({
      success: true,
      data: { task, auto_assignment: autoAssignment },
    });
  } catch (err) {
    logger.error('Create task error', { error: err.message });
    return res.status(500).json({ success: false, message: 'Failed to create task' });
  }
};

// ==========================
// GET /api/tasks
// ==========================
const getTasks = async (req, res) => {
  const {
    page = 1,
    limit = 20,
    status,
    category,
    urgency,
  } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const params = [];
  const conditions = [];
  let idx = 1;

  if (status) {
    conditions.push(`t.status = $${idx++}`);
    params.push(status);
  }

  if (category) {
    conditions.push(`t.category = $${idx++}`);
    params.push(category);
  }

  if (urgency) {
    conditions.push(`t.urgency = $${idx++}`);
    params.push(urgency);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const countRes = await query(`SELECT COUNT(*) FROM tasks t ${whereClause}`, params);
    const total = parseInt(countRes.rows[0].count);

    const dataRes = await query(
      `SELECT 
          t.*,
          u.full_name AS creator_name,
          (SELECT COUNT(*) FROM assignments a WHERE a.task_id = t.id) AS assignment_count,
          (
            SELECT COALESCE(
              json_agg(json_build_object('volunteer_id', vu.id, 'volunteer_name', vu.full_name) ORDER BY vu.full_name),
              '[]'::json
            )
            FROM assignments a2
            JOIN users vu ON vu.id = a2.volunteer_id
            WHERE a2.task_id = t.id AND a2.status IN ('pending', 'accepted', 'completed')
          ) AS assigned_volunteers,
          leader_u.full_name AS leader_name,
          (t.metadata->>'leader_id') AS leader_id
       FROM tasks t
       LEFT JOIN users u ON u.id = t.created_by
       LEFT JOIN users leader_u ON leader_u.id::text = (t.metadata->>'leader_id')
       ${whereClause}
       ORDER BY t.ai_priority_score DESC, t.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, parseInt(limit), offset]
    );

    return res.json({
      success: true,
      data: {
        tasks: dataRes.rows,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (err) {
    logger.error('Get tasks error', { error: err.message });
    return res.status(500).json({ success: false, message: 'Failed to fetch tasks' });
  }
};

// ==========================
// GET /api/tasks/:id
// ==========================
const getTaskById = async (req, res) => {
  try {
    const result = await query(
      `SELECT 
          t.*,
          u.full_name AS creator_name,
          json_agg(
            json_build_object(
              'id', a.id,
              'volunteer_id', a.volunteer_id,
              'volunteer_name', vu.full_name,
              'match_score', a.match_score,
              'ai_match_reason', a.ai_match_reason,
              'accepted_at', a.accepted_at
            )
          ) FILTER (WHERE a.id IS NOT NULL) AS assignments
       FROM tasks t
       LEFT JOIN users u ON u.id = t.created_by
       LEFT JOIN assignments a ON a.task_id = t.id
       LEFT JOIN users vu ON vu.id = a.volunteer_id
       WHERE t.id = $1
       GROUP BY t.id, u.full_name`,
      [req.params.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    return res.json({ success: true, data: { task: result.rows[0] } });
  } catch (err) {
    logger.error('Get task by id error', { error: err.message });
    return res.status(500).json({ success: false, message: 'Failed to fetch task' });
  }
};

// ==========================
// PUT /api/tasks/:id/status
// ==========================
const updateTaskStatus = async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['pending', 'assigned', 'in_progress', 'completed', 'cancelled'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status' });
  }

  try {
    const result = await query(
      `UPDATE tasks 
       SET status = $1, completed_at = $2, updated_at = NOW()
       WHERE id = $3 
       RETURNING *`,
      [status, status === 'completed' ? new Date() : null, req.params.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const io = getIO();
    if (io) {
      io.emit('task:updated', {
        id: req.params.id,
        status,
      });
    }

    return res.json({ success: true, data: { task: result.rows[0] } });
  } catch (err) {
    logger.error('Update task status error', { error: err.message });
    return res.status(500).json({ success: false, message: 'Failed to update task status' });
  }
};

// ==========================
// GET /api/tasks/map
// ==========================
const getTasksForMap = async (req, res) => {
  try {
    const result = await query(
      `SELECT 
          id,
          title,
          category,
          urgency,
          status,
          address,
          lat,
          lng,
          ai_priority_score,
          created_at
       FROM tasks
       WHERE lat IS NOT NULL 
         AND lng IS NOT NULL
         AND status NOT IN ('completed', 'cancelled')
       ORDER BY ai_priority_score DESC
       LIMIT 500`
    );

    return res.json({
      success: true,
      data: {
        tasks: result.rows,
      },
    });
  } catch (err) {
    logger.error('Map fetch error', { error: err.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch map data',
    });
  }
};

// ==========================
// GET /api/tasks/:id/matches (admin)
// ==========================
const getTaskMatches = async (req, res) => {
  const { useAI = 'false', limit = 10, radius_km = 50 } = req.query;
  try {
    const data = await findBestVolunteers(req.params.id, {
      useAI: useAI === 'true',
      limit: parseInt(limit),
      radiusKm: parseFloat(radius_km),
    });
    return res.json({ success: true, data });
  } catch (err) {
    logger.error('Get task matches error', { error: err.message });
    if (err.message === 'Task not found') return res.status(404).json({ success: false, message: err.message });
    return res.status(500).json({ success: false, message: 'Failed to fetch matches' });
  }
};

// ==========================
// POST /api/tasks/:id/auto-assign (admin)
// ==========================
const autoAssign = async (req, res) => {
  try {
    const result = await autoAssignForTask(req.params.id, req.user.id);
    return res.json({ success: true, data: result });
  } catch (err) {
    logger.error('Auto-assign error', { error: err.message });
    if (err.message === 'Task not found') return res.status(404).json({ success: false, message: err.message });
    return res.status(500).json({ success: false, message: 'Auto-assign failed' });
  }
};

// ==========================
// GET /api/tasks/insights
// ==========================
const getAreaInsights = async (req, res) => {
  const { lat, lng, radius_km = 10 } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({ success: false, message: 'lat and lng required' });
  }

  try {
    const result = await query(
      `SELECT id, title, category, urgency, status
       FROM tasks
       WHERE lat IS NOT NULL AND lng IS NOT NULL
       LIMIT 50`
    );

    const insight = await geminiService.generateAreaInsights('Selected Area', result.rows);

    return res.json({
      success: true,
      data: {
        insight,
      },
    });
  } catch (err) {
    logger.error('Insights error', { error: err.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to generate insights',
    });
  }
};

const requestJoinTask = async (req, res) => {
  const { message } = req.body || {};
  try {
    const taskRes = await query(
      `SELECT id, title, created_by, status FROM tasks WHERE id = $1`,
      [req.params.id]
    );
    if (!taskRes.rows.length) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    const task = taskRes.rows[0];
    if (!task.created_by) {
      return res.status(400).json({ success: false, message: 'Task has no owner' });
    }
    if (['completed', 'cancelled'].includes(task.status)) {
      return res.status(400).json({ success: false, message: 'Task is not open for join requests' });
    }

    const existing = await query(
      `SELECT id FROM assignments WHERE task_id = $1 AND volunteer_id = $2 AND status IN ('pending','accepted')`,
      [task.id, req.user.id]
    );
    if (existing.rows.length) {
      return res.status(409).json({ success: false, message: 'You already requested or got assigned for this task' });
    }

    const notifRes = await query(
      `INSERT INTO notifications (user_id, type, title, message, data)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        task.created_by,
        'task_join_request',
        'Volunteer join request',
        `${req.user.full_name} requested to join "${task.title}".`,
        {
          task_id: task.id,
          task_title: task.title,
          volunteer_id: req.user.id,
          volunteer_name: req.user.full_name,
          request_message: String(message || '').trim(),
        },
      ]
    );

    const io = getIO();
    if (io) {
      io.to(`user:${task.created_by}`).emit('notification:new', notifRes.rows[0]);
      io.to('admin').emit('notification:new', notifRes.rows[0]);
    }

    return res.status(201).json({ success: true, data: { notification: notifRes.rows[0] } });
  } catch (err) {
    logger.error('Request join task error', { error: err.message });
    return res.status(500).json({ success: false, message: 'Failed to send join request' });
  }
};

const startLeaderSession = async (req, res) => {
  const { task_id, selfie_image, selfie_geo, expected_volunteers, scanned_tokens = [] } = req.body || {};
  if (!task_id || !selfie_image || !selfie_geo) {
    return res.status(400).json({ success: false, message: 'task_id, selfie_image and selfie_geo are required' });
  }
  try {
    const taskRes = await query(`SELECT id, metadata FROM tasks WHERE id = $1`, [task_id]);
    if (!taskRes.rows.length) return res.status(404).json({ success: false, message: 'Task not found' });
    const task = taskRes.rows[0];
    const metadata = task.metadata || {};
    const leaderId = metadata?.leader_id || null;
    if (!leaderId || String(leaderId) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: 'Only selected leader can start this task' });
    }
    const session = {
      started_at: new Date().toISOString(),
      leader_id: req.user.id,
      expected_volunteers: Number(expected_volunteers || scanned_tokens.length || 1),
      scanned_tokens_start: Array.from(new Set((scanned_tokens || []).map((s) => String(s)))),
      selfie_geo,
      selfie_image,
      status: 'started',
    };
    const nextMetadata = { ...metadata, live_session: session };
    await query(`UPDATE tasks SET metadata = $2, status = 'in_progress', updated_at = NOW() WHERE id = $1`, [task_id, nextMetadata]);
    return res.json({ success: true, data: { session } });
  } catch (err) {
    logger.error('Start leader session error', { error: err.message });
    return res.status(500).json({ success: false, message: 'Failed to start task session' });
  }
};

const endLeaderSession = async (req, res) => {
  const { task_id, group_image, group_geo, scanned_tokens = [] } = req.body || {};
  if (!task_id || !group_image || !group_geo) {
    return res.status(400).json({ success: false, message: 'task_id, group_image and group_geo are required' });
  }
  try {
    const taskRes = await query(`SELECT id, metadata FROM tasks WHERE id = $1`, [task_id]);
    if (!taskRes.rows.length) return res.status(404).json({ success: false, message: 'Task not found' });
    const task = taskRes.rows[0];
    const metadata = task.metadata || {};
    const leaderId = metadata?.leader_id || null;
    if (!leaderId || String(leaderId) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: 'Only selected leader can end this task' });
    }

    const liveSession = metadata.live_session || {};
    const finalSession = {
      ...liveSession,
      ended_at: new Date().toISOString(),
      scanned_tokens_end: Array.from(new Set((scanned_tokens || []).map((s) => String(s)))),
      group_geo,
      group_image,
      status: 'completed',
    };
    const nextMetadata = { ...metadata, live_session: finalSession };
    await query(`UPDATE tasks SET metadata = $2, status = 'completed', completed_at = NOW(), updated_at = NOW() WHERE id = $1`, [task_id, nextMetadata]);
    return res.json({ success: true, data: { session: finalSession } });
  } catch (err) {
    logger.error('End leader session error', { error: err.message });
    return res.status(500).json({ success: false, message: 'Failed to end task session' });
  }
};

const setTaskLeader = async (req, res) => {
  const { volunteer_id } = req.body || {};
  if (!volunteer_id) {
    return res.status(400).json({ success: false, message: 'volunteer_id is required' });
  }
  try {
    const taskRes = await query(`SELECT id FROM tasks WHERE id = $1`, [req.params.id]);
    if (!taskRes.rows.length) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const assignmentRes = await query(
      `SELECT id
       FROM assignments
       WHERE task_id = $1 AND volunteer_id = $2 AND status IN ('pending', 'accepted', 'completed')`,
      [req.params.id, volunteer_id]
    );
    if (!assignmentRes.rows.length) {
      return res.status(400).json({ success: false, message: 'Volunteer is not assigned to this task' });
    }

    const result = await query(
      `UPDATE tasks
       SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{leader_id}', to_jsonb($2::text), true),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [req.params.id, volunteer_id]
    );

    const io = getIO();
    if (io) io.emit('task:updated', { id: req.params.id, leader_id: volunteer_id });

    return res.json({ success: true, data: { task: result.rows[0] } });
  } catch (err) {
    logger.error('Set task leader error', { error: err.message });
    return res.status(500).json({ success: false, message: 'Failed to set leader' });
  }
};

module.exports = {
  createTask,
  getTasks,
  getTaskById,
  updateTaskStatus,
  getTasksForMap,
  getTaskMatches,
  autoAssign,
  getAreaInsights,
  requestJoinTask,
  setTaskLeader,
  startLeaderSession,
  endLeaderSession,
};