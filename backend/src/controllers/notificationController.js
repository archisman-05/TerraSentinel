const { query, withTransaction } = require('../config/database');
const { getIO } = require('../websocket/socketManager');
const logger = require('../utils/logger');

const listNotifications = async (req, res) => {
  try {
    const rows = await query(
      `SELECT *
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [req.user.id]
    );
    return res.json({ success: true, data: { notifications: rows.rows } });
  } catch (err) {
    logger.error('List notifications error', { error: err.message });
    return res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
  }
};

const markRead = async (req, res) => {
  try {
    const result = await query(
      `UPDATE notifications
       SET is_read = TRUE
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [req.params.id, req.user.id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    return res.json({ success: true, data: { notification: result.rows[0] } });
  } catch (err) {
    logger.error('Mark notification read error', { error: err.message });
    return res.status(500).json({ success: false, message: 'Failed to update notification' });
  }
};

const respondJoinRequest = async (req, res) => {
  const { action, message } = req.body;
  if (!['accept', 'reject'].includes(action)) {
    return res.status(400).json({ success: false, message: 'Invalid action' });
  }

  try {
    const output = await withTransaction(async (client) => {
      const notifRes = await client.query(
        `SELECT * FROM notifications WHERE id = $1 AND user_id = $2 FOR UPDATE`,
        [req.params.id, req.user.id]
      );
      if (!notifRes.rows.length) {
        throw Object.assign(new Error('Notification not found'), { status: 404 });
      }

      const notif = notifRes.rows[0];
      const data = notif.data || {};
      if (notif.type !== 'task_join_request') {
        throw Object.assign(new Error('Notification is not a join request'), { status: 400 });
      }
      if (data.response_action) {
        throw Object.assign(new Error('This join request is already handled'), { status: 409 });
      }

      const updatedData = {
        ...data,
        response_action: action,
        responded_at: new Date().toISOString(),
        responded_by: req.user.id,
      };
      await client.query(
        `UPDATE notifications SET is_read = TRUE, data = $2 WHERE id = $1`,
        [notif.id, updatedData]
      );

      let assignment = null;
      if (action === 'accept') {
        const assignRes = await client.query(
          `INSERT INTO assignments (task_id, volunteer_id, assigned_by, status, ai_match_reason)
           VALUES ($1, $2, $3, 'pending', $4)
           ON CONFLICT (task_id, volunteer_id) DO NOTHING
           RETURNING *`,
          [
            data.task_id,
            data.volunteer_id,
            req.user.id,
            'Volunteer requested to join this task from map',
          ]
        );
        assignment = assignRes.rows[0] || null;
        if (assignment) {
          await client.query(
            `UPDATE tasks SET status = 'assigned' WHERE id = $1 AND status = 'pending'`,
            [data.task_id]
          );
          await client.query(
            `UPDATE volunteer_profiles SET availability = 'busy' WHERE user_id = $1`,
            [data.volunteer_id]
          );
        }
      }

      const title = action === 'accept' ? 'Join request accepted' : 'Join request rejected';
      const msg = message || (action === 'accept'
        ? `Your request to join "${data.task_title || 'task'}" was accepted.`
        : `Your request to join "${data.task_title || 'task'}" was rejected.`);

      const volunteerNotif = await client.query(
        `INSERT INTO notifications (user_id, type, title, message, data)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          data.volunteer_id,
          'task_join_response',
          title,
          msg,
          { task_id: data.task_id, action, assignment_id: assignment?.id || null },
        ]
      );

      return { assignment, volunteerNotification: volunteerNotif.rows[0], taskId: data.task_id, volunteerId: data.volunteer_id };
    });

    const io = getIO();
    if (io) {
      io.to(`user:${output.volunteerId}`).emit('notification:new', output.volunteerNotification);
      io.to(`volunteer:${output.volunteerId}`).emit('notification:new', output.volunteerNotification);
      if (output.assignment) {
        io.to(`volunteer:${output.volunteerId}`).emit('assignment:new', {
          assignment_id: output.assignment.id,
          task_id: output.assignment.task_id,
          status: output.assignment.status,
          taskTitle: 'Task assigned from join request',
        });
      }
      io.emit('task:updated', { id: output.taskId, status: output.assignment ? 'assigned' : 'pending' });
    }

    return res.json({ success: true, data: output });
  } catch (err) {
    logger.error('Respond join request error', { error: err.message });
    return res.status(err.status || 500).json({ success: false, message: err.message || 'Failed to respond' });
  }
};

module.exports = { listNotifications, markRead, respondJoinRequest };
