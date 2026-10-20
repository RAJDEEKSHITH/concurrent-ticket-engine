import bcrypt from "bcrypt";
import { pool, initializeSchema } from "../config/db.js";
import { redis } from "../config/redis.js";

export async function seedDatabase(): Promise<void> {
  await initializeSchema();

  const lockKeys = await redis.keys("seat:lock:*");
  if (lockKeys.length > 0) {
    await redis.del(...lockKeys);
  }

  const passwordHash = await bcrypt.hash("password123", 10);
  const defaultUsers = [
    { id: "usr_alpha", email: "user_alpha@test.com" },
    { id: "usr_beta", email: "user_beta@test.com" },
    { id: "usr_gamma", email: "user_gamma@test.com" },
  ];

  for (const user of defaultUsers) {
    await pool.query(
      `INSERT INTO users (id, email, password_hash)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO NOTHING;`,
      [user.id, user.email, passwordHash]
    );
  }

  const rows = ["A", "B", "C", "D", "E"];
  for (const row of rows) {
    for (let num = 1; num <= 10; num++) {
      const seatId = `${row}${num}`;
      const priceCents = row === "A" ? 25000 : 15000;
      await pool.query(
        `INSERT INTO seats (id, row_label, seat_number, price_cents, status, version)
         VALUES ($1, $2, $3, $4, 'AVAILABLE', 1)
         ON CONFLICT (id) DO UPDATE
         SET status = 'AVAILABLE',
             held_by_user_id = NULL,
             held_until = NULL,
             version = 1;`,
        [seatId, row, num, priceCents]
      );
    }
  }

  console.log("Seeded 3 test users and 50 cinema seats (A1 - E10).");
}

if (process.argv[1]?.endsWith("seed.ts")) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}