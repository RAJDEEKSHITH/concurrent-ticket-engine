import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { env } from "./config/env.js";
import { authRouter } from "./routes/auth.route.js";
import { seatRouter } from "./routes/seats.route.js";
import { errorHandler } from "./middlewares/error-handler.js";

export const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
  })
);

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  skip: (req) =>
    env.NODE_ENV === "test" ||
    req.headers["x-load-test-secret"] === env.LOAD_TEST_SECRET,
    standardHeaders: "draft-7",
    legacyHeaders: false,
});

app.use("/api", apiLimiter);
app.use("/api/auth", authRouter);
app.use("/api/seats", seatRouter);
app.use(errorHandler);