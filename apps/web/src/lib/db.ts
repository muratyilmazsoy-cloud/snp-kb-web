import { Pool } from "pg";
import Database from "better-sqlite3";
import path from "path";
import { randomUUID } from "crypto";

/* ── PostgreSQL (production / Vercel) ─────────────────────────── */
let pool: Pool | null = null;

export function getPool(): Pool | null {
  const url = process.env.DATABASE_URL;
  if (!url || url.startsWith("file:")) return null; // SQLite local dev
  if (!pool) {
    pool = new Pool({
      connectionString: url,
      ssl: url.includes("supabase") ? { rejectUnauthorized: false } : false,
      max: 2,              // Her Vercel process en fazla 2 connection
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}

/* ── SQLite (local dev) ───────────────────────────────────────── */
const dbPath = path.join(process.cwd(), "dev.db");
const sqlite = new Database(dbPath);
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    source TEXT NOT NULL,
    project TEXT NOT NULL,
    content TEXT NOT NULL,
    tags TEXT DEFAULT '',
    model TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Users + Subscriptions (SQLite)
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT,
    stripe_customer_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    stripe_subscription_id TEXT UNIQUE,
    stripe_price_id TEXT,
    status TEXT DEFAULT 'incomplete',
    plan TEXT DEFAULT 'free',
    current_period_end DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Migration: add model column if missing (SQLite)
try {
  sqlite.exec(`ALTER TABLE conversations ADD COLUMN model TEXT DEFAULT ''`);
} catch {
  // column already exists
}

// Migration: add model column if missing (PostgreSQL)
(async () => {
  const p = getPool();
  if (p) {
    try {
      await p.query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS model TEXT DEFAULT ''`);
    } catch {
      // ignore
    }
  }
})();

// Migration: users + subscriptions (PostgreSQL)
(async () => {
  const p = getPool();
  if (p) {
    try {
      await p.query(`
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          name TEXT,
          stripe_customer_id TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      await p.query(`
        CREATE TABLE IF NOT EXISTS subscriptions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          stripe_subscription_id TEXT UNIQUE,
          stripe_price_id TEXT,
          status TEXT DEFAULT 'incomplete',
          plan TEXT DEFAULT 'free',
          current_period_end TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      await p.query(`CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id)`);
      await p.query(`CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status)`);
    } catch (err) {
      console.error("Users/Subscriptions migration error:", err);
    }
  }
})();

// Migration: add search_vector for Full Text Search (PostgreSQL only)
(async () => {
  const p = getPool();
  if (p) {
    try {
      await p.query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS search_vector tsvector`);
      await p.query(`CREATE INDEX IF NOT EXISTS idx_search_vector ON conversations USING GIN(search_vector)`);
      await p.query(`
        CREATE OR REPLACE FUNCTION conversations_search_vector_update() RETURNS trigger AS $$
        BEGIN
          NEW.search_vector :=
            setweight(to_tsvector('simple', COALESCE(NEW.title, '')), 'A') ||
            setweight(to_tsvector('simple', COALESCE(NEW.tags, '')), 'B') ||
            setweight(to_tsvector('simple', COALESCE(NEW.content, '')), 'C');
          RETURN NEW;
        END
        $$ LANGUAGE plpgsql;
      `);
      await p.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'conversations_search_vector_trigger') THEN
            CREATE TRIGGER conversations_search_vector_trigger
            BEFORE INSERT OR UPDATE ON conversations
            FOR EACH ROW EXECUTE FUNCTION conversations_search_vector_update();
          END IF;
        END $$;
      `);
      // Backfill existing rows
      await p.query(`
        UPDATE conversations SET search_vector =
          setweight(to_tsvector('simple', COALESCE(title, '')), 'A') ||
          setweight(to_tsvector('simple', COALESCE(tags, '')), 'B') ||
          setweight(to_tsvector('simple', COALESCE(content, '')), 'C')
        WHERE search_vector IS NULL;
      `);
    } catch (err) {
      console.error("FTS migration error:", err);
    }
  }
})();

/* ── Types ────────────────────────────────────────────────────── */
export interface Conversation {
  id: string;
  title: string;
  source: string;
  project: string;
  content: string;
  tags: string;
  model: string;
  created_at: string;
}

export type ConversationInput = Omit<Conversation, "id" | "created_at"> & { created_at?: string };

export interface ConversationListItem {
  id: string;
  title: string;
  source: string;
  project: string;
  tags: string;
  model: string;
  created_at: string;
}

export interface FilterParams {
  query?: string;
  models?: string[];
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

/* ── CRUD ─────────────────────────────────────────────────────── */
const LIST_COLUMNS = "id, title, source, project, tags, model, created_at";

export async function getAllConversations(): Promise<ConversationListItem[]> {
  const pool = getPool();
  if (pool) {
    const res = await pool.query(
      `SELECT ${LIST_COLUMNS} FROM conversations ORDER BY created_at DESC`
    );
    return res.rows as ConversationListItem[];
  }
  return sqlite
    .prepare(`SELECT ${LIST_COLUMNS} FROM conversations ORDER BY created_at DESC`)
    .all() as ConversationListItem[];
}

export async function getConversation(id: string): Promise<Conversation | null> {
  const pool = getPool();
  if (pool) {
    const res = await pool.query(`SELECT * FROM conversations WHERE id = $1`, [id]);
    return (res.rows[0] as Conversation) || null;
  }
  return sqlite.prepare(`SELECT * FROM conversations WHERE id = ?`).get(id) as Conversation | null;
}

export async function updateConversation(id: string, data: Partial<ConversationInput>): Promise<void> {
  const pool = getPool();
  const fields: string[] = [];
  const values: (string | string[])[] = [];
  let idx = 1;

  if (data.title !== undefined) { fields.push(`title = $${idx++}`); values.push(data.title); }
  if (data.source !== undefined) { fields.push(`source = $${idx++}`); values.push(data.source); }
  if (data.project !== undefined) { fields.push(`project = $${idx++}`); values.push(data.project); }
  if (data.content !== undefined) { fields.push(`content = $${idx++}`); values.push(data.content); }
  if (data.tags !== undefined) { fields.push(`tags = $${idx++}`); values.push(data.tags); }
  if (data.model !== undefined) { fields.push(`model = $${idx++}`); values.push(data.model); }
  if (data.created_at !== undefined) { fields.push(`created_at = $${idx++}`); values.push(data.created_at); }

  if (fields.length === 0) return;
  values.push(id);

  if (pool) {
    await pool.query(
      `UPDATE conversations SET ${fields.join(", ")} WHERE id = $${idx}`,
      values
    );
    return;
  }
  sqlite.prepare(`UPDATE conversations SET ${fields.map(() => "?").join(", ")} WHERE id = ?`).run(...values);
}

export async function deleteConversation(id: string): Promise<void> {
  const pool = getPool();
  if (pool) {
    await pool.query(`DELETE FROM conversations WHERE id = $1`, [id]);
    return;
  }
  sqlite.prepare(`DELETE FROM conversations WHERE id = ?`).run(id);
}

export async function createConversation(data: ConversationInput): Promise<string> {
  const id = randomUUID();
  const pool = getPool();
  const createdAt = data.created_at || new Date().toISOString();
  if (pool) {
    await pool.query(
      `INSERT INTO conversations (id, title, source, project, content, tags, model, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, data.title, data.source, data.project, data.content, data.tags, data.model || '', createdAt]
    );
    return id;
  }
  sqlite
    .prepare(
      `INSERT INTO conversations (id, title, source, project, content, tags, model, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(id, data.title, data.source, data.project, data.content, data.tags, data.model || '', createdAt);
  return id;
}

export async function searchConversations(query: string): Promise<ConversationListItem[]> {
  const pool = getPool();
  if (pool) {
    // PostgreSQL: Full Text Search with tsvector
    const tsquery = query.trim().split(/\s+/).filter(Boolean).join(" & ");
    const res = await pool.query(
      `SELECT ${LIST_COLUMNS} FROM conversations
       WHERE search_vector @@ to_tsquery('simple', $1)
       ORDER BY ts_rank(search_vector, to_tsquery('simple', $1)) DESC, created_at DESC`,
      [tsquery]
    );
    return res.rows as ConversationListItem[];
  }
  // SQLite: fallback to LIKE
  const like = `%${query}%`;
  return sqlite
    .prepare(
      `SELECT ${LIST_COLUMNS} FROM conversations
       WHERE title LIKE ? OR content LIKE ? OR tags LIKE ?
       ORDER BY created_at DESC`
    )
    .all(like, like, like) as ConversationListItem[];
}

function buildFilterWhere(pool: Pool | null, params: FilterParams) {
  const conditions: string[] = [];
  const values: (string | string[])[] = [];
  let idx = 1;
  let ftsOrder = "";

  if (params.query) {
    if (pool) {
      // PostgreSQL: Full Text Search
      const ftsQuery = params.query.trim().split(/\s+/).filter(Boolean).join(" & ");
      conditions.push(`search_vector @@ to_tsquery('simple', $${idx})`);
      values.push(ftsQuery);
      ftsOrder = `ts_rank(search_vector, to_tsquery('simple', $${idx})) DESC, `;
      idx++;
    } else {
      // SQLite: LIKE fallback
      const like = `%${params.query}%`;
      conditions.push(`(title LIKE ? OR content LIKE ? OR tags LIKE ?)`);
      values.push(like, like, like);
      idx += 3;
    }
  }

  if (params.models && params.models.length > 0) {
    if (pool) {
      const placeholders = params.models.map((_, i) => `$${idx + i}`).join(",");
      conditions.push(`model IN (${placeholders})`);
      values.push(...params.models);
      idx += params.models.length;
    } else {
      const placeholders = params.models.map(() => "?").join(",");
      conditions.push(`model IN (${placeholders})`);
      values.push(...params.models);
    }
  }

  if (params.dateFrom) {
    conditions.push(pool ? `created_at >= $${idx}` : `created_at >= ?`);
    values.push(params.dateFrom);
    idx++;
  }

  if (params.dateTo) {
    conditions.push(pool ? `created_at <= $${idx}` : `created_at <= ?`);
    values.push(params.dateTo);
    idx++;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const order = `ORDER BY ${ftsOrder}created_at DESC`;
  return { where, values, idx, order };
}

export async function filterConversations(params: FilterParams): Promise<ConversationListItem[]> {
  const pool = getPool();
  const { where, values, order } = buildFilterWhere(pool, params);

  if (pool) {
    const res = await pool.query(
      `SELECT ${LIST_COLUMNS} FROM conversations ${where} ${order}`,
      values
    );
    return res.rows as ConversationListItem[];
  }

  const stmt = sqlite.prepare(`SELECT ${LIST_COLUMNS} FROM conversations ${where} ${order}`);
  return stmt.all(...values) as ConversationListItem[];
}

export async function filterConversationsPage(params: FilterParams): Promise<{ items: ConversationListItem[]; total: number }> {
  const pool = getPool();
  const { where, values, order } = buildFilterWhere(pool, params);
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  const offset = (page - 1) * limit;

  if (pool) {
    const [itemsRes, countRes] = await Promise.all([
      pool.query(
        `SELECT ${LIST_COLUMNS} FROM conversations ${where} ${order} LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
        [...values, limit, offset]
      ),
      pool.query(`SELECT COUNT(*) FROM conversations ${where}`, values),
    ]);
    return {
      items: itemsRes.rows as ConversationListItem[],
      total: parseInt(countRes.rows[0].count, 10),
    };
  }

  const itemsStmt = sqlite.prepare(`SELECT ${LIST_COLUMNS} FROM conversations ${where} ${order} LIMIT ? OFFSET ?`);
  const countStmt = sqlite.prepare(`SELECT COUNT(*) as count FROM conversations ${where}`);
  return {
    items: itemsStmt.all(...values, limit, offset) as ConversationListItem[],
    total: (countStmt.get(...values) as { count: number }).count,
  };
}

