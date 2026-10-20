import pg from "pg";
import type { PoolClient } from "pg";
import { env } from "./env.js";

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: 25,
  idleTimeoutMillis: 30000,
});

export async function initializeSchema(): Promise<void> {
  const client: PoolClient = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(64) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS seats (
        id VARCHAR(10) PRIMARY KEY,
        row_label CHAR(1) NOT NULL,
        seat_number INT NOT NULL,
        price_cents INT NOT NULL DEFAULT 15000,
        status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'HELD', 'BOOKED')),
        held_by_user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
        held_until TIMESTAMPTZ,
        version INT NOT NULL DEFAULT 1,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS bookings (
        id VARCHAR(64) PRIMARY KEY,
        seat_id VARCHAR(10) NOT NULL REFERENCES seats(id),
        user_id VARCHAR(64) NOT NULL REFERENCES users(id),
        amount_cents INT NOT NULL,
        idempotency_key VARCHAR(128) UNIQUE NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}