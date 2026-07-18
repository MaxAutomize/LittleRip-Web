import { neon } from '@neondatabase/serverless'

let client
let schemaPromise

export function db() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured')
  }
  if (!client) client = neon(process.env.DATABASE_URL)
  return client
}

export function ensureSchema() {
  if (!schemaPromise) schemaPromise = createSchema().catch((error) => {
    schemaPromise = null
    throw error
  })
  return schemaPromise
}

async function createSchema() {
  const sql = db()

  await sql`
    CREATE TABLE IF NOT EXISTS inner_users (
      id text PRIMARY KEY,
      email text NOT NULL UNIQUE,
      password_hash text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS inner_sessions (
      token_hash text PRIMARY KEY,
      user_id text NOT NULL REFERENCES inner_users(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now(),
      last_seen_at timestamptz NOT NULL DEFAULT now(),
      expires_at timestamptz NOT NULL
    )
  `

  await sql`
    CREATE INDEX IF NOT EXISTS inner_sessions_user_idx
    ON inner_sessions(user_id)
  `

  await sql`
    CREATE TABLE IF NOT EXISTS inner_profiles (
      user_id text PRIMARY KEY REFERENCES inner_users(id) ON DELETE CASCADE,
      system_prompt text NOT NULL,
      evolving_prompt text NOT NULL DEFAULT '',
      prompt_revision_count integer NOT NULL DEFAULT 0,
      active_token_estimate integer NOT NULL DEFAULT 0,
      context_token_limit integer NOT NULL DEFAULT 32000,
      compaction_threshold real NOT NULL DEFAULT 0.7,
      loop_enabled boolean NOT NULL DEFAULT false,
      cycle_number integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS inner_cycles (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES inner_users(id) ON DELETE CASCADE,
      cycle_number integer NOT NULL,
      started_at timestamptz NOT NULL,
      ends_at timestamptz NOT NULL,
      status text NOT NULL DEFAULT 'active',
      spoken_sentence text NOT NULL DEFAULT '',
      completed_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(user_id, cycle_number)
    )
  `

  await sql`
    CREATE INDEX IF NOT EXISTS inner_cycles_user_status_idx
    ON inner_cycles(user_id, status, started_at DESC)
  `

  await sql`
    CREATE TABLE IF NOT EXISTS inner_reflections (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES inner_users(id) ON DELETE CASCADE,
      cycle_id text NOT NULL REFERENCES inner_cycles(id) ON DELETE CASCADE,
      cycle_number integer NOT NULL,
      step_number integer NOT NULL,
      status text NOT NULL DEFAULT 'pending',
      focus text NOT NULL DEFAULT '',
      note text NOT NULL DEFAULT '',
      spoken_candidate text NOT NULL DEFAULT '',
      token_estimate integer NOT NULL DEFAULT 0,
      compacted_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(cycle_id, step_number)
    )
  `

  await sql`
    CREATE INDEX IF NOT EXISTS inner_reflections_user_created_idx
    ON inner_reflections(user_id, created_at DESC)
  `

  await sql`
    CREATE TABLE IF NOT EXISTS inner_inputs (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES inner_users(id) ON DELETE CASCADE,
      content text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      consumed_at timestamptz
    )
  `

  await sql`
    CREATE INDEX IF NOT EXISTS inner_inputs_user_created_idx
    ON inner_inputs(user_id, created_at DESC)
  `

  await sql`
    CREATE TABLE IF NOT EXISTS inner_memory_topics (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES inner_users(id) ON DELETE CASCADE,
      slug text NOT NULL,
      name text NOT NULL,
      summary text NOT NULL DEFAULT '',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(user_id, slug)
    )
  `

  await sql`
    CREATE INDEX IF NOT EXISTS inner_memory_topics_user_idx
    ON inner_memory_topics(user_id, updated_at DESC)
  `

  await sql`
    CREATE TABLE IF NOT EXISTS inner_memory_items (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES inner_users(id) ON DELETE CASCADE,
      topic_id text NOT NULL REFERENCES inner_memory_topics(id) ON DELETE CASCADE,
      cycle_number integer NOT NULL DEFAULT 0,
      title text NOT NULL,
      summary text NOT NULL,
      details text NOT NULL DEFAULT '',
      keywords text NOT NULL DEFAULT '',
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `

  await sql`
    CREATE INDEX IF NOT EXISTS inner_memory_items_topic_created_idx
    ON inner_memory_items(topic_id, created_at DESC)
  `

  await sql`
    CREATE TABLE IF NOT EXISTS inner_compactions (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES inner_users(id) ON DELETE CASCADE,
      source_token_estimate integer NOT NULL,
      summary text NOT NULL,
      prompt_before text NOT NULL DEFAULT '',
      prompt_after text NOT NULL DEFAULT '',
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS inner_compaction_jobs (
      user_id text PRIMARY KEY REFERENCES inner_users(id) ON DELETE CASCADE,
      started_at timestamptz NOT NULL DEFAULT now()
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS inner_rate_limits (
      bucket_key text PRIMARY KEY,
      request_count integer NOT NULL DEFAULT 1,
      expires_at timestamptz NOT NULL
    )
  `
}