/* ── User & Subscription Types ────────────────────────────────── */
export interface User {
  id: string;
  email: string;
  password_hash: string;
  name: string | null;
  stripe_customer_id: string | null;
  created_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  status: string;
  plan: string;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserWithSubscription extends User {
  subscription: Subscription | null;
}

/* ── User CRUD ────────────────────────────────────────────────── */
export async function getUserByEmail(email: string): Promise<User | null> {
  const pool = getPool();
  if (pool) {
    const res = await pool.query(`SELECT * FROM users WHERE email = $1`, [email]);
    return (res.rows[0] as User) || null;
  }
  return sqlite.prepare(`SELECT * FROM users WHERE email = ?`).get(email) as User | null;
}

export async function getUserById(id: string): Promise<User | null> {
  const pool = getPool();
  if (pool) {
    const res = await pool.query(`SELECT * FROM users WHERE id = $1`, [id]);
    return (res.rows[0] as User) || null;
  }
  return sqlite.prepare(`SELECT * FROM users WHERE id = ?`).get(id) as User | null;
}

export async function createUser(data: { email: string; password_hash: string; name?: string }): Promise<User> {
  const pool = getPool();
  const id = randomUUID();
  if (pool) {
    const res = await pool.query(
      `INSERT INTO users (id, email, password_hash, name) VALUES ($1, $2, $3, $4) RETURNING *`,
      [id, data.email, data.password_hash, data.name || null]
    );
    return res.rows[0] as User;
  }
  sqlite.prepare(`INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)`)
    .run(id, data.email, data.password_hash, data.name || null);
  return sqlite.prepare(`SELECT * FROM users WHERE id = ?`).get(id) as User;
}

export async function updateUserStripeCustomerId(userId: string, stripeCustomerId: string): Promise<void> {
  const pool = getPool();
  if (pool) {
    await pool.query(`UPDATE users SET stripe_customer_id = $1 WHERE id = $2`, [stripeCustomerId, userId]);
  } else {
    sqlite.prepare(`UPDATE users SET stripe_customer_id = ? WHERE id = ?`).run(stripeCustomerId, userId);
  }
}

/* ── Subscription CRUD ────────────────────────────────────────── */
export async function getSubscriptionByUserId(userId: string): Promise<Subscription | null> {
  const pool = getPool();
  if (pool) {
    const res = await pool.query(`SELECT * FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`, [userId]);
    return (res.rows[0] as Subscription) || null;
  }
  return sqlite.prepare(`SELECT * FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`).get(userId) as Subscription | null;
}

export async function createSubscription(data: {
  user_id: string;
  stripe_subscription_id?: string;
  stripe_price_id?: string;
  status?: string;
  plan?: string;
  current_period_end?: string;
}): Promise<Subscription> {
  const pool = getPool();
  const id = randomUUID();
  if (pool) {
    const res = await pool.query(
      `INSERT INTO subscriptions (id, user_id, stripe_subscription_id, stripe_price_id, status, plan, current_period_end) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [id, data.user_id, data.stripe_subscription_id || null, data.stripe_price_id || null, data.status || 'incomplete', data.plan || 'free', data.current_period_end || null]
    );
    return res.rows[0] as Subscription;
  }
  sqlite.prepare(
    `INSERT INTO subscriptions (id, user_id, stripe_subscription_id, stripe_price_id, status, plan, current_period_end) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, data.user_id, data.stripe_subscription_id || null, data.stripe_price_id || null, data.status || 'incomplete', data.plan || 'free', data.current_period_end || null);
  return sqlite.prepare(`SELECT * FROM subscriptions WHERE id = ?`).get(id) as Subscription;
}

export async function updateSubscriptionByStripeId(stripeSubscriptionId: string, data: Partial<Subscription>): Promise<void> {
  const pool = getPool();
  const fields: string[] = [];
  const values: (string | null)[] = [];
  let idx = 1;

  if (data.status !== undefined) { fields.push(`status = $${idx++}`); values.push(data.status); }
  if (data.plan !== undefined) { fields.push(`plan = $${idx++}`); values.push(data.plan); }
  if (data.stripe_price_id !== undefined) { fields.push(`stripe_price_id = $${idx++}`); values.push(data.stripe_price_id); }
  if (data.current_period_end !== undefined) { fields.push(`current_period_end = $${idx++}`); values.push(data.current_period_end); }
  if (fields.length === 0) return;
  fields.push(`updated_at = NOW()`);
  values.push(stripeSubscriptionId);

  if (pool) {
    await pool.query(`UPDATE subscriptions SET ${fields.join(", ")} WHERE stripe_subscription_id = $${idx}`, values);
  } else {
    sqlite.prepare(`UPDATE subscriptions SET ${fields.map(f => f.replace(/\$\d+/g, '?')).join(", ")}, updated_at = datetime('now') WHERE stripe_subscription_id = ?`)
      .run(...values);
  }
}

export async function getUserWithSubscription(userId: string): Promise<UserWithSubscription | null> {
  const user = await getUserById(userId);
  if (!user) return null;
  const subscription = await getSubscriptionByUserId(userId);
  return { ...user, subscription };
}

/* ── Admin: list all users with subscriptions ─────────────────── */
export async function getAllUsersWithSubscriptions(): Promise<UserWithSubscription[]> {
  const pool = getPool();
  if (pool) {
    const res = await pool.query(`
      SELECT u.*, s.id as sub_id, s.stripe_subscription_id, s.stripe_price_id, s.status as sub_status, s.plan as sub_plan, s.current_period_end as sub_current_period_end, s.created_at as sub_created_at, s.updated_at as sub_updated_at
      FROM users u
      LEFT JOIN subscriptions s ON s.user_id = u.id AND s.id = (
        SELECT id FROM subscriptions WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1
      )
      ORDER BY u.created_at DESC
    `);
    return res.rows.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      email: row.email as string,
      password_hash: row.password_hash as string,
      name: row.name as string | null,
      stripe_customer_id: row.stripe_customer_id as string | null,
      created_at: row.created_at as string,
      subscription: row.sub_id ? {
        id: row.sub_id as string,
        user_id: row.id as string,
        stripe_subscription_id: row.stripe_subscription_id as string | null,
        stripe_price_id: row.stripe_price_id as string | null,
        status: row.sub_status as string,
        plan: row.sub_plan as string,
        current_period_end: row.sub_current_period_end as string | null,
        created_at: row.sub_created_at as string,
        updated_at: row.sub_updated_at as string,
      } : null,
    }));
  }
  // SQLite fallback
  const users = sqlite.prepare(`SELECT * FROM users ORDER BY created_at DESC`).all() as User[];
  return Promise.all(users.map(async (u) => ({ ...u, subscription: await getSubscriptionByUserId(u.id) })));
}
