const { query } = require('../config/database');
const logger = require('../utils/logger');

const haversineKmSql = (latCol, lngCol, latParamRef, lngParamRef) => `
  (6371 * 2 * ASIN(SQRT(
    POWER(SIN(RADIANS((${latParamRef} - ${latCol}) / 2)), 2) +
    COS(RADIANS(${latCol})) * COS(RADIANS(${latParamRef})) *
    POWER(SIN(RADIANS((${lngParamRef} - ${lngCol}) / 2)), 2)
  )))`;

// GET /api/volunteers
const getVolunteers = async (req, res) => {
  const { lat, lng, radius_km = 50, skills, availability, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const params = [];
  const conditions = ['u.is_active = TRUE', 'u.role = \'volunteer\''];
  let idx = 1;

  if (availability) { conditions.push(`vp.availability = $${idx++}`); params.push(availability); }

  if (skills) {
    const skillArr = skills.split(',').map(s => s.trim().toLowerCase());
    conditions.push(`vp.skills && $${idx++}::text[]`);
    params.push(skillArr);
  }

  if (lat && lng) {
    const latRef = `$${idx++}`;
    const lngRef = `$${idx++}`;
    const radiusRef = `$${idx++}`;
    conditions.push(`vp.lat IS NOT NULL AND vp.lng IS NOT NULL AND ${haversineKmSql('vp.lat', 'vp.lng', latRef, lngRef)} <= ${radiusRef}`);
    params.push(parseFloat(lat), parseFloat(lng), parseFloat(radius_km));
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  try {
    const distanceExpr = lat && lng
      ? haversineKmSql('vp.lat', 'vp.lng', `${parseFloat(lat)}`, `${parseFloat(lng)}`)
      : 'NULL';

    const result = await query(
      `SELECT 
          u.id, u.full_name, u.email, u.avatar_url,
          vp.skills, vp.languages, vp.availability,
          vp.city, vp.rating, vp.total_tasks_done, vp.bio,
          vp.weekly_hours, vp.radius_km,
          vp.lat AS lat,
          vp.lng AS lng,
          ${distanceExpr} AS distance_km
       FROM users u
       JOIN volunteer_profiles vp ON vp.user_id = u.id
       ${whereClause}
       ORDER BY ${lat && lng ? 'distance_km ASC,' : ''} vp.rating DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, parseInt(limit), offset]
    );

    return res.json({ success: true, data: { volunteers: result.rows } });
  } catch (err) {
    logger.error('Get volunteers error', { error: err.message });
    return res.status(500).json({ success: false, message: 'Failed to fetch volunteers' });
  }
};

// GET /api/volunteers/map — Minimal data for map markers
const getVolunteersForMap = async (req, res) => {
  try {
    const result = await query(
      `SELECT 
          u.id, u.full_name, vp.availability, vp.skills,
          vp.lat AS lat,
          vp.lng AS lng
       FROM users u
       JOIN volunteer_profiles vp ON vp.user_id = u.id
       WHERE u.is_active = TRUE AND vp.lat IS NOT NULL AND vp.lng IS NOT NULL
       LIMIT 500`
    );
    return res.json({ success: true, data: { volunteers: result.rows } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch volunteer map data' });
  }
};

// PUT /api/volunteers/profile — Update own profile
const updateProfile = async (req, res) => {
  const {
    bio, skills, languages, availability,
    weekly_hours, address, city, country,
    radius_km, latitude, longitude,
    phone,
  } = req.body;

  try {
    if (typeof phone === 'string') {
      await query(
        `UPDATE users SET phone = $2, updated_at = NOW() WHERE id = $1`,
        [req.user.id, phone.trim() || null]
      );
    }

    const result = await query(
      `UPDATE volunteer_profiles SET
          bio = COALESCE($2, bio),
          skills = COALESCE($3, skills),
          languages = COALESCE($4, languages),
          availability = COALESCE($5, availability),
          weekly_hours = COALESCE($6, weekly_hours),
          address = COALESCE($7, address),
          city = COALESCE($8, city),
          country = COALESCE($9, country),
          radius_km = COALESCE($10, radius_km),
          lat = COALESCE($11, lat),
          lng = COALESCE($12, lng),
          updated_at = NOW()
       WHERE user_id = $1
       RETURNING *`,
      [
        req.user.id, bio, skills, languages, availability,
        weekly_hours, address, city, country, radius_km,
        latitude != null ? parseFloat(latitude) : null,
        longitude != null ? parseFloat(longitude) : null,
      ]
    );

    return res.json({ success: true, data: { profile: result.rows[0] } });
  } catch (err) {
    logger.error('Update profile error', { error: err.message });
    return res.status(500).json({ success: false, message: 'Profile update failed' });
  }
};

// GET /api/volunteers/:id
const getVolunteerById = async (req, res) => {
  try {
    const result = await query(
      `SELECT 
          u.id, u.full_name, u.email, u.phone, u.avatar_url, u.created_at,
          vp.*,
          vp.lat AS lat,
          vp.lng AS lng
       FROM users u
       JOIN volunteer_profiles vp ON vp.user_id = u.id
       WHERE u.id = $1`,
      [req.params.id]
    );

    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Volunteer not found' });

    // Get recent assignments
    const assignRes = await query(
      `SELECT a.*, t.title AS task_title, t.category, t.status AS task_status
       FROM assignments a JOIN tasks t ON t.id = a.task_id
       WHERE a.volunteer_id = $1
       ORDER BY a.created_at DESC LIMIT 5`,
      [req.params.id]
    );

    return res.json({
      success: true,
      data: { volunteer: result.rows[0], recent_assignments: assignRes.rows },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch volunteer' });
  }
};

module.exports = { getVolunteers, getVolunteersForMap, updateProfile, getVolunteerById };
