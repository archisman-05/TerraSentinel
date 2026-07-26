const { query } = require('../config/database');
const logger = require('../utils/logger');

const haversineKmSql = (latCol, lngCol, latParamRef, lngParamRef) => `
  (6371 * 2 * ASIN(SQRT(
    POWER(SIN(RADIANS((${latParamRef} - ${latCol}) / 2)), 2) +
    COS(RADIANS(${latCol})) * COS(RADIANS(${latParamRef})) *
    POWER(SIN(RADIANS((${lngParamRef} - ${lngCol}) / 2)), 2)
  )))`;

// GET /api/match/nearby?lat=..&lng=..&radius_km=..&limit=..
const getNearby = async (req, res) => {
  const { lat, lng, radius_km = 50, limit = 50 } = req.query;
  if (lat == null || lng == null) {
    return res.status(400).json({ success: false, message: 'lat and lng are required' });
  }

  const latN = parseFloat(lat);
  const lngN = parseFloat(lng);
  const radiusN = parseFloat(radius_km);
  const limitN = Math.min(200, Math.max(1, parseInt(limit)));

  try {
    const [volRes, ngoRes] = await Promise.all([
      query(
        `SELECT
            u.id,
            u.full_name,
            vp.availability,
            vp.skills,
            vp.grace_points,
            vp.experience_years,
            vp.lat,
            vp.lng,
            ${haversineKmSql('vp.lat', 'vp.lng', '$1', '$2')} AS distance_km
         FROM volunteer_profiles vp
         JOIN users u ON u.id = vp.user_id
         WHERE u.is_active = TRUE AND u.role = 'volunteer'
           AND vp.lat IS NOT NULL AND vp.lng IS NOT NULL
           AND ${haversineKmSql('vp.lat', 'vp.lng', '$1', '$2')} <= $3
         ORDER BY distance_km ASC
         LIMIT $4`,
        [latN, lngN, radiusN, limitN]
      ),
      query(
        `SELECT
            u.id,
            COALESCE(np.org_name, u.full_name) AS name,
            np.lat,
            np.lng,
            ${haversineKmSql('np.lat', 'np.lng', '$1', '$2')} AS distance_km
         FROM ngo_profiles np
         JOIN users u ON u.id = np.user_id
         WHERE u.is_active = TRUE AND u.role = 'admin'
           AND np.lat IS NOT NULL AND np.lng IS NOT NULL
           AND ${haversineKmSql('np.lat', 'np.lng', '$1', '$2')} <= $3
         ORDER BY distance_km ASC
         LIMIT $4`,
        [latN, lngN, radiusN, limitN]
      ),
    ]);

    return res.json({
      success: true,
      data: {
        volunteers: volRes.rows,
        ngos: ngoRes.rows,
      },
    });
  } catch (err) {
    logger.error('Nearby match error', { error: err.message });
    return res.status(500).json({ success: false, message: 'Failed to fetch nearby matches' });
  }
};

module.exports = { getNearby };

