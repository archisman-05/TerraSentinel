const { query } = require('../config/database');
const { getIO } = require('../websocket/socketManager');
const logger = require('../utils/logger');

const VALID_REJECTION_REASONS = [
  'medical emergency',
  'already busy',
  'out of town',
  'no transport',
  'unsafe location',
  'family emergency',
  'work conflict',
];

const isValidRejection = (reason) => {
  const r = String(reason || '').toLowerCase();
  return VALID_REJECTION_REASONS.some((k) => r.includes(k));
};

const createNotification = async ({ userId, type, title, message, data = {} }) => {
  const result = await query(
    `INSERT INTO notifications (user_id, type, title, message, data)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [userId, type, title, message, data]
  );
  return result.rows[0];
};

// POST /api/assignments — Manual assign
const createAssignment = async (req, res) => {
  const { task_id, volunteer_id, match_score, ai_match_reason } = req.body;

  try {
    // Verify task exists and is assignable
    const taskRes = await query(
      `SELECT id, status, title FROM tasks WHERE id = $1`,
      [task_id]
    );
    if (!taskRes.rows.length) return res.status(404).json({ success: false, message: 'Task not found' });
    if (['completed', 'cancelled'].includes(taskRes.rows[0].status)) {
      return res.status(400).json({ success: false, message: 'Cannot assign to completed/cancelled task' });
    }

    // Verify volunteer exists and is available
    const volRes = await query(
      `SELECT vp.user_id, u.full_name, vp.availability
       FROM volunteer_profiles vp JOIN users u ON u.id = vp.user_id
       WHERE vp.user_id = $1`,
      [volunteer_id]
    );
    if (!volRes.rows.length) return res.status(404).json({ success: false, message: 'Volunteer not found' });

    const assignRes = await query(
      `INSERT INTO assignments (task_id, volunteer_id, assigned_by, status, match_score, ai_match_reason)
       VALUES ($1, $2, $3, 'pending', $4, $5)
       ON CONFLICT (task_id, volunteer_id) DO NOTHING
       RETURNING *`,
      [task_id, volunteer_id, req.user.id, match_score || 0, ai_match_reason || null]
    );

    if (!assignRes.rows.length) {
      return res.status(409).json({ success: false, message: 'Volunteer already assigned to this task' });
    }

    // Update task status
    await query(`UPDATE tasks SET status = 'assigned' WHERE id = $1 AND status = 'pending'`, [task_id]);

    // Mark volunteer busy
    await query(`UPDATE volunteer_profiles SET availability = 'busy' WHERE user_id = $1`, [volunteer_id]);

    const io = getIO();
    const volunteerNotification = await createNotification({
      userId: volunteer_id,
      type: 'task_assigned',
      title: 'New task assigned',
      message: `You have been assigned "${taskRes.rows[0].title}".`,
      data: { task_id, assignment_id: assignRes.rows[0].id },
    });
    if (io) {
      io.to(`volunteer:${volunteer_id}`).emit('assignment:new', {
        taskId: task_id,
        taskTitle: taskRes.rows[0].title,
        message: 'You have been assigned to a new task',
      });
      io.to(`user:${volunteer_id}`).emit('notification:new', volunteerNotification);
      io.emit('task:updated', { id: task_id, status: 'assigned' });
    }

    return res.status(201).json({ success: true, data: { assignment: assignRes.rows[0] } });
  } catch (err) {
    logger.error('Create assignment error', { error: err.message });
    return res.status(500).json({ success: false, message: 'Assignment failed' });
  }
};

// GET /api/assignments — List assignments
const getAssignments = async (req, res) => {
  const { volunteer_id, task_id, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const params = [];
  const conditions = [];
  let idx = 1;

  // Volunteers can only see their own assignments
  if (req.user.role === 'volunteer') {
    conditions.push(`a.volunteer_id = $${idx++}`);
    params.push(req.user.id);
    conditions.push(`a.status <> $${idx++}`);
    params.push('rejected');
  } else {
    if (volunteer_id) { conditions.push(`a.volunteer_id = $${idx++}`); params.push(volunteer_id); }
    if (task_id) { conditions.push(`a.task_id = $${idx++}`); params.push(task_id); }
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const result = await query(
      `SELECT 
          a.*,
          t.title AS task_title, t.category, t.urgency, t.status AS task_status,
          t.address AS task_address,
          t.lat AS task_lat,
          t.lng AS task_lng,
          (t.metadata->>'leader_id') AS task_leader_id,
          u.full_name AS volunteer_name
       FROM assignments a
       JOIN tasks t ON t.id = a.task_id
       JOIN users u ON u.id = a.volunteer_id
       ${whereClause}
       ORDER BY a.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, parseInt(limit), offset]
    );

    return res.json({ success: true, data: { assignments: result.rows } });
  } catch (err) {
    logger.error('Get assignments error', { error: err.message });
    return res.status(500).json({ success: false, message: 'Failed to fetch assignments' });
  }
};

