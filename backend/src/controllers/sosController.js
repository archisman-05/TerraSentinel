const { query } = require('../config/database');
const logger = require('../utils/logger');
const { getIO } = require('../websocket/socketManager');
const { sendSms } = require('../services/twilioService');
const { v4: uuidv4 } = require('uuid');

function haversineSql(latParamIdx, lngParamIdx) {
  // Returns SQL snippet that computes km distance using params ($1/$2 etc.)
  // Uses columns lat/lng.
  return `(6371 * acos(
    cos(radians($${latParamIdx})) * cos(radians(lat)) * cos(radians(lng) - radians($${lngParamIdx})) +
    sin(radians($${latParamIdx})) * sin(radians(lat))
  ))`;
}

function parseNumber(n) {
  const v = typeof n === 'string' ? Number(n) : n;
  return Number.isFinite(v) ? v : null;
}

function normalizePhone(phone) {
  const value = String(phone || '').trim();
  if (!value) return null;
  if (value.startsWith('+')) return value;
  const digits = value.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length > 10) return `+${digits}`;
  return null;
}

async function postSos(req, res, next) {
  try {
    const lat = parseNumber(req.body.lat);
    const lng = parseNumber(req.body.lng);
    const user_id = typeof req.body.user_id === 'string' ? req.body.user_id : null;
    const radius_km = parseNumber(req.body.radius_km) ?? 25;
    const emergency_details =
      typeof req.body.emergency_details === 'string' ? req.body.emergency_details.trim() : '';
    const address = typeof req.body.address === 'string' ? req.body.address.trim() : '';

    if (lat == null || lng == null || !user_id) {
      return res.status(400).json({ success: false, message: 'Invalid payload: lat, lng, user_id are required.' });
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ success: false, message: 'Invalid coordinates.' });
    }

    const distanceExprNgo = haversineSql(1, 2);
    const distanceExprVol = haversineSql(1, 2);

    const [ngosResult, volsResult] = await Promise.allSettled([
      query(
        `
        SELECT np.user_id, np.org_name, np.lat, np.lng, u.phone, ${distanceExprNgo} AS distance_km
        FROM ngo_profiles np
        JOIN users u ON u.id = np.user_id
        WHERE np.lat IS NOT NULL AND np.lng IS NOT NULL
        ORDER BY distance_km ASC
        LIMIT 25
        `,
        [lat, lng]
      ),
      query(
        `
        SELECT vp.user_id, u.full_name, u.phone, vp.availability, vp.lat, vp.lng, ${distanceExprVol} AS distance_km
        FROM volunteer_profiles vp
        JOIN users u ON u.id = vp.user_id
        WHERE vp.lat IS NOT NULL AND vp.lng IS NOT NULL
          AND u.is_active = TRUE
        ORDER BY distance_km ASC
        LIMIT 50
        `,
        [lat, lng]
      ),
    ]);

    if (ngosResult.status === 'rejected') {
      logger.warn('SOS NGO lookup failed; proceeding with volunteer-only alert', {
        error: ngosResult.reason?.message || String(ngosResult.reason),
      });
    }
    if (volsResult.status === 'rejected') {
      logger.warn('SOS volunteer lookup failed; proceeding with NGO-only alert', {
        error: volsResult.reason?.message || String(volsResult.reason),
      });
    }

    const ngosRows = ngosResult.status === 'fulfilled' ? ngosResult.value.rows : [];
    const volsRows = volsResult.status === 'fulfilled' ? volsResult.value.rows : [];

    const nearby_ngos = ngosRows
      .filter((r) => Number(r.distance_km) <= radius_km)
      .map((r) => ({
        user_id: r.user_id,
        org_name: r.org_name,
        phone: r.phone || null,
        distance_km: Number(r.distance_km),
        lat: r.lat,
        lng: r.lng,
      }));

    const nearby_volunteers = volsRows
      .filter((r) => Number(r.distance_km) <= radius_km)
      .map((r) => ({
        user_id: r.user_id,
        full_name: r.full_name,
        phone: r.phone || null,
        distance_km: Number(r.distance_km),
        lat: r.lat,
        lng: r.lng,
      }));

    const payload = {
      id: uuidv4(),
      lat,
      lng,
      user_id,
      radius_km,
      emergency_details,
      created_at: new Date().toISOString(),
      nearby_ngos: nearby_ngos.map(({ user_id, org_name, distance_km, phone }) => ({ user_id, org_name, distance_km, phone })),
      nearby_volunteers: nearby_volunteers.map(({ user_id, full_name, distance_km, phone }) => ({ user_id, full_name, distance_km, phone })),
    };

    const io = getIO();
    if (io) {
      // Global event for clients listening app-wide.
      io.emit('sos:alert', payload);

      // Always notify NGO admins
      io.to('admin').emit('sos:alert', payload);

      // Notify nearby volunteers (personal rooms)
      for (const v of nearby_volunteers) {
        io.to(`user:${v.user_id}`).emit('sos:alert', payload);
        io.to(`volunteer:${v.user_id}`).emit('sos:alert', payload);
      }

      // Map room highlight
      io.to('map').emit('sos:alert', payload);
    }

    // Optional SMS escalation (configured recipients)
    const smsToRaw = process.env.SOS_SMS_TO || '';
    const smsTo = smsToRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const autoPhones = [
      ...nearby_ngos.map((ngo) => normalizePhone(ngo.phone)).filter(Boolean),
      ...nearby_volunteers.map((volunteer) => normalizePhone(volunteer.phone)).filter(Boolean),
    ];
    const recipients = [...new Set([...smsTo.map((p) => normalizePhone(p)).filter(Boolean), ...autoPhones])];

    if (recipients.length > 0) {
      const mapsLink = `https://www.google.com/maps?q=${lat},${lng}`;
      const body = `SOS ALERT\nUser: ${user_id}\nAddress: ${address || 'Not provided'}\nLocation: ${lat.toFixed(6)}, ${lng.toFixed(6)}\nDetails: ${emergency_details || 'N/A'}\nMap: ${mapsLink}`;
      const results = [];
      for (const to of recipients) {
        try {
          const msg = await sendSms({ to, body });
          results.push({ to, sid: msg.sid });
        } catch (err) {
          logger.error('Twilio SMS failed', { to, error: err.message });
          results.push({ to, error: err.message });
        }
      }
      payload.sms = results;
    }

    return res.json({ success: true, data: payload });
  } catch (err) {
    return next(err);
  }
}

