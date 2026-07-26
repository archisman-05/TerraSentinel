const { query, withTransaction } = require('../config/database');
const { getIO } = require('../websocket/socketManager');
const { computeMatchScore } = require('./matchingService');
const logger = require('../utils/logger');

const haversineKm = (aLat, aLng, bLat, bLng) => {
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.sqrt(h));
};

const computeSkillRatio = (taskSkills, volSkills) => {
  const t = new Set((taskSkills || []).map((s) => String(s).toLowerCase()));
  if (t.size === 0) return 1;
  const v = new Set((volSkills || []).map((s) => String(s).toLowerCase()));
  const intersection = [...t].filter((s) => v.has(s)).length;
  return intersection / t.size;
};

async function autoAssignForTask(taskId, assignedBy, options = {}) {
  const { limitPerTask } = options;

  const taskRes = await query(
    `SELECT id, title, lat, lng, required_skills, required_volunteers, status
     FROM tasks WHERE id = $1`,
    [taskId]
  );
  if (!taskRes.rows.length) throw new Error('Task not found');
  const task = taskRes.rows[0];
  if (task.lat == null || task.lng == null) throw new Error('Task has no location');
  if (['completed', 'cancelled'].includes(task.status)) throw new Error('Task not assignable');

  const desired = Math.max(1, Math.min(50, Number(limitPerTask || task.required_volunteers || 1)));

  const candidatesRes = await query(
    `SELECT
        vp.user_id,
        u.full_name,
        vp.skills,
        vp.availability,
        vp.grace_points,
        vp.experience_years,
        vp.lat,
        vp.lng
     FROM volunteer_profiles vp
     JOIN users u ON u.id = vp.user_id
     WHERE u.is_active = TRUE
       AND u.role = 'volunteer'
       AND vp.availability = 'available'
       AND vp.lat IS NOT NULL AND vp.lng IS NOT NULL
       AND vp.user_id NOT IN (
         SELECT volunteer_id FROM assignments
         WHERE task_id = $1 AND status IN ('pending','accepted')
       )
     LIMIT 500`,
    [taskId]
  );

  const scored = candidatesRes.rows
    .map((v) => {
      const distanceKm = haversineKm(task.lat, task.lng, v.lat, v.lng);
      const skillRatio = computeSkillRatio(task.required_skills, v.skills);
      const score = computeMatchScore({
        distanceKm,
        skills: v.skills,
        taskSkills: task.required_skills,
        gracePoints: v.grace_points,
        experienceYears: v.experience_years,
      });
      return {
        ...v,
        distance_km: distanceKm,
        skill_ratio: skillRatio,
        final_score: score,
      };
    })
    .sort((a, b) => b.final_score - a.final_score)
    .slice(0, desired);

  if (!scored.length) {
    return { task, assignments: [], volunteers: [] };
  }

  const created = await withTransaction(async (client) => {
    const assignments = [];
    for (const v of scored) {
      const insertRes = await client.query(
        `INSERT INTO assignments
           (task_id, volunteer_id, assigned_by, status, match_score, distance_km, skill_score)
         VALUES ($1, $2, $3, 'pending', $4, $5, $6)
         ON CONFLICT (task_id, volunteer_id) DO NOTHING
         RETURNING *`,
        [
          taskId,
          v.user_id,
          assignedBy || null,
          v.final_score,
          v.distance_km,
          v.skill_ratio * 30,
        ]
      );
      if (insertRes.rows.length) {
        assignments.push(insertRes.rows[0]);
        // reserve the volunteer
        await client.query(
          `UPDATE volunteer_profiles SET availability = 'busy' WHERE user_id = $1`,
          [v.user_id]
        );
      }
    }

    if (assignments.length) {
      await client.query(
        `UPDATE tasks SET status = 'assigned' WHERE id = $1 AND status = 'pending'`,
        [taskId]
      );
    }

    return assignments;
  });

  const io = getIO();
  if (io) {
    created.forEach((a) => {
      io.to(`volunteer:${a.volunteer_id}`).emit('assignment:new', {
        assignment_id: a.id,
        task_id: a.task_id,
        status: a.status,
        taskTitle: task.title,
      });
    });
    io.emit('task:updated', { id: taskId, status: 'assigned' });
  }

  logger.info('Auto-assignment complete', { taskId, assigned: created.length });

  return { task, assignments: created, volunteers: scored };
}

module.exports = { autoAssignForTask };

