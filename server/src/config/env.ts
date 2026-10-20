import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const emptyToUndefined = (val: unknown) =>
  typeof val === "string" && val.trim() === "" ? undefined : val;

const EnvSchema = z.object({
  NODE_ENV: z
    .preprocess(emptyToUndefined, z.enum(["development", "test", "production"]))
    .default("development"),
  PORT: z.preprocess(emptyToUndefined, z.coerce.number().int().positive()).default(4000),
  CLIENT_URL: z.preprocess(emptyToUndefined, z.url()).default("http://localhost:5173"),
  DATABASE_URL: z.string().min(1, { error: "DATABASE_URL is required" }),
  REDIS_URL: z.preprocess(emptyToUndefined, z.url()).default("redis://localhost:6379"),
  JWT_SECRET: z
    .preprocess(
      (val) => emptyToUndefined(val) ?? emptyToUndefined(process.env.JWT_SECRE),
      z.string().min(4, { error: "JWT_SECRET must be at least 4 characters" })
    ),
  LOAD_TEST_SECRET: z
    .preprocess(emptyToUndefined, z.string())
    .default("benchmark_secret_bypass"),
  HOLD_TTL_SECONDS: z
    .preprocess(emptyToUndefined, z.coerce.number().int().positive())
    .default(120),
});

const parsedEnv = EnvSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("❌ Invalid environment variables:", parsedEnv.error.issues);
  process.exit(1);
}

export const env = parsedEnv.data;
export type Env = z.infer<typeof EnvSchema>;