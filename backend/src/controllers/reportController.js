const { query, withTransaction } = require('../config/database');
const geminiService = require('../services/geminiService');
const { getIO } = require('../websocket/socketManager');
const logger = require('../utils/logger');

const haversineKmSql = (latCol, lngCol, latParamRef, lngParamRef) => `
  (6371 * 2 * ASIN(SQRT(
    POWER(SIN(RADIANS((${latParamRef} - ${latCol}) / 2)), 2) +
    COS(RADIANS(${latCol})) * COS(RADIANS(${latParamRef})) *
    POWER(SIN(RADIANS((${lngParamRef} - ${lngCol}) / 2)), 2)
  )))`;

// POST /api/reports
const createReport = async (req, res) => {
  const {
    title, description, category, urgency,
    latitude, longitude, address,
  } = req.body;

  const imageUrls = req.files ? req.files.map(f => f.location || f.path) : [];

  try {
    // 1. AI analysis (non-blocking fallback)
    let aiData = {};
    try {
      aiData = await geminiService.analyzeReport({ title, description, category, location_address: address });
    } catch (e) {
      logger.warn('Gemini analysis failed for report', { error: e.message });
    }

    // 2. Create report
    const result = await query(
      `INSERT INTO reports
         (submitted_by, title, description, category, urgency, lat, lng, address,
          image_urls, ai_summary, ai_urgency_raw, ai_category_raw)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        req.user?.id || null,
        title,
        description,
        aiData.classified_category || category,
        aiData.urgency || urgency,
        parseFloat(latitude),
        parseFloat(longitude),
        address || null,
        imageUrls,
        aiData.summary || null,
        aiData.urgency_reason ? JSON.stringify(aiData) : null,
        aiData.classified_category || null,
      ]
    );

    const report = result.rows[0];

    // 3. Emit real-time event
    const io = getIO();
    if (io) {
      io.emit('report:new', {
        id: report.id,
        title: report.title,
        category: report.category,
        urgency: report.urgency,
        location: { lat: parseFloat(latitude), lng: parseFloat(longitude) },
        ai_summary: aiData.summary,
        created_at: report.created_at,
      });
    }

    logger.info('Report created', { reportId: report.id, urgency: report.urgency });

    return res.status(201).json({
      success: true,
      message: 'Report submitted successfully',
      data: {
        report,
        ai_analysis: aiData,
      },
    });
  } catch (err) {
    logger.error('Create report error', { error: err.message });
    return res.status(500).json({ success: false, message: 'Failed to submit report' });
  }
};

// GET /api/reports
const getReports = async (req, res) => {
  const {
    page = 1, limit = 20,
    category, urgency, is_converted,
    lat, lng, radius_km = 50,
  } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const params = [];
  const conditions = [];
  let paramIdx = 1;

  if (category) { conditions.push(`category = $${paramIdx++}`); params.push(category); }
  if (urgency) { conditions.push(`urgency = $${paramIdx++}`); params.push(urgency); }
  if (is_converted !== undefined) { conditions.push(`is_converted = $${paramIdx++}`); params.push(is_converted === 'true'); }

  if (lat && lng) {
    const latRef = `$${paramIdx++}`;
    const lngRef = `$${paramIdx++}`;
    const radiusRef = `$${paramIdx++}`;
    conditions.push(`reports.lat IS NOT NULL AND reports.lng IS NOT NULL AND ${haversineKmSql('reports.lat', 'reports.lng', latRef, lngRef)} <= ${radiusRef}`);
    params.push(parseFloat(lat), parseFloat(lng), parseFloat(radius_km));
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const countRes = await query(`SELECT COUNT(*) FROM reports ${whereClause}`, params);
    const total = parseInt(countRes.rows[0].count);

    const dataRes = await query(
      `SELECT r.*,
              u.full_name AS submitter_name,
              r.lat AS lat,
              r.lng AS lng
       FROM reports r
       LEFT JOIN users u ON u.id = r.submitted_by
       ${whereClause}
       ORDER BY r.created_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      [...params, parseInt(limit), offset]
    );

    return res.json({
      success: true,
      data: {
        reports: dataRes.rows,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (err) {
    logger.error('Get reports error', { error: err.message });
    return res.status(500).json({ success: false, message: 'Failed to fetch reports' });
  }
};

// POST /api/reports/:id/convert — Admin only
const convertToTask = async (req, res) => {
  const { id } = req.params;
  const { required_skills, required_volunteers, estimated_hours, deadline } = req.body;

  try {
    const result = await withTransaction(async (client) => {
      const reportRes = await client.query(
        `SELECT * FROM reports WHERE id = $1`,
        [id]
      );

      if (!reportRes.rows.length) throw new Error('Report not found');
      const report = reportRes.rows[0];
      if (report.is_converted) throw new Error('Report already converted to task');

      const taskRes = await client.query(
        `INSERT INTO tasks
           (report_id, created_by, title, description, category, urgency,
            lat, lng, address, required_skills, required_volunteers,
            estimated_hours, deadline, ai_summary, ai_priority_score)
         VALUES ($1, $2, $3, $4, $5, $6,
                $7, $8, $9, $10, $11, $12, $13, $14, $15)
         RETURNING *`,
        [
          report.id,
          req.user.id,
          report.title,
          report.description,
          report.category,
          report.urgency,
          report.lat,
          report.lng,
          report.address,
          required_skills || [],
          required_volunteers || 1,
          estimated_hours || null,
          deadline || null,
          report.ai_summary,
          report.urgency === 'critical' ? 90 : report.urgency === 'high' ? 70 : 50,
        ]
      );

      await client.query('UPDATE reports SET is_converted = TRUE WHERE id = $1', [id]);

      return taskRes.rows[0];
    });

    const io = getIO();
    if (io) {
      io.emit('task:new', {
        id: result.id,
        title: result.title,
        category: result.category,
        urgency: result.urgency,
        status: result.status,
      });
    }

    return res.status(201).json({ success: true, data: { task: result } });
  } catch (err) {
    logger.error('Convert report error', { error: err.message });
    if (err.message === 'Report not found') return res.status(404).json({ success: false, message: err.message });
    if (err.message === 'Report already converted to task') return res.status(409).json({ success: false, message: err.message });
    return res.status(500).json({ success: false, message: 'Conversion failed' });
  }
};

// GET /api/reports/central/insights — Admin AI forecasting
const getCentralInsights = async (req, res) => {
  try {
    const { city = '' } = req.query;
    const cityFilter = String(city || '').trim();
    const locationExpr = `COALESCE(NULLIF(TRIM(city), ''), NULLIF(TRIM(address), ''), 'Unknown')`;

    const reportFilterClause = cityFilter ? `WHERE LOWER(${locationExpr}) LIKE LOWER($1)` : '';
    const reportFilterParams = cityFilter ? [`%${cityFilter}%`] : [];

    const [summaryRes, cityRes, categoryRes, openTasksRes, reportsRes] = await Promise.all([
      query(
        `SELECT
            COUNT(*) AS total_reports,
            COUNT(*) FILTER (WHERE is_converted = FALSE) AS pending_reports,
            COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') AS reports_last_30d
         FROM reports
         ${reportFilterClause}`,
        reportFilterParams
      ),
      query(
        `SELECT ${locationExpr} AS city, COUNT(*) AS count
         FROM reports
         ${reportFilterClause}
         GROUP BY 1
         ORDER BY count DESC
         LIMIT 8`,
        reportFilterParams
      ),
      query(
        `SELECT category, urgency, COUNT(*) AS count
         FROM reports
         ${reportFilterClause}
         GROUP BY category, urgency
         ORDER BY count DESC
         LIMIT 20`,
        reportFilterParams
      ),
      query(
        `SELECT title, category, urgency, ${locationExpr} AS city, created_at, lat, lng
         FROM tasks
         WHERE status NOT IN ('completed', 'cancelled')
         ${cityFilter ? `AND LOWER(${locationExpr}) LIKE LOWER($1)` : ''}
         ORDER BY created_at DESC
         LIMIT 25`,
        reportFilterParams
      ),
      query(
        `SELECT id, title, category, urgency, ${locationExpr} AS city, address, lat, lng, created_at
         FROM reports
         ${reportFilterClause}
         ORDER BY created_at DESC
         LIMIT 20`,
        reportFilterParams
      ),
    ]);

    const summary = summaryRes.rows[0];
    const aiPayload = {
      total_reports: Number(summary.total_reports || 0),
      pending_reports: Number(summary.pending_reports || 0),
      reports_last_30d: Number(summary.reports_last_30d || 0),
      top_cities: cityRes.rows,
      category_urgency_distribution: categoryRes.rows,
      open_tasks: openTasksRes.rows,
      location_filter: cityFilter || null,
      recent_reports: reportsRes.rows.map((r) => ({
        ...r,
        lat: r.lat !== null ? Number(r.lat) : null,
        lng: r.lng !== null ? Number(r.lng) : null,
      })),
    };

    const aiInsights = await geminiService.generateCentralInsights(aiPayload);

    return res.json({
      success: true,
      data: {
        summary: aiPayload,
        ai_insights: aiInsights,
        generated_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    logger.error('Central report insights error', { error: err.message });
    return res.status(500).json({ success: false, message: 'Failed to generate central insights' });
  }
};

module.exports = { createReport, getReports, convertToTask, getCentralInsights };
