-- ============================================================
-- Smart Resource Allocation System for NGOs
-- PostgreSQL + PostGIS Schema
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm; -- for fuzzy text search

-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE user_role AS ENUM ('admin', 'volunteer');
CREATE TYPE task_status AS ENUM ('pending', 'assigned', 'in_progress', 'completed', 'cancelled');
CREATE TYPE task_category AS ENUM ('food', 'health', 'shelter', 'education', 'water', 'sanitation', 'mental_health', 'disaster_relief', 'other');
CREATE TYPE urgency_level AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE availability_status AS ENUM ('available', 'busy', 'offline');
CREATE TYPE assignment_status AS ENUM ('pending', 'accepted', 'rejected', 'completed', 'cancelled');

-- ============================================================
-- USERS TABLE
-- ============================================================
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    full_name       VARCHAR(255) NOT NULL,
    role            user_role NOT NULL DEFAULT 'volunteer',
    phone           VARCHAR(20),
    avatar_url      TEXT,
    is_verified     BOOLEAN DEFAULT FALSE,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- ============================================================
-- VOLUNTEER PROFILES TABLE
-- ============================================================
CREATE TABLE volunteer_profiles (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bio                 TEXT,
    skills              TEXT[] DEFAULT '{}',         -- e.g., ['medical', 'driving', 'cooking']
    languages           TEXT[] DEFAULT '{}',
    availability        availability_status DEFAULT 'available',
    weekly_hours        INTEGER DEFAULT 0,           -- hours available per week
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,      -- PostGIS point
    address             TEXT,
    city                VARCHAR(100),
    country             VARCHAR(100),
    radius_km           FLOAT DEFAULT 10,            -- service radius in km
    grace_points        INTEGER DEFAULT 100,
    experience_years    INTEGER DEFAULT 0,
    total_tasks_done    INTEGER DEFAULT 0,
    rating              FLOAT DEFAULT 0.0,
    gemini_profile_vec  TEXT,                        -- AI-generated volunteer summary
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

--CREATE INDEX idx_volunteer_location ON volunteer_profiles USING GIST(location);
CREATE INDEX idx_volunteer_skills ON volunteer_profiles USING GIN(skills);
CREATE INDEX idx_volunteer_availability ON volunteer_profiles(availability);

-- ============================================================
-- NGO PROFILES TABLE (admins as NGO org accounts)
-- ============================================================
CREATE TABLE ngo_profiles (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    org_name        VARCHAR(255),
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    address         TEXT,
    city            VARCHAR(100),
    country         VARCHAR(100),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE INDEX idx_ngo_city ON ngo_profiles(city);

-- ============================================================
-- REPORTS TABLE (raw community submissions)
-- ============================================================
CREATE TABLE reports (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submitted_by    UUID REFERENCES users(id) ON DELETE SET NULL,
    title           VARCHAR(500) NOT NULL,
    description     TEXT NOT NULL,
    category        task_category NOT NULL,
    urgency         urgency_level NOT NULL DEFAULT 'medium',
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    address         TEXT,
    city            VARCHAR(100),
    image_urls      TEXT[] DEFAULT '{}',
    is_verified     BOOLEAN DEFAULT FALSE,
    is_converted    BOOLEAN DEFAULT FALSE,           -- converted to task?
    ai_summary      TEXT,                            -- Gemini-generated summary
    ai_urgency_raw  TEXT,                            -- Gemini raw urgency analysis
    ai_category_raw TEXT,                            -- Gemini auto-classified category
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

--CREATE INDEX idx_reports_location ON reports USING GIST(location);
CREATE INDEX idx_reports_category ON reports(category);
CREATE INDEX idx_reports_urgency ON reports(urgency);
CREATE INDEX idx_reports_created ON reports(created_at DESC);
CREATE INDEX idx_reports_converted ON reports(is_converted);

-- ============================================================
-- TASKS TABLE
-- ============================================================
CREATE TABLE tasks (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id           UUID REFERENCES reports(id) ON DELETE SET NULL,
    created_by          UUID REFERENCES users(id) ON DELETE SET NULL,
    title               VARCHAR(500) NOT NULL,
    description         TEXT NOT NULL,
    category            task_category NOT NULL,
    urgency             urgency_level NOT NULL,
    status              task_status DEFAULT 'pending',
    required_skills     TEXT[] DEFAULT '{}',
    required_volunteers INTEGER DEFAULT 1,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    address             TEXT,
    city                VARCHAR(100),
    deadline            TIMESTAMPTZ,
    estimated_hours     FLOAT,
    ai_summary          TEXT,                        -- Gemini task summary
    ai_match_reason     TEXT,                        -- Gemini match explanation
    ai_priority_score   FLOAT DEFAULT 0,             -- Gemini priority score (0-100)
    ai_insights         TEXT,                        -- Gemini area insights
    metadata            JSONB DEFAULT '{}',
    completed_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

--CREATE INDEX idx_tasks_location ON tasks USING GIST(location);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_urgency ON tasks(urgency);
CREATE INDEX idx_tasks_category ON tasks(category);
CREATE INDEX idx_tasks_priority ON tasks(ai_priority_score DESC);
CREATE INDEX idx_tasks_created ON tasks(created_at DESC);
CREATE INDEX idx_tasks_required_skills ON tasks USING GIN(required_skills);

-- ============================================================
-- ASSIGNMENTS TABLE
-- ============================================================
CREATE TABLE assignments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id         UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    volunteer_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_by     UUID REFERENCES users(id) ON DELETE SET NULL,
    status          assignment_status DEFAULT 'pending',
    reason          TEXT,
    match_score     FLOAT DEFAULT 0,                 -- computed match score
    distance_km     FLOAT,                           -- distance to task
    skill_score     FLOAT,                           -- skill overlap score
    urgency_score   FLOAT,                           -- urgency weight
    ai_match_reason TEXT,                            -- Gemini explanation
    is_ai_matched   BOOLEAN DEFAULT FALSE,
    accepted_at     TIMESTAMPTZ,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    volunteer_notes TEXT,
    rating          INTEGER CHECK (rating BETWEEN 1 AND 5),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(task_id, volunteer_id)
);

CREATE INDEX idx_assignments_task ON assignments(task_id);
CREATE INDEX idx_assignments_volunteer ON assignments(volunteer_id);
CREATE INDEX idx_assignments_score ON assignments(match_score DESC);

-- ============================================================
-- NOTIFICATIONS TABLE
-- ============================================================
CREATE TABLE notifications (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type        VARCHAR(50) NOT NULL,               -- task_assigned, task_updated, etc.
    title       VARCHAR(255) NOT NULL,
    message     TEXT NOT NULL,
    data        JSONB DEFAULT '{}',
    is_read     BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read, created_at DESC);

-- ============================================================
-- AI INSIGHTS TABLE (Gemini-generated area analysis)
-- ============================================================
CREATE TABLE ai_insights (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    area_name       VARCHAR(255),
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    radius_km       FLOAT DEFAULT 5,
    insight_type    VARCHAR(100),                   -- trend, recommendation, alert
    content         TEXT NOT NULL,
    raw_gemini_resp TEXT,
    valid_until     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

--CREATE INDEX idx_insights_location ON ai_insights USING GIST(location);
CREATE INDEX idx_insights_created ON ai_insights(created_at DESC);

-- ============================================================
-- REFRESH TOKENS TABLE
-- ============================================================
CREATE TABLE refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token       TEXT NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_volunteer_updated BEFORE UPDATE ON volunteer_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_ngo_updated BEFORE UPDATE ON ngo_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_reports_updated BEFORE UPDATE ON reports FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_assignments_updated BEFORE UPDATE ON assignments FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Function: find volunteers near a task within radius
CREATE OR REPLACE FUNCTION find_nearby_volunteers(
    task_lat FLOAT,
    task_lng FLOAT,
    radius_km FLOAT DEFAULT 25,
    required_skills TEXT[] DEFAULT '{}'
)
RETURNS TABLE (
    user_id UUID,
    full_name VARCHAR,
    skills TEXT[],
    distance_km FLOAT,
    availability availability_status,
    rating FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        u.id,
        u.full_name,
        vp.skills,
        ST_Distance(
            vp.location::geography,
            ST_MakePoint(task_lng, task_lat)::geography
        ) / 1000 AS distance_km,
        vp.availability,
        vp.rating
    FROM volunteer_profiles vp
    JOIN users u ON u.id = vp.user_id
    WHERE
        vp.availability = 'available'
        AND u.is_active = TRUE
        AND ST_DWithin(
            vp.location::geography,
            ST_MakePoint(task_lng, task_lat)::geography,
            radius_km * 1000
        )
    ORDER BY distance_km ASC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- SEED DATA
-- ============================================================
INSERT INTO users (id, email, password_hash, full_name, role, is_verified) VALUES
(
    '00000000-0000-0000-0000-000000000001',
    'admin@ngo.org',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj2NJkDtO4jS', -- password: admin123
    'NGO Admin',
    'admin',
    TRUE
);
