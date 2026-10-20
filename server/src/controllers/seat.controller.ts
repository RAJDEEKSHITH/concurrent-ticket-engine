import { z } from "zod";
import type { Request, Response, NextFunction } from "express";
import { pool } from "../config/db.js";
import { redis } from "../config/redis.js";
import { env } from "../config/env.js";
import { seatExpiryQueue } from "../queue/expiry-queue.js";
import { sseBroadcaster } from "../queue/sse.js";
import type { AuthenticatedRequest } from "../middlewares/auth.js";
import { randomUUID } from "node:crypto";

const SeatParamSchema = z.object({
  id: z.string().trim().toUpperCase()
    .regex(/^[A-E](10|[1-9])$/, { error: "Invalid seat ID (expected A1-E10)" }),
});

const ConfirmPaymentBodySchema = z.object({
  outcome: z.enum(["SUCCESS", "FAIL"]),
  idempotencyKey: z.string().min(8, { error: "idempotencyKey must be at least 8 chars" }),
});

export function streamSeats(req: Request, res: Response) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  sseBroadcaster.addClient(res);

  req.on("close", () => {
    sseBroadcaster.removeClient(res);
  });
}

export async function getSeats(_req: Request, res: Response, next: NextFunction) {
  try {
    const { rows } = await pool.query(`
      SELECT id,
             row_label AS "rowLabel",
             seat_number AS "seatNumber",
             price_cents AS "priceCents",
             status,
             held_by_user_id AS "heldByUserId",
             held_until AS "heldUntil",
             version
      FROM seats
      ORDER BY row_label ASC, seat_number ASC;
    `);
    res.status(200).json(rows);
  } catch (err) {
    next(err);
  }
}

export async function holdSeat(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  let lockAcquired = false;
  let seatId = "";
  const userId = req.user?.userId;

  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const parsedParams = SeatParamSchema.parse(req.params);
    seatId = parsedParams.id;
    const lockKey = `seat:lock:${seatId}`;

    // Atomic Lua Lock in Redis
    const acquired = await redis.acquireSeatLock(lockKey, userId, env.HOLD_TTL_SECONDS);
    if (acquired === 0) {
      res.status(409).json({
        error: "Seat is currently locked or booked by another user",
        seatId,
      });
      return;
    }
    lockAcquired = true;

    // Optimistic status update in PostgreSQL
    const heldUntil = new Date(Date.now() + env.HOLD_TTL_SECONDS * 1000);
    const { rows, rowCount } = await pool.query<{
      id: string;
      status: "HELD";
      heldByUserId: string;
      heldUntil: string;
      version: number;
    }>(
      `UPDATE seats
       SET status = 'HELD',
           held_by_user_id = $1,
           held_until = $2,
           version = version + 1,
           updated_at = NOW()
       WHERE id = $3 AND status = 'AVAILABLE'
       RETURNING id,
                 status,
                 held_by_user_id AS "heldByUserId",
                 held_until AS "heldUntil",
                 version;`,
      [userId, heldUntil.toISOString(), seatId]
    );

    const updatedSeat = rows[0];
    if (!rowCount || rowCount === 0 || !updatedSeat) {
      await redis.releaseSeatLock(lockKey, userId);
      res.status(409).json({
        error: "Seat is already permanently booked",
        seatId,
      });
      return;
    }

    // Schedule BullMQ Delayed Expiry Job
    await seatExpiryQueue.add(
      `expire-${seatId}-${updatedSeat.version}`,
      {
        seatId,
        userId,
        versionAtHold: updatedSeat.version,
      },
      {
        delay: env.HOLD_TTL_SECONDS * 1000,
        jobId: `expire-${seatId}-${updatedSeat.version}`,
        removeOnComplete: true,
      }
    );

    // Broadcast live state via SSE
    sseBroadcaster.broadcast({
      type: "SEAT_UPDATED",
      seatId: updatedSeat.id,
      status: "HELD",
      heldByUserId: updatedSeat.heldByUserId,
      heldUntil: updatedSeat.heldUntil,
      version: updatedSeat.version,
    });

    res.status(200).json(updatedSeat);
  } catch (err) {
    if (lockAcquired && seatId) {
      await redis.releaseSeatLock(`seat:lock:${seatId}`, userId);
    }
    next(err);
  }
}

