const { query } = require('../config/database');
const geminiService = require('./geminiService');
const logger = require('../utils/logger');

const haversineKmSql = (latCol, lngCol, latParamRef, lngParamRef) => `
  (6371 * 2 * ASIN(SQRT(
    POWER(SIN(RADIANS((${latParamRef} - ${latCol}) / 2)), 2) +
    COS(RADIANS(${latCol})) * COS(RADIANS(${latParamRef})) *
    POWER(SIN(RADIANS((${lngParamRef} - ${lngCol}) / 2)), 2)
  )))`;

// ─── Compute production match score (weights) ─────────────────────────────────
// distance 40% + skills 30% + grace_points 20% + experience 10%
const computeMatchScore = ({ distanceKm, skills, taskSkills, gracePoints, experienceYears }) => {
  const distanceCapKm = 50;

  // 0..40
  const distScore = Math.max(0, 1 - (Number(distanceKm || 0) / distanceCapKm)) * 40;

  // 0..30 (ratio of required skills matched)
  const taskSkillSet = new Set((taskSkills || []).map(s => String(s).toLowerCase()));
  const volSkillSet = new Set((skills || []).map(s => String(s).toLowerCase()));
  let skillScore = 30;
  if (taskSkillSet.size > 0) {
    const intersection = [...taskSkillSet].filter(s => volSkillSet.has(s)).length;
    skillScore = (intersection / taskSkillSet.size) * 30;
  }

  // 0..20 (cap at 200)
  const gp = Math.max(0, Math.min(200, Number(gracePoints ?? 100)));
  const graceScore = (gp / 200) * 20;

  // 0..10 (cap at 10 years)
  const exp = Math.max(0, Math.min(10, Number(experienceYears ?? 0)));
  const expScore = (exp / 10) * 10;

  return Math.min(100, distScore + skillScore + graceScore + expScore);
};

// ─── Main matching function ────────────────────────────────────────────────────
const findBestVolunteers = async (taskId, options = {}) => {
  const { useAI = true, limit = 10, radiusKm = 50 } = options;

  // 1. Load task
  const taskRes = await query(
    `SELECT t.*, 
            t.lat AS lat,
            t.lng AS lng,
            t.address
     FROM tasks t WHERE t.id = $1`,
    [taskId]
  );

  if (!taskRes.rows.length) throw new Error('Task not found');
  const task = taskRes.rows[0];

  // 2. Find nearby available volunteers
  const volRes = await query(
    `SELECT 
        vp.user_id,
        u.full_name,
        vp.skills,
        vp.availability,
        vp.weekly_hours,
        vp.grace_points,
        vp.experience_years,
        ${haversineKmSql('vp.lat', 'vp.lng', '$1', '$2')} AS distance_km
     FROM volunteer_profiles vp
     JOIN users u ON u.id = vp.user_id
     WHERE 
        vp.availability = 'available'
        AND u.is_active = TRUE
        AND vp.lat IS NOT NULL
        AND vp.lng IS NOT NULL
        AND ${haversineKmSql('vp.lat', 'vp.lng', '$1', '$2')} <= $3
        AND vp.user_id NOT IN (
            SELECT volunteer_id FROM assignments 
            WHERE task_id = $4
        )
     ORDER BY distance_km ASC
     LIMIT 30`,
    [task.lat, task.lng, radiusKm, taskId]
  );

  if (!volRes.rows.length) {
    return {
      task,
      volunteers: [],
      aiMatching: null,
      message: 'No available volunteers found within radius',
    };
  }

  // 3. Compute algorithmic scores
  const scored = volRes.rows.map(v => ({
    ...v,
    algo_score: computeMatchScore({
      distanceKm: v.distance_km,
      skills: v.skills,
      taskSkills: task.required_skills,
      gracePoints: v.grace_points,
      experienceYears: v.experience_years,
    }),
  })).sort((a, b) => b.algo_score - a.algo_score).slice(0, limit);

  // 4. Optionally enhance with Gemini AI
  let aiMatching = null;
  if (useAI && process.env.GEMINI_API_KEY) {
    try {
      aiMatching = await geminiService.matchVolunteers(task, scored);

      // Merge AI scores with algorithmic scores
      const aiMap = {};
      (aiMatching.matches || []).forEach(m => { aiMap[m.volunteer_id] = m; });

      scored.forEach(v => {
        const aiData = aiMap[v.user_id];
        if (aiData) {
          v.ai_score = aiData.match_score;
          v.ai_reasoning = aiData.reasoning;
          v.recommended = aiData.recommended;
          // Blend scores: 40% algo + 60% AI
          v.final_score = 0.4 * v.algo_score + 0.6 * aiData.match_score;
        } else {
          v.final_score = v.algo_score;
        }
      });

      scored.sort((a, b) => (b.final_score || 0) - (a.final_score || 0));
    } catch (err) {
      logger.warn('AI matching failed, using algorithmic scores', { error: err.message });
      scored.forEach(v => { v.final_score = v.algo_score; });
    }
  } else {
    scored.forEach(v => { v.final_score = v.algo_score; });
  }

  return {
    task,
    volunteers: scored,
    aiMatching,
  };
};

// ─── Auto-assign best volunteer ────────────────────────────────────────────────
const autoAssignVolunteer = async (taskId, assignedBy) => {
  const { task, volunteers, aiMatching } = await findBestVolunteers(taskId, { useAI: true, limit: 5 });

  if (!volunteers.length) {
    throw new Error('No suitable volunteers available for auto-assignment');
  }

  const best = volunteers[0];

  // Create assignment
  const assignRes = await query(
    `INSERT INTO assignments 
        (task_id, volunteer_id, assigned_by, match_score, distance_km, 
         skill_score, urgency_score, ai_match_reason, is_ai_matched)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      taskId,
      best.user_id,
      assignedBy,
      best.final_score || best.algo_score,
      best.distance_km,
      best.ai_score || best.algo_score,
      0,
      best.ai_reasoning || aiMatching?.matching_insight || 'Matched algorithmically',
      !!aiMatching,
    ]
  );

  // Update task status
  await query(
    `UPDATE tasks SET status = 'assigned', ai_match_reason = $2 WHERE id = $1`,
    [taskId, aiMatching?.matching_insight || null]
  );

  // Update volunteer availability
  await query(
    `UPDATE volunteer_profiles SET availability = 'busy' WHERE user_id = $1`,
    [best.user_id]
  );

  logger.info('Volunteer auto-assigned', {
    taskId,
    volunteerId: best.user_id,
    score: best.final_score,
    aiUsed: !!aiMatching,
  });

  return {
    assignment: assignRes.rows[0],
    volunteer: best,
    aiMatching,
  };
};

module.exports = { findBestVolunteers, autoAssignVolunteer, computeMatchScore };
