#!/usr/bin/env node
/**
 * Run this BEFORE starting the server to verify DB is ready.
 * Usage:  node src/utils/dbSetup.js
 */
const path = require('path');
const fs = require('fs');
const schemaPath = path.join(__dirname, '../../../database/schema.sql');
require('dotenv').config();
const { Pool } = require('pg');
const schema = fs.readFileSync(schemaPath, 'utf-8');

async function setup() {
  console.log('🔍 Checking environment variables…');

  const required = ['DB_USER', 'DB_PASSWORD', 'DB_NAME', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];
  const missing  = required.filter(k => !process.env[k]);
  if (missing.length) {
    console.error('❌ Missing required env vars:', missing.join(', '));
    console.error('   Copy backend/.env.example → backend/.env and fill in all values.');
    process.exit(1);
  }
  console.log('✅ Environment variables present');

  console.log('🔍 Testing database connection…');
  const pool = new Pool({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl:      process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 5000,
  });

  try {
    const client = await pool.connect();
    console.log('✅ Database connected');

    // Check PostGIS
    try {
      await client.query('SELECT PostGIS_Version()');
      console.log('✅ PostGIS extension available');
    } catch {
      console.warn('⚠️  PostGIS not installed. Run: CREATE EXTENSION postgis;');
    }

    // Check schema
    const tableCheck = await client.query(
      "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='users'"
    );
    if (parseInt(tableCheck.rows[0].count) === 0) {
      console.warn('⚠️  Schema not applied. Applying now…');
      const fs   = require('fs');
      const path = require('path');
      const sql  = fs.readFileSync(path.join(__dirname, '../../../database/schema.sql'), 'utf8');
      await client.query(sql);
      console.log('✅ Schema applied successfully');
    } else {
      console.log('✅ Schema already applied');
    }

    client.release();
    await pool.end();
    console.log('\n🚀 All checks passed. You can now run: npm run dev\n');
  } catch (err) {
    console.error('❌ Database error:', err.message);
    console.error('\n   Common fixes:');
    console.error('   • Make sure PostgreSQL is running');
    console.error('   • Check DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME in .env');
    console.error('   • Create the database: psql -U postgres -c "CREATE DATABASE ngo_resource_db;"');
    console.error('   • Install PostGIS: https://postgis.net/install/\n');
    process.exit(1);
  }
}

setup();
