const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { WebSocketServer } = require('ws');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const axios = require('axios');

const app = express();
const port = 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'arena-secret-key-change-in-production';

// Database connection
const pool = new Pool({
  user: process.env.PGUSER || 'quantsaas',
  password: process.env.PGPASSWORD || 'quantsaas',
  host: '172.18.0.3',
  port: 5432,
  database: 'quantsaas'
});

// Middleware
app.use(cors());
app.use(express.json());

// WebSocket
const wss = new WebSocketServer({ port: 3002 });
const clients = new Set();

wss.on('connection', ws => {
  clients.add(ws);
  ws.on('close', () => clients.delete(ws));
});

function broadcast(data) {
  const msg = JSON.stringify(data);
  clients.forEach(client => client.send(msg));
}

// ─── Market Settlement Logic ───────────────────────────────────────────────────

// Simulate outcome resolution (random for demo)
function resolveOutcome() {
  return Math.random() > 0.5 ? 'YES' : 'NO';
}

// Settle a single market
async function settleMarket(marketId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get market and lock it
    const marketResult = await client.query(
      "SELECT * FROM markets WHERE id = $1 AND status = 'ACTIVE' FOR UPDATE",
      [marketId]
    );

    if (marketResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return { success: false, error: 'Market not found or already settled' };
    }

    const market = marketResult.rows[0];

    // Resolve outcome
    const resolvedOutcome = resolveOutcome();
    await client.query(
      "UPDATE markets SET status = 'RESOLVED', resolved_outcome = $1, updated_at = NOW() WHERE id = $2",
      [resolvedOutcome, marketId]
    );

    // Get all predictions for this market
    const predictionsResult = await client.query(
      'SELECT * FROM predictions WHERE market_id = $1',
      [marketId]
    );

    // Calculate total pool and winning pool
    const predictions = predictionsResult.rows;
    const totalPool = predictions.reduce((sum, p) => sum + parseInt(p.stake_amount), 0);

    // Separate correct and incorrect predictions
    const correctPredictions = predictions.filter(p => p.selected_outcome === resolvedOutcome);
    const incorrectPredictions = predictions.filter(p => p.selected_outcome !== resolvedOutcome);

    const correctPool = correctPredictions.reduce((sum, p) => sum + parseInt(p.stake_amount), 0);
    const platformFee = Math.floor(totalPool * 0.1);
    const winningPool = totalPool - platformFee;

    // Process correct predictions: pay out proportionally
    for (const pred of correctPredictions) {
      const payout = correctPool > 0
        ? Math.floor((parseInt(pred.stake_amount) / correctPool) * winningPool)
        : 0;

      await client.query(
        "UPDATE predictions SET result = 'WON', settled_at = NOW() WHERE id = $1",
        [pred.id]
      );

      await client.query(
        'UPDATE user_points SET balance = balance + $1, updated_at = NOW() WHERE user_id = $2',
        [payout, pred.user_id]
      );

      await client.query(
        `INSERT INTO points_history (id, user_id, amount, type, description, reference_id, created_at)
         VALUES ($1, $2, $3, 'WIN', 'Prediction win payout', $4, NOW())`,
        [uuidv4(), pred.user_id, payout, marketId]
      );
    }

    // Process incorrect predictions: mark as lost
    for (const pred of incorrectPredictions) {
      await client.query(
        "UPDATE predictions SET result = 'LOST', settled_at = NOW() WHERE id = $1",
        [pred.id]
      );

      await client.query(
        `INSERT INTO points_history (id, user_id, amount, type, description, reference_id, created_at)
         VALUES ($1, $2, 0, 'LOSS', 'Lost prediction', $3, NOW())`,
        [uuidv4(), pred.user_id, marketId]
      );
    }

    // Record platform revenue
    if (platformFee > 0) {
      await client.query(
        `INSERT INTO platform_revenue (id, market_id, amount, fee_rate, created_at)
         VALUES ($1, $2, $3, 0.1, NOW())`,
        [uuidv4(), marketId, platformFee]
      );
    }

    await client.query('COMMIT');
    return {
      success: true,
      market_id: marketId,
      resolved_outcome: resolvedOutcome,
      total_pool: totalPool,
      correct_predictions: correctPredictions.length,
      incorrect_predictions: incorrectPredictions.length,
      platform_fee: platformFee
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Cronjob: Check and settle expired markets every minute
function startSettlementCron() {
  console.log('[CRON] Market settlement checker started');

  const checkAndSettle = async () => {
    try {
      const expiredMarkets = await pool.query(
        "SELECT id FROM markets WHERE status = 'ACTIVE' AND end_time < NOW()"
      );

      if (expiredMarkets.rows.length > 0) {
        console.log(`[CRON] Found ${expiredMarkets.rows.length} expired market(s) to settle`);
      }

      for (const market of expiredMarkets.rows) {
        try {
          const result = await settleMarket(market.id);
          if (result.success) {
            console.log(`[CRON] Settled market ${market.id}: ${result.resolved_outcome}, ${result.correct_predictions} winners`);
            broadcast({ type: 'MARKET_SETTLED', market_id: market.id, ...result });
          }
        } catch (err) {
          console.error(`[CRON] Error settling market ${market.id}:`, err.message);
        }
      }
    } catch (err) {
      console.error('[CRON] Settlement check error:', err.message);
    }
  };

  checkAndSettle();
  setInterval(checkAndSettle, 60000);
}

// ─── Sample Markets Seeder ──────────────────────────────────────────────────────

async function seedSampleMarkets() {
  try {
    const existing = await pool.query("SELECT COUNT(*) FROM markets");
    if (parseInt(existing.rows[0].count) > 1) {
      return; // Already has sample data
    }

    const sampleMarkets = [
      { question: 'BTC will hit $100,000 before end of 2026?', category_id: 1, end_time: '2026-12-31 23:59:59+00' },
      { question: 'ETH will exceed $5,000 in 2026?', category_id: 1, end_time: '2026-12-31 23:59:59+00' },
      { question: 'Manchester City wins the 2025-26 Premier League?', category_id: 2, end_time: '2026-05-24 00:00:00+00' },
      { question: 'Apple releases AR glasses in 2026?', category_id: 4, end_time: '2026-12-31 23:59:59+00' },
      { question: 'S&P 500 closes above 6000 at end of 2026?', category_id: 5, end_time: '2026-12-31 23:59:59+00' },
      { question: 'Bitcoin ETF approved in EU by 2026?', category_id: 1, end_time: '2026-12-31 23:59:59+00' },
      { question: 'SpaceX lands astronauts on Mars before 2030?', category_id: 4, end_time: '2029-12-31 23:59:59+00' },
      { question: 'US Federal Reserve cuts rates 3+ times in 2026?', category_id: 5, end_time: '2026-12-31 23:59:59+00' },
      { question: 'Trump wins 2026 US Presidential election?', category_id: 3, end_time: '2026-11-03 00:00:00+00' },
      { question: 'NVIDIA releases next-gen GPU in 2026?', category_id: 4, end_time: '2026-12-31 23:59:59+00' }
    ];

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const m of sampleMarkets) {
        await client.query(`
          INSERT INTO markets (id, question, category_id, end_time, status, created_at)
          SELECT $1, $2, $3, $4, 'ACTIVE', NOW()
          WHERE NOT EXISTS (SELECT 1 FROM markets WHERE question = $2)
        `, [uuidv4(), m.question, m.category_id, m.end_time]);
      }
      await client.query('COMMIT');
      console.log('[SEED] Sample markets inserted');
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[SEED] Sample markets error:', err.message);
  }
}

// ─── Auth Helpers ──────────────────────────────────────────────────────────────

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function generateToken(userId, username) {
  return jwt.sign({ userId, username }, JWT_SECRET, { expiresIn: '7d' });
}

// Auth middleware
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }
  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ─── Auth Routes ───────────────────────────────────────────────────────────────

