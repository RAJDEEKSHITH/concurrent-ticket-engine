import { EventEmitter } from "node:events";
import type { Response } from "express";

export interface SeatBroadcastPayload {
  type: "SEAT_UPDATED" | "SYSTEM_RESET";
  seatId?: string;
  status?: "AVAILABLE" | "HELD" | "BOOKED";
  heldByUserId?: string | null;
  heldUntil?: string | null;
  version?: number;
}

class SSEBroadcaster extends EventEmitter {
  private clients = new Set<Response>();

  addClient(res: Response): void {
    this.clients.add(res);
  }

  removeClient(res: Response): void {
    this.clients.delete(res);
  }

  broadcast(payload: SeatBroadcastPayload): void {
    const message = `data: ${JSON.stringify(payload)}\n\n`;
    for (const client of this.clients) {
      client.write(message);
    }
  }
}

export const sseBroadcaster = new SSEBroadcaster();