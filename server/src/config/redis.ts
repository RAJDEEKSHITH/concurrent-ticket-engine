import { Redis } from "ioredis";
import { env } from "./env.js";

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

const ACQUIRE_LOCK_LUA = `
if redis.call("EXISTS", KEYS[1]) == 0 then
  redis.call("SET", KEYS[1], ARGV[1], "EX", tonumber(ARGV[2]))
  return 1
else
  return 0
end
`;

const EXTEND_LOCK_LUA = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  redis.call("EXPIRE", KEYS[1], tonumber(ARGV[2]))
  return 1
else
  return 0
end
`;

const RELEASE_LOCK_LUA = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
else
  return 0
end
`;

redis.defineCommand("acquireSeatLock", {
  numberOfKeys: 1,
  lua: ACQUIRE_LOCK_LUA,
});

redis.defineCommand("verifyAndExtendSeatLock", {
  numberOfKeys: 1,
  lua: EXTEND_LOCK_LUA,
});

redis.defineCommand("releaseSeatLock", {
  numberOfKeys: 1,
  lua: RELEASE_LOCK_LUA,
});

declare module "ioredis" {
  interface RedisCommander<Context> {
    acquireSeatLock(key: string, userId: string, ttlSeconds: number): Promise<number>;
    verifyAndExtendSeatLock(key: string, userId: string, ttlSeconds: number): Promise<number>;
    releaseSeatLock(key: string, userId: string): Promise<number>;
  }
}