// Register
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'username, email, and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const userId = uuidv4();
  const hashedPassword = hashPassword(password);
  const initialPoints = 1000;

  try {
    const existing = await pool.query(
      'SELECT id FROM arena_users WHERE username = $1 OR email = $2',
      [username, email]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(`
        INSERT INTO arena_users (id, username, email, password_hash, created_at)
        VALUES ($1, $2, $3, $4, NOW())
      `, [userId, username, email, hashedPassword]);

      await client.query(`
        INSERT INTO user_points (user_id, balance, updated_at)
        VALUES ($1, $2, NOW())
      `, [userId, initialPoints]);

      await client.query(`
        INSERT INTO points_history (id, user_id, amount, type, description, created_at)
        VALUES ($1, $2, $3, 'BONUS', 'Welcome bonus on registration', NOW())
      `, [uuidv4(), userId, initialPoints]);

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const token = generateToken(userId, username);
    res.status(201).json({
      user_id: userId,
      username,
      email,
      token,
      message: 'Registration successful. 1000 points credited as welcome bonus.'
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }

  try {
    const result = await pool.query(
      'SELECT id, username, email, password_hash FROM arena_users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = result.rows[0];
    const hashedPassword = hashPassword(password);

    if (hashedPassword !== user.password_hash) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = generateToken(user.id, user.username);
    res.json({
      user_id: user.id,
      username: user.username,
      email: user.email,
      token
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Markets Routes ─────────────────────────────────────────────────────────────

// Get all active markets
app.get('/api/markets', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT m.*,
        (SELECT SUM(stake_amount) FROM predictions WHERE market_id = m.id) as total_stake,
        (SELECT COUNT(*) FROM predictions WHERE market_id = m.id) as prediction_count,
        c.name as category_name, c.icon as category_icon, c.color as category_color
      FROM markets m
      LEFT JOIN market_categories c ON m.category_id = c.id
      WHERE m.status = 'ACTIVE'
      ORDER BY m.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create market (requires staking 50 points)
app.post('/api/markets', authenticate, async (req, res) => {
  const { question, end_time, category_id } = req.body;
  const stakingCost = 50;
  const userId = req.user.userId;

  if (!question || !end_time) {
    return res.status(400).json({ error: 'question and end_time are required' });
  }

  try {
    const balanceResult = await pool.query(
      'SELECT balance FROM user_points WHERE user_id = $1',
      [userId]
    );
    const balance = balanceResult.rows[0]?.balance || 0;

    if (balance < stakingCost) {
      return res.status(400).json({ error: `Insufficient points. Need ${stakingCost} points to create a market.` });
    }

    const marketId = uuidv4();
    const historyId = uuidv4();
    const catId = category_id ? parseInt(category_id) : 1;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(`
        UPDATE user_points
        SET balance = balance - $1, updated_at = NOW()
        WHERE user_id = $2
      `, [stakingCost, userId]);

      await client.query(`
        INSERT INTO points_history (id, user_id, amount, type, description, created_at)
        VALUES ($1, $2, $3, 'STAKING', 'Market creation staking fee', NOW())
      `, [historyId, userId, -stakingCost]);

      await client.query(`
        INSERT INTO markets (id, question, category_id, end_time, status, created_by, created_at)
        VALUES ($1, $2, $3, $4, 'ACTIVE', $5, NOW())
      `, [marketId, question, catId, end_time, userId]);

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    res.status(201).json({
      id: marketId,
      success: true,
      staking_cost: stakingCost,
      message: `Market created. ${stakingCost} points deducted.`
    });
  } catch (err) {
    console.error('Create market error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin API Routes ──────────────────────────────────────────────────────────

// Manual settle a specific market
app.post('/api/admin/settle/:market_id', async (req, res) => {
  const { market_id } = req.params;

  try {
    const result = await settleMarket(market_id);
    if (result.success) {
      broadcast({ type: 'MARKET_SETTLED', market_id, ...result });
      res.json({ success: true, message: 'Market settled', ...result });
    } else {
      res.status(404).json({ success: false, error: result.error });
    }
  } catch (err) {
    console.error('Manual settle error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get all markets (including resolved)
app.get('/api/admin/markets', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT m.*,
        (SELECT SUM(stake_amount) FROM predictions WHERE market_id = m.id) as total_stake,
        (SELECT COUNT(*) FROM predictions WHERE market_id = m.id) as prediction_count,
        (SELECT COUNT(*) FROM predictions WHERE market_id = m.id AND result = 'WON') as correct_count,
        (SELECT COUNT(*) FROM predictions WHERE market_id = m.id AND result = 'LOST') as wrong_count,
        c.name as category_name, c.icon as category_icon, c.color as category_color
      FROM markets m
      LEFT JOIN market_categories c ON m.category_id = c.id
      ORDER BY m.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Predictions Routes ─────────────────────────────────────────────────────────

// Place prediction (requires authentication and sufficient points)
app.post('/api/predictions', authenticate, async (req, res) => {
  const { market_id, selected_outcome, stake_amount } = req.body;
  const userId = req.user.userId;

  if (!market_id || !selected_outcome || !stake_amount) {
    return res.status(400).json({ error: 'market_id, selected_outcome, and stake_amount are required' });
  }
  if (stake_amount <= 0) {
    return res.status(400).json({ error: 'stake_amount must be a positive number' });
  }

  try {
    const marketResult = await pool.query(
      "SELECT id FROM markets WHERE id = $1 AND status = 'ACTIVE'",
      [market_id]
    );
    if (marketResult.rows.length === 0) {
      return res.status(404).json({ error: 'Market not found or not active' });
    }

    const balanceResult = await pool.query(
      'SELECT balance FROM user_points WHERE user_id = $1',
      [userId]
    );
    const balance = balanceResult.rows[0]?.balance || 0;

    if (balance < stake_amount) {
      return res.status(400).json({ error: `Insufficient points. Your balance: ${balance}, stake: ${stake_amount}` });
    }

    const predictionId = uuidv4();
    const historyId = uuidv4();

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(`
        UPDATE user_points
        SET balance = balance - $1, updated_at = NOW()
        WHERE user_id = $2
      `, [stake_amount, userId]);

      await client.query(`
        INSERT INTO points_history (id, user_id, amount, type, description, created_at)
        VALUES ($1, $2, $3, 'BET', 'Place prediction', NOW())
      `, [historyId, userId, -stake_amount]);

      await client.query(`
        INSERT INTO predictions (id, market_id, user_id, selected_outcome, stake_amount, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
      `, [predictionId, market_id, userId, selected_outcome, stake_amount]);

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    broadcast({ type: 'NEW_PREDICTION', market_id });
    res.status(201).json({
      id: predictionId,
      success: true,
      stake_amount,
      message: `Prediction placed. ${stake_amount} points deducted.`
    });
  } catch (err) {
    console.error('Place prediction error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── User Routes ───────────────────────────────────────────────────────────────

// Get all markets with full stats (for stats page)
app.get('/api/markets/all-stats', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        m.*,
        COALESCE(SUM(p.stake_amount), 0) as total_stake,
        COUNT(p.id) as prediction_count,
        COALESCE(SUM(CASE WHEN p.selected_outcome = 'UP' THEN p.stake_amount ELSE 0 END), 0) as up_stake,
        COALESCE(SUM(CASE WHEN p.selected_outcome = 'DOWN' THEN p.stake_amount ELSE 0 END), 0) as down_stake,
        COUNT(CASE WHEN p.selected_outcome = 'UP' THEN 1 END) as up_count,
        COUNT(CASE WHEN p.selected_outcome = 'DOWN' THEN 1 END) as down_count
      FROM markets m
      LEFT JOIN predictions p ON p.market_id = m.id
      GROUP BY m.id
      ORDER BY m.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all settled markets
app.get('/api/markets/settled', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        m.*,
        COALESCE(SUM(p.stake_amount), 0) as total_stake,
        COUNT(p.id) as prediction_count,
        COALESCE(SUM(CASE WHEN p.selected_outcome = 'UP' THEN p.stake_amount ELSE 0 END), 0) as up_stake,
        COALESCE(SUM(CASE WHEN p.selected_outcome = 'DOWN' THEN p.stake_amount ELSE 0 END), 0) as down_stake
      FROM markets m
      LEFT JOIN predictions p ON p.market_id = m.id
      WHERE m.status IN ('SETTLED', 'RESOLVED')
      GROUP BY m.id
      ORDER BY m.end_time DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get user predictions on settled markets
app.get('/api/users/:id/predictions/settled', authenticate, async (req, res) => {
  const userId = req.params.id;

  if (req.user.userId !== userId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const result = await pool.query(`
      SELECT 
        p.selected_outcome,
        p.stake_amount,
        p.result,
        m.question as market_question,
        m.end_time as market_end_time,
        m.final_price as market_final_price,
        m.correct_outcome as market_correct_outcome
      FROM predictions p
      JOIN markets m ON m.id = p.market_id
      WHERE p.user_id = $1 AND m.status IN ('SETTLED', 'RESOLVED')
      ORDER BY m.end_time DESC
    `, [userId]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get user profile with balance and stats
app.get('/api/users/:id/profile', async (req, res) => {
  const userId = req.params.id;

  try {
    const userResult = await pool.query(
      'SELECT id, username, email, created_at FROM arena_users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const pointsResult = await pool.query(
      'SELECT balance FROM user_points WHERE user_id = $1',
      [userId]
    );
    const balance = pointsResult.rows[0]?.balance || 0;

    const statsResult = await pool.query(`
      SELECT
        COUNT(*) as total_predictions,
        SUM(stake_amount) as total_staked,
        SUM(CASE WHEN result = 'WON' THEN stake_amount * 0.9 ELSE 0 END) as total_won,
        ROUND(AVG(CASE WHEN result = 'WON' THEN 100.0 ELSE 0 END), 1) as accuracy,
        SUM(CASE WHEN result = 'WON' THEN 1 ELSE 0 END) as won_count,
        SUM(CASE WHEN result = 'LOST' THEN 1 ELSE 0 END) as lost_count
      FROM predictions
      WHERE user_id = $1
    `, [userId]);

    const stats = statsResult.rows[0];
    const totalPredictions = parseInt(stats.total_predictions) || 0;
    const wonCount = parseInt(stats.won_count) || 0;
    const lostCount = parseInt(stats.lost_count) || 0;

    res.json({
      user: userResult.rows[0],
      balance,
      stats: {
        total_predictions: totalPredictions,
        total_staked: parseInt(stats.total_staked) || 0,
        total_won: parseInt(stats.total_won) || 0,
        accuracy: parseFloat(stats.accuracy) || 0,
        won_count: wonCount,
        lost_count: lostCount,
        pending: totalPredictions - wonCount - lostCount
      }
    });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get user points
app.get('/api/users/:id/points', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT balance FROM user_points WHERE user_id = $1',
      [req.params.id]
    );
    res.json(result.rows[0] || { balance: 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get points history
app.get('/api/users/:id/points-history', authenticate, async (req, res) => {
  const userId = req.params.id;

  if (req.user.userId !== userId) {
    return res.status(403).json({ error: 'Access denied. You can only view your own history.' });
  }

  try {
    const result = await pool.query(`
      SELECT amount, type, description, created_at
      FROM points_history
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 50
    `, [userId]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Leaderboard ────────────────────────────────────────────────────────────────

app.get('/api/leaderboard', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.username,
        SUM(CASE WHEN p.result = 'WON' THEN p.stake_amount * 0.9 ELSE 0 END) as total_won,
        COUNT(p.id) as total_predictions,
        ROUND(AVG(CASE WHEN p.result = 'WON' THEN 100 ELSE 0 END), 1) as accuracy
      FROM arena_users u
      LEFT JOIN predictions p ON p.user_id = u.id
      GROUP BY u.id, u.username
      ORDER BY total_won DESC
      LIMIT 20
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── AI Prediction Service ──────────────────────────────────────────────────────

const AI_SYSTEM_PROMPT = `You are a professional prediction analyst specializing in forecasting market outcomes. Your task is to analyze market questions and provide directional predictions.

For each market, analyze:
1. The question and its context
2. Historical patterns and market dynamics
3. Stake distribution and crowd sentiment
4. External factors and trends

Output a JSON object with:
- direction: "UP" or "DOWN"
- confidence: a number between 0 and 1 (e.g., 0.75 for 75%)
- reasoning: a brief explanation (2-3 sentences)

Be objective and analytical. Base your predictions on data-driven reasoning.`;

// Call OpenAI API
async function callOpenAI(messages) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  const response = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages,
      temperature: 0.7,
      max_tokens: 500
    },
    {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    }
  );
  return response.data.choices[0].message.content;
}

// Call Claude API
async function callClaude(messages) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const response = await axios.post(
    'https://api.anthropic.com/v1/messages',
    {
      model: process.env.CLAUDE_MODEL || 'claude-3-5-haiku-20241107',
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      max_tokens: 500,
      temperature: 0.7
    },
    {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      }
    }
  );
  return response.data.content[0].text;
}

// Generate AI prediction for a market
async function generateAIPrediction(market) {
  const userMessage = `Market Question: ${market.question}\nEnd Time: ${market.end_time}\n\nProvide your prediction in JSON format.`;

  const messages = [
    { role: 'system', content: AI_SYSTEM_PROMPT },
    { role: 'user', content: userMessage }
  ];

  let rawOutput;
  if (process.env.AI_PROVIDER === 'anthropic') {
    rawOutput = await callClaude(messages);
  } else {
    rawOutput = await callOpenAI(messages);
  }

  // Parse JSON from response
  const jsonMatch = rawOutput.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Failed to parse AI response');

  return JSON.parse(jsonMatch[0]);
}

// Ensure ai_predictions table exists
async function ensureAIPredictionsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_predictions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      market_id UUID NOT NULL REFERENCES markets(id),
      direction VARCHAR(10) NOT NULL,
      confidence DECIMAL(4,3) NOT NULL,
      reasoning TEXT,
      model VARCHAR(50),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
}

// ─── AI Prediction Routes ──────────────────────────────────────────────────────

// POST /api/ai/predict - Generate AI prediction for a single market
app.post('/api/ai/predict', async (req, res) => {
  const { market_id } = req.body;

  if (!market_id) {
    return res.status(400).json({ error: 'market_id is required' });
  }

  try {
    await ensureAIPredictionsTable();

    // Get market info
    const marketResult = await pool.query(
      'SELECT id, question, end_time, status FROM markets WHERE id = $1',
      [market_id]
    );
    if (marketResult.rows.length === 0) {
      return res.status(404).json({ error: 'Market not found' });
    }
    const market = marketResult.rows[0];

    // Get current prediction stats for context
    const statsResult = await pool.query(`
      SELECT 
        COALESCE(SUM(stake_amount), 0) as total_stake,
        COUNT(*) as prediction_count,
        COUNT(DISTINCT user_id) as unique_bettors
      FROM predictions WHERE market_id = $1
    `, [market_id]);
    const stats = statsResult.rows[0];

    // Add stats to market context
    market.stats = {
      total_stake: parseInt(stats.total_stake),
      prediction_count: parseInt(stats.prediction_count),
      unique_bettors: parseInt(stats.unique_bettors)
    };

    // Generate AI prediction
    let prediction;
    try {
      prediction = await generateAIPrediction(market);
    } catch (aiErr) {
      // If AI fails, use demo prediction for testing
      console.log('AI API error, using demo prediction:', aiErr.message);
      prediction = {
        direction: Math.random() > 0.5 ? 'UP' : 'DOWN',
        confidence: 0.65 + Math.random() * 0.25,
        reasoning: 'Demo prediction - AI API not configured. This is a simulated prediction for demonstration purposes.'
      };
    }

    // Save to database
    const predictionId = uuidv4();
    const model = process.env.AI_PROVIDER === 'anthropic' 
      ? (process.env.CLAUDE_MODEL || 'claude-3-5-haiku') 
      : (process.env.OPENAI_MODEL || 'gpt-4o-mini');

    await pool.query(`
      INSERT INTO ai_predictions (id, market_id, direction, confidence, reasoning, model, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `, [predictionId, market_id, prediction.direction, prediction.confidence, prediction.reasoning, model]);

    res.status(201).json({
      id: predictionId,
      market_id,
      direction: prediction.direction,
      confidence: prediction.confidence,
      reasoning: prediction.reasoning,
      model,
      message: 'AI prediction generated successfully'
    });
  } catch (err) {
    console.error('AI predict error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/batch-predict - Generate AI predictions for all active markets
app.post('/api/ai/batch-predict', async (req, res) => {
  try {
    await ensureAIPredictionsTable();

    // Get all active markets
    const marketsResult = await pool.query(
      "SELECT id, question, end_time FROM markets WHERE status = 'ACTIVE'"
    );
    const markets = marketsResult.rows;

    if (markets.length === 0) {
      return res.json({ message: 'No active markets found', predictions: [] });
    }

    const results = [];
    const errors = [];

    for (const market of markets) {
      try {
        // Check if prediction already exists
        const existing = await pool.query(
          'SELECT id FROM ai_predictions WHERE market_id = $1 ORDER BY created_at DESC LIMIT 1',
          [market.id]
        );
        if (existing.rows.length > 0) {
          results.push({ market_id: market.id, status: 'skipped', reason: 'Prediction already exists' });
          continue;
        }

        // Get stats
        const statsResult = await pool.query(`
          SELECT COALESCE(SUM(stake_amount), 0) as total_stake, COUNT(*) as prediction_count
          FROM predictions WHERE market_id = $1
        `, [market.id]);
        market.stats = {
          total_stake: parseInt(statsResult.rows[0].total_stake),
          prediction_count: parseInt(statsResult.rows[0].prediction_count)
        };

        // Generate prediction
        let prediction;
        try {
          prediction = await generateAIPrediction(market);
        } catch (aiErr) {
          prediction = {
            direction: Math.random() > 0.5 ? 'UP' : 'DOWN',
            confidence: 0.65 + Math.random() * 0.25,
            reasoning: 'Demo prediction - AI API not configured. Simulated for demonstration.'
          };
        }

        // Save
        const predictionId = uuidv4();
        const model = process.env.AI_PROVIDER === 'anthropic'
          ? (process.env.CLAUDE_MODEL || 'claude-3-5-haiku')
          : (process.env.OPENAI_MODEL || 'gpt-4o-mini');

        await pool.query(`
          INSERT INTO ai_predictions (id, market_id, direction, confidence, reasoning, model, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, NOW())
        `, [predictionId, market.id, prediction.direction, prediction.confidence, prediction.reasoning, model]);

        results.push({
          market_id: market.id,
          status: 'success',
          direction: prediction.direction,
          confidence: prediction.confidence
        });
      } catch (err) {
        errors.push({ market_id: market.id, error: err.message });
      }
    }

    res.json({
      message: `Batch prediction complete`,
      total_markets: markets.length,
      successful: results.filter(r => r.status === 'success').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      results,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (err) {
    console.error('Batch predict error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ai/prediction/:market_id - Get AI prediction for a specific market
app.get('/api/ai/prediction/:market_id', async (req, res) => {
  const { market_id } = req.params;

  try {
    const result = await pool.query(
      'SELECT * FROM ai_predictions WHERE market_id = $1 ORDER BY created_at DESC LIMIT 1',
      [market_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No AI prediction found for this market' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Start Server ──────────────────────────────────────────────────────────────

app.listen(port, () => {
  console.log(`Arena backend running on http://localhost:${port}`);
  console.log(`WebSocket running on ws://localhost:3002`);
  startSettlementCron();
  seedSampleMarkets();
});