export async function confirmSeat(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const { id: seatId } = SeatParamSchema.parse(req.params);
    const { outcome, idempotencyKey } = ConfirmPaymentBodySchema.parse(req.body);
    const lockKey = `seat:lock:${seatId}`;
    const idempCacheKey = `idemp:${idempotencyKey}`;

    // Check Idempotency Cache
    const cachedResponse = await redis.get(idempCacheKey);
    if (cachedResponse) {
      res.status(200).json(JSON.parse(cachedResponse));
      return;
    }

    // Atomically verify lock ownership AND extend TTL by 30s during payment processing
    const lockValid = await redis.verifyAndExtendSeatLock(lockKey, userId, 30);
    if (lockValid === 0) {
      res.status(409).json({
        error: "Your hold expired or belongs to another user.",
      });
      return;
    }

    // Simulate payment gateway latency
    await new Promise((resolve) => setTimeout(resolve, 450));

    // Handle Payment Failure (Immediate Release)
    if (outcome === "FAIL") {
      await redis.releaseSeatLock(lockKey, userId);

      const { rows } = await pool.query<{ id: string; version: number }>(
        `UPDATE seats
         SET status = 'AVAILABLE',
             held_by_user_id = NULL,
             held_until = NULL,
             version = version + 1,
             updated_at = NOW()
         WHERE id = $1 AND status = 'HELD' AND held_by_user_id = $2
         RETURNING id, version;`,
        [seatId, userId]
      );

      if (rows[0]) {
        sseBroadcaster.broadcast({
          type: "SEAT_UPDATED",
          seatId,
          status: "AVAILABLE",
          heldByUserId: null,
          heldUntil: null,
          version: rows[0].version,
        });
      }

      res.status(402).json({
        error: "Payment declined by issuing bank. Seat lock released immediately.",
      });
      return;
    }

    // Handle Payment Success (Transactional Pessimistic + Optimistic Version Update)
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const seatLookup = await client.query<{ version: number; price_cents: number }>(
        `SELECT version, price_cents
         FROM seats
         WHERE id = $1 AND status = 'HELD' AND held_by_user_id = $2
         FOR UPDATE;`,
        [seatId, userId]
      );

      const lockedRow = seatLookup.rows[0];
      if (!lockedRow) {
        await client.query("ROLLBACK");
        res.status(409).json({ error: "Seat hold is no longer valid" });
        return;
      }

      const updateResult = await client.query<{ id: string; status: "BOOKED"; version: number;}>(
        `UPDATE seats
         SET status = 'BOOKED',
             held_until = NULL,
             version = version + 1,
             updated_at = NOW()
         WHERE id = $1 AND version = $2
         RETURNING id, status, version;`,
        [seatId, lockedRow.version]
      );

      const bookedSeat = updateResult.rows[0];
      if (!bookedSeat) {
        await client.query("ROLLBACK");
        res.status(409).json({ error: "Optimistic concurrency version mismatch" });
        return;
      }

      const bookingId = `bk_${randomUUID()}`;
      await client.query(
        `INSERT INTO bookings (id, seat_id, user_id, amount_cents, idempotency_key, status)
         VALUES ($1, $2, $3, $4, $5, 'CONFIRMED');`,
        [bookingId, seatId, userId, lockedRow.price_cents, idempotencyKey]
      );

      await client.query("COMMIT");

      await redis.releaseSeatLock(lockKey, userId);

      const responsePayload = {
        bookingId,
        seatId,
        status: "BOOKED",
        version: bookedSeat.version,
      };

      await redis.set(idempCacheKey, JSON.stringify(responsePayload), "EX", 86400);

      sseBroadcaster.broadcast({
        type: "SEAT_UPDATED",
        seatId,
        status: "BOOKED",
        heldByUserId: userId,
        heldUntil: null,
        version: bookedSeat.version,
      });

      res.status(200).json(responsePayload);
    } catch (txErr) {
      await client.query("ROLLBACK");
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
}

export async function resetSeats(_req: Request, res: Response, next: NextFunction) {
  const client = await pool.connect();
  try {
    const keys = await redis.keys("seat:lock:*");
    if (keys.length > 0) {
      await redis.del(...keys);
    }

    await client.query("BEGIN");
    await client.query("DELETE FROM bookings;");
    await client.query(`
      UPDATE seats
      SET status = 'AVAILABLE',
          held_by_user_id = NULL,
          held_until = NULL,
          version = 1,
          updated_at = NOW();
    `);
    await client.query("COMMIT");

    sseBroadcaster.broadcast({ type: "SYSTEM_RESET" });
    res.status(200).json({ message: "All 50 seats and Redis locks reset to AVAILABLE" });
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
}