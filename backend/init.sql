-- Arena AI Prediction Competition Platform
-- Database Schema

-- Users
CREATE TABLE IF NOT EXISTS arena_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(64) UNIQUE NOT NULL,
    email VARCHAR(255),
    password_hash VARCHAR(255),
    points_balance INT DEFAULT 1000,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Market Categories
CREATE TABLE IF NOT EXISTS market_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(64) NOT NULL,
    icon VARCHAR(32),
    color VARCHAR(16)
);

-- Markets (Prediction Events)
CREATE TABLE IF NOT EXISTS markets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question TEXT NOT NULL,
    category_id INT REFERENCES market_categories(id),
    description TEXT,
    end_time TIMESTAMPTZ NOT NULL,
    resolved_outcome VARCHAR(64),
    status VARCHAR(16) DEFAULT 'ACTIVE',
    created_by UUID REFERENCES arena_users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Predictions
CREATE TABLE IF NOT EXISTS predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_id UUID REFERENCES markets(id),
    user_id UUID REFERENCES arena_users(id),
    selected_outcome VARCHAR(64) NOT NULL,
    stake_amount INT NOT NULL,
    result VARCHAR(16),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    settled_at TIMESTAMPTZ
);

-- Points History
CREATE TABLE IF NOT EXISTS points_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES arena_users(id),
    amount INT NOT NULL,
    type VARCHAR(32) NOT NULL,
    description TEXT,
    reference_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI Predictions (for AI agent predictions)
CREATE TABLE IF NOT EXISTS ai_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_id UUID REFERENCES markets(id),
    ai_model VARCHAR(64) NOT NULL,
    predicted_outcome VARCHAR(64) NOT NULL,
    confidence INT,
    reasoning TEXT[],
    cost_usd DECIMAL(8,4),
    won BOOLEAN,
    settled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Platform Revenue
CREATE TABLE IF NOT EXISTS platform_revenue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_id UUID REFERENCES markets(id),
    amount INT NOT NULL,
    fee_rate DECIMAL(4,3),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_markets_status ON markets(status);
CREATE INDEX idx_markets_end_time ON markets(end_time);
CREATE INDEX idx_predictions_market ON predictions(market_id);
CREATE INDEX idx_predictions_user ON predictions(user_id);
CREATE INDEX idx_ai_predictions_market ON ai_predictions(market_id);
CREATE INDEX idx_points_history_user ON points_history(user_id);

-- Insert default categories
INSERT INTO market_categories (name, icon, color) VALUES
    ('Crypto', '₿', '#F7931A'),
    ('Sports', '⚽', '#00FF00'),
    ('Politics', '🏛️', '#4169E1'),
    ('Tech', '💻', '#00CED1'),
    ('Economy', '📊', '#FFD700')
ON CONFLICT DO NOTHING;

-- Sample market
INSERT INTO markets (question, category_id, end_time, status, created_by)
SELECT 
    'BTC will hit $100,000 before end of 2026?',
    1,
    '2026-12-31 23:59:59+00',
    'ACTIVE',
    (SELECT id FROM arena_users LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM markets WHERE question LIKE '%BTC will hit $100,000%');

-- Sample user
INSERT INTO arena_users (username, points_balance)
VALUES ('arena_demo', 5000)
ON CONFLICT DO NOTHING;