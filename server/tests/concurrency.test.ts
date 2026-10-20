import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { redis } from "../src/config/redis";
import { pool } from "../src/config/db";
import { seedDatabase } from "../src/scripts/seed";
import { seatExpiryQueue, seatExpiryWorker } from "../src/queue/expiry-queue";

describe("Atomic Seat Concurrency & Race Condition Suite", () => {
  beforeEach(async () => {
    await seedDatabase();
  });

  afterAll(async () => {
    await seatExpiryWorker.close();
    await seatExpiryQueue.close();
    await redis.quit();
    await pool.end();
  });

  it("allows exactly 1 winner when 200 users attempt to lock Seat A1 simultaneously", async () => {
    const lockKey = "seat:lock:A1";
    const concurrentUsers = Array.from({ length: 200 }, (_, i) => `user_${i}`);

    const results = await Promise.all(
      concurrentUsers.map((userId) => redis.acquireSeatLock(lockKey, userId, 120))
    );

    const winners = results.filter((r) => r === 1);
    const rejected = results.filter((r) => r === 0);

    expect(winners.length).toBe(1);
    expect(rejected.length).toBe(199);
  });

  it("prevents ABA lock-stealing and extends TTL only for true owner", async () => {
    const lockKey = "seat:lock:B5";

    const lockedByA = await redis.acquireSeatLock(lockKey, "usr_alpha", 120);
    expect(lockedByA).toBe(1);

    // User B cannot extend or release User A's lock
    const extendedByB = await redis.verifyAndExtendSeatLock(lockKey, "usr_beta", 60);
    expect(extendedByB).toBe(0);

    const releasedByB = await redis.releaseSeatLock(lockKey, "usr_beta");
    expect(releasedByB).toBe(0);

    // User A can extend and release their own lock
    const extendedByA = await redis.verifyAndExtendSeatLock(lockKey, "usr_alpha", 60);
    expect(extendedByA).toBe(1);

    const releasedByA = await redis.releaseSeatLock(lockKey, "usr_alpha");
    expect(releasedByA).toBe(1);
  });
});