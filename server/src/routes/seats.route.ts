import { Router } from "express";
import {streamSeats, getSeats,holdSeat, confirmSeat, resetSeats } from "../controllers/seat.controller.js";
import { authenticate } from "../middlewares/auth.js";

export const seatRouter = Router();

seatRouter.get("/stream", streamSeats);
seatRouter.get("/", getSeats);
seatRouter.post("/reset", resetSeats);
seatRouter.post("/:id/hold", authenticate, holdSeat);
seatRouter.post("/:id/confirm", authenticate, confirmSeat);