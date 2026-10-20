import { Queue, Worker } from "bullmq";
import type { Job } from "bullmq";
import { env } from "../config/env.js";
import { pool } from "../config/db.js";
import { redis } from "../config/redis.js";
import { sseBroadcaster } from "./sse.js";

const parsedRedisUrl = new URL(env.REDIS_URL);

const bullConnection = {
  host: parsedRedisUrl.hostname || "localhost",
  port: Number(parsedRedisUrl.port) || 6379,
  maxRetriesPerRequest: null,
};

export interface ExpiryJobData {
  seatId: string;
  userId: string;
  versionAtHold: number;
}

export const seatExpiryQueue = new Queue<ExpiryJobData>("seat-expiry-queue", {
  connection: bullConnection,
});

export const seatExpiryWorker = new Worker<ExpiryJobData>("seat-expiry-queue",
  async (job: Job<ExpiryJobData>) => {
    const { seatId, userId, versionAtHold } = job.data;

    const { rows, rowCount } = await pool.query<{
      id: string;
      status: "AVAILABLE";
      version: number;
    }>(
      `UPDATE seats
       SET status = 'AVAILABLE',
           held_by_user_id = NULL,
           held_until = NULL,
           version = version + 1,
           updated_at = NOW()
       WHERE id = $1
         AND status = 'HELD'
         AND held_by_user_id = $2
         AND version = $3
       RETURNING id, status, version;`,
      [seatId, userId, versionAtHold]
    );

    if (rowCount && rowCount > 0 && rows[0]) {
      await redis.releaseSeatLock(`seat:lock:${seatId}`, userId);

      sseBroadcaster.broadcast({
        type: "SEAT_UPDATED",
        seatId: rows[0].id,
        status: "AVAILABLE",
        heldByUserId: null,
        heldUntil: null,
        version: rows[0].version,
      });
    }
  },
  { connection: bullConnection }
);