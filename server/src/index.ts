import { app } from "./app.js";
import { env } from "./config/env.js";
import { seedDatabase } from "./scripts/seed.js";
import "./queue/expiry-queue.js";

async function bootstrap(): Promise<void> {
  await seedDatabase();
  app.listen(env.PORT, () => {
    console.log(`Ticket Engine running on http://localhost:${env.PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});