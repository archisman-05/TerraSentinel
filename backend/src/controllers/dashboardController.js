const { query } = require('../config/database');
const geminiService = require('../services/geminiService');
const logger = require('../utils/logger');

// ─────────────────────────────────────────────
// GET /api/dashboard/stats
// ─────────────────────────────────────────────
const getStats = async (req, res) => {
  try {
    const [
      tasksRes,
      volunteersRes,
      reportsRes,
      categoryRes,
      urgencyRes,
    ] = await Promise.all([
      // ✅ SAFE (no joins → no ambiguity)
      query(`
        SELECT 
          COUNT(*) FILTER (WHERE status = 'pending') AS pending,
          COUNT(*) FILTER (WHERE status = 'assigned') AS assigned,
          COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress,
          COUNT(*) FILTER (WHERE status = 'completed') AS completed,
          COUNT(*) FILTER (
            WHERE status = 'completed' 
            AND completed_at > NOW() - INTERVAL '7 days'
          ) AS completed_this_week,
          COUNT(*) AS total
        FROM tasks
      `),

      // ✅ FIXED (explicit table prefixes)
      query(`
        SELECT 
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE vp.availability = 'available') AS available,
          COUNT(*) FILTER (WHERE vp.availability = 'busy') AS busy,
          COUNT(*) FILTER (
            WHERE vp.created_at > NOW() - INTERVAL '7 days'
          ) AS new_this_week
        FROM volunteer_profiles vp
        JOIN users u ON u.id = vp.user_id
        WHERE u.is_active = TRUE
      `),

      // ✅ FIXED (explicit column)
      query(`
        SELECT 
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE is_converted = FALSE) AS pending_review,
          COUNT(*) FILTER (
            WHERE reports.created_at > NOW() - INTERVAL '7 days'
          ) AS this_week
        FROM reports
      `),

      query(`
        SELECT category, COUNT(*) AS count
        FROM tasks 
        WHERE status != 'cancelled'
        GROUP BY category 
        ORDER BY count DESC
      `),

      query(`
        SELECT urgency, COUNT(*) AS count
        FROM tasks 
        WHERE status NOT IN ('completed', 'cancelled')
        GROUP BY urgency 
        ORDER BY 
          CASE urgency 
            WHEN 'critical' THEN 1 
            WHEN 'high' THEN 2 
            WHEN 'medium' THEN 3 
            ELSE 4 
          END
      `),
    ]);

    return res.json({
      success: true,
      data: {
        tasks: tasksRes.rows[0],
        volunteers: volunteersRes.rows[0],
        reports: reportsRes.rows[0],
        by_category: categoryRes.rows,
        by_urgency: urgencyRes.rows,
        generated_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    logger.error('Dashboard stats error', { error: err.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch stats',
    });
  }
};

// ─────────────────────────────────────────────
// GET /api/dashboard/weekly-summary
// ─────────────────────────────────────────────
let cachedSummary = null;
let lastGenerated = 0;

const CACHE_TIME = 5 * 60 * 1000; // 5 min

const getWeeklySummary = async (req, res) => {
  try {
    const now = Date.now();

    if (cachedSummary && now - lastGenerated < CACHE_TIME) {
      return res.json({
        success: true,
        data: cachedSummary,
        cached: true,
      });
    }

    const [stats, categories, topAreas] = await Promise.all([
      query(`
        SELECT
          COUNT(*) FILTER (
            WHERE created_at > NOW() - INTERVAL '7 days'
          ) AS total_tasks,

          COUNT(*) FILTER (
            WHERE status='completed'
            AND completed_at > NOW() - INTERVAL '7 days'
          ) AS completed_tasks

        FROM tasks
      `),

      query(`
        SELECT category, COUNT(*) AS count
        FROM tasks
        WHERE created_at > NOW() - INTERVAL '7 days'
        GROUP BY category
      `),

      query(`
        SELECT city, COUNT(*) AS count
        FROM tasks
        WHERE city IS NOT NULL
          AND created_at > NOW() - INTERVAL '7 days'
        GROUP BY city
        ORDER BY count DESC
        LIMIT 3
      `),
    ]);

    const volunteerStats = await query(`
      SELECT COUNT(*) FILTER (
        WHERE created_at > NOW() - INTERVAL '7 days'
      ) AS new_volunteers
      FROM volunteer_profiles
    `);

    const statsData = {
      total_tasks: Number(stats.rows[0].total_tasks || 0),
      completed_tasks: Number(stats.rows[0].completed_tasks || 0),
      new_volunteers: Number(
        volunteerStats.rows[0].new_volunteers || 0
      ),

      by_category: categories.rows.reduce((acc, row) => {
        acc[row.category] = Number(row.count);
        return acc;
      }, {}),

      by_urgency: {},

      top_areas: topAreas.rows.map((r) => r.city),
    };

    let summary;

    try {
      summary =
        await geminiService.generateWeeklySummary(statsData);
    } catch (err) {
      logger.error("Gemini Weekly Summary failed", {
        error: err.message,
      });

      summary = {
        title: "Weekly NGO Operations Report",
        executive_summary:
          "Unable to generate AI summary at the moment.",
        highlights: [],
        concerns: [],
        next_week_focus: [],
        impact_statement: "",
      };
    }

    cachedSummary = summary;
    lastGenerated = now;

    return res.json({
      success: true,
      data: summary,
      cached: false,
    });
  } catch (err) {
    logger.error("Weekly summary error", {
      error: err.message,
    });

    return res.status(500).json({
      success: false,
      message: "Failed to generate weekly summary",
    });
  }
};

const getVolunteerStats = async (req, res) => {
  try {
    const myId = req.user.id;
    const [assignmentsRes, alertsRes] = await Promise.all([
      query(
        `SELECT
            COUNT(*) FILTER (WHERE status IN ('pending','accepted')) AS pending_tasks,
            COUNT(*) FILTER (WHERE status = 'completed') AS completed_tasks,
            COUNT(*) AS total_assignments
         FROM assignments
         WHERE volunteer_id = $1`,
        [myId]
      ),
      query(
        `SELECT COUNT(*) AS unread_notifications
         FROM notifications
         WHERE user_id = $1 AND is_read = FALSE`,
        [myId]
      ),
    ]);

    return res.json({
      success: true,
      data: {
        pending_tasks: Number(assignmentsRes.rows[0].pending_tasks || 0),
        completed_tasks: Number(assignmentsRes.rows[0].completed_tasks || 0),
        total_assignments: Number(assignmentsRes.rows[0].total_assignments || 0),
        unread_notifications: Number(alertsRes.rows[0].unread_notifications || 0),
      },
    });
  } catch (err) {
    logger.error('Volunteer stats error', { error: err.message });
    return res.status(500).json({ success: false, message: 'Failed to fetch volunteer stats' });
  }
};

module.exports = { getStats, getWeeklySummary, getVolunteerStats };