async function postSosSms(req, res, next) {
  try {
    const lat = parseNumber(req.body.lat);
    const lng = parseNumber(req.body.lng);
    const user_id = typeof req.body.user_id === 'string' ? req.body.user_id : null;
    const phones = Array.isArray(req.body.phones)
      ? req.body.phones.filter((p) => typeof p === 'string' && p.trim().length > 0)
      : [];

    if (lat == null || lng == null || !user_id) {
      return res.status(400).json({ success: false, message: 'Invalid payload: lat, lng, user_id are required.' });
    }

    const smsToRaw = process.env.SOS_SMS_TO || '';
    const envPhones = smsToRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const recipients = [...new Set([...phones, ...envPhones])];

    if (recipients.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No SMS recipients configured. Add SOS_SMS_TO or send phones[] in payload.',
      });
    }

    const mapsLink = `https://www.google.com/maps?q=${lat},${lng}`;
    const body = `OFFLINE SOS ALERT\nUser: ${user_id}\nLocation: ${lat.toFixed(6)}, ${lng.toFixed(6)}\nMap: ${mapsLink}`;
    const results = [];

    for (const to of recipients) {
      try {
        const msg = await sendSms({ to, body });
        results.push({ to, sid: msg.sid, status: msg.status || 'queued', mocked: !!msg.mocked });
      } catch (err) {
        logger.error('SOS SMS fallback failed', { to, error: err.message });
        results.push({ to, error: err.message });
      }
    }

    return res.json({
      success: true,
      data: {
        sent: results,
        location: { lat, lng },
        user_id,
        created_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    return next(err);
  }
}

async function postSosAck(req, res, next) {
  try {
    const { sos_id, user_id, responder_id, responder_name, message } = req.body || {};
    if (!sos_id || !user_id || !responder_id) {
      return res.status(400).json({ success: false, message: 'sos_id, user_id and responder_id are required.' });
    }

    const payload = {
      sos_id: String(sos_id),
      user_id: String(user_id),
      responder_id: String(responder_id),
      responder_name: String(responder_name || 'Responder'),
      message: String(message || 'A responder acknowledged your SOS.'),
      created_at: new Date().toISOString(),
    };

    const io = getIO();
    if (io) {
      io.to(`user:${payload.user_id}`).emit('sos:ack', payload);
      io.to('admin').emit('sos:ack', payload);
    }

    return res.json({ success: true, data: payload });
  } catch (err) {
    return next(err);
  }
}

module.exports = { postSos, postSosSms, postSosAck };

