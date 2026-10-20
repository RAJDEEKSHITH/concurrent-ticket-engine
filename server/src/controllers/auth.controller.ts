import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { z } from "zod";
import type { Request, Response, NextFunction } from "express";
import { pool } from "../config/db.js";
import { env } from "../config/env.js";
import type { AuthenticatedRequest, JwtUserPayload } from "../middlewares/auth.js";
import { randomUUID } from "node:crypto";
const AuthCredentialsSchema = z.object({
  email: z.email({ error: "Valid email address is required" }),
  password: z.string().min(6, { error: "Password must be at least 6 characters" }),
});

function attachAuthCookie(res: Response, payload: JwtUserPayload) {
  const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: "24h" });
  res.cookie("token", token, {
    httpOnly: true,
    sameSite: env.NODE_ENV === "production" ? "none" : "lax", // none is useful, if we cant deploy on same sub-domain(for side project security does not matter, persoal opinion)
    secure: env.NODE_ENV === "production",
    maxAge: 24 * 60 * 60 * 1000,
  });
}

export async function register(req: Request, res: Response, next: NextFunction){
  try {
    const { email, password } = AuthCredentialsSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(password, 10);
    const userId = `usr_${randomUUID()}`;

    const { rows } = await pool.query<{ id: string; email: string }>(
      `INSERT INTO users (id, email, password_hash)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO NOTHING
       RETURNING id, email;`,
      [userId, email, passwordHash]
    );

    const createdUser = rows[0];
    if (!createdUser) {
      res.status(409).json({ error: "Email already registered" });
      return;
    }

    const session: JwtUserPayload = { userId: createdUser.id, email: createdUser.email };
    attachAuthCookie(res, session);
    res.status(201).json(session);
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = AuthCredentialsSchema.parse(req.body);

    const { rows } = await pool.query<{
      id: string;
      email: string;
      password_hash: string;
    }>(`SELECT id, email, password_hash FROM users WHERE email = $1`, [email]);

    const userRow = rows[0];
    if (!userRow) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, userRow.password_hash);
    if (!isPasswordValid) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const session: JwtUserPayload = { userId: userRow.id, email: userRow.email };
    attachAuthCookie(res, session);
    res.status(200).json(session);
  } catch (err) {
    next(err);
  }
}

export function logout(_req: Request, res: Response) {
  res.clearCookie("token");
  res.status(200).json({ message: "Logged out" });
}

export function getCurrentUser(req: AuthenticatedRequest, res: Response) {
  res.status(200).json(req.user);
}