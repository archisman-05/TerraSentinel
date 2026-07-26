const { query } = require('../config/database');
const logger = require('../utils/logger');

// GET /api/ngos/map
const getNgosForMap = async (req, res) => {
  try {
    const result = await query(
      `SELECT
          u.id,
          COALESCE(np.org_name, u.full_name) AS name,
          np.lat,
          np.lng,
          np.city,
          np.address
       FROM ngo_profiles np
       JOIN users u ON u.id = np.user_id
       WHERE u.is_active = TRUE AND u.role = 'admin'
         AND np.lat IS NOT NULL AND np.lng IS NOT NULL
       LIMIT 500`
    );
    return res.json({ success: true, data: { ngos: result.rows } });
  } catch (err) {
    logger.error('Get NGOs map error', { error: err.message });
    return res.status(500).json({ success: false, message: 'Failed to fetch NGO map data' });
  }
};

module.exports = { getNgosForMap };