// PUT /api/assignments/:id/accept
const acceptAssignment = async (req, res) => {
  try {
    const result = await query(
      `UPDATE assignments SET accepted_at = NOW(), status = 'accepted'
       WHERE id = $1 AND volunteer_id = $2 AND status = 'pending'
       RETURNING *`,
      [req.params.id, req.user.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }

    await query(
      `UPDATE tasks SET status = 'in_progress' WHERE id = $1`,
      [result.rows[0].task_id]
    );

    const io = getIO();
    if (io) io.emit('task:updated', { id: result.rows[0].task_id, status: 'in_progress' });

    return res.json({ success: true, data: { assignment: result.rows[0] } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to accept assignment' });
  }
};

// PUT /api/assignments/:id/reject
const rejectAssignment = async (req, res) => {
  const { reason } = req.body;
  if (!reason || String(reason).trim().length < 5) {
    return res.status(400).json({ success: false, message: 'Rejection reason is required' });
  }

  try {
    const result = await query(
      `UPDATE assignments
       SET status = 'rejected', reason = $3, updated_at = NOW()
       WHERE id = $1 AND volunteer_id = $2 AND status IN ('pending', 'accepted')
       RETURNING *`,
      [req.params.id, req.user.id, String(reason).trim()]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }

    const valid = isValidRejection(reason);
    if (!valid) {
      await query(
        `UPDATE volunteer_profiles SET grace_points = GREATEST(0, grace_points - 10), availability = 'available'
         WHERE user_id = $1`,
        [req.user.id]
      );
    } else {
      await query(`UPDATE volunteer_profiles SET availability = 'available' WHERE user_id = $1`, [req.user.id]);
    }

    const io = getIO();
    const taskOwnerRes = await query(`SELECT created_by, title FROM tasks WHERE id = $1`, [result.rows[0].task_id]);
    const ownerId = taskOwnerRes.rows[0]?.created_by;
    const ownerNotif = ownerId
      ? await createNotification({
          userId: ownerId,
          type: 'assignment_rejected',
          title: 'Volunteer rejected assignment',
          message: `${req.user.full_name} rejected "${taskOwnerRes.rows[0]?.title || 'task'}".`,
          data: { assignment_id: result.rows[0].id, task_id: result.rows[0].task_id, reason: String(reason).trim() },
        })
      : null;
    if (io) {
      io.emit('assignment:updated', { id: result.rows[0].id, status: 'rejected' });
      io.emit('task:updated', { id: result.rows[0].task_id, status: 'pending' });
      if (ownerNotif && ownerId) io.to(`user:${ownerId}`).emit('notification:new', ownerNotif);
    }

    return res.json({
      success: true,
      data: { assignment: result.rows[0], valid_rejection: valid, grace_penalty: valid ? 0 : 10 },
    });
  } catch (err) {
    logger.error('Reject assignment error', { error: err.message });
    return res.status(500).json({ success: false, message: 'Failed to reject assignment' });
  }
};

// PUT /api/assignments/:id/complete
const completeAssignment = async (req, res) => {
  const { volunteer_notes } = req.body;
  try {
    const result = await query(
      `UPDATE assignments SET completed_at = NOW(), volunteer_notes = $2, status = 'completed'
       WHERE id = $1 AND volunteer_id = $3 AND status IN ('accepted','pending')
       RETURNING *`,
      [req.params.id, volunteer_notes || null, req.user.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }

    const asgmt = result.rows[0];

    // Update task to completed
    await query(`UPDATE tasks SET status = 'completed', completed_at = NOW() WHERE id = $1`, [asgmt.task_id]);

    // Free volunteer
    await query(
      `UPDATE volunteer_profiles SET availability = 'available', total_tasks_done = total_tasks_done + 1 WHERE user_id = $1`,
      [asgmt.volunteer_id]
    );

    const io = getIO();
    const ownerRes = await query(`SELECT created_by, title FROM tasks WHERE id = $1`, [asgmt.task_id]);
    const ownerId = ownerRes.rows[0]?.created_by;
    const completionNotif = ownerId
      ? await createNotification({
          userId: ownerId,
          type: 'assignment_completed',
          title: 'Task completed',
          message: `${req.user.full_name} marked "${ownerRes.rows[0]?.title || 'task'}" as completed.`,
          data: { assignment_id: asgmt.id, task_id: asgmt.task_id },
        })
      : null;
    if (io) {
      io.emit('task:updated', { id: asgmt.task_id, status: 'completed' });
      if (completionNotif && ownerId) io.to(`user:${ownerId}`).emit('notification:new', completionNotif);
    }

    return res.json({ success: true, data: { assignment: asgmt } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to complete assignment' });
  }
};

module.exports = { createAssignment, getAssignments, acceptAssignment, rejectAssignment, completeAssignment };
