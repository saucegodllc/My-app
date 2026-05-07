import type { Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { clerkClient } from "@clerk/express";
import { eq, and, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { matchesTable, messagesTable } from "@workspace/db";
import { logger } from "./lib/logger";

export function setupSocketIO(httpServer: HttpServer) {
  const io = new SocketIOServer(httpServer, {
    path: "/api/socket.io",
    cors: {
      origin: true,
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error("Unauthorized"));

    try {
      const requestState = await clerkClient.authenticateRequest(
        new Request("https://placeholder.internal", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        { secretKey: process.env.CLERK_SECRET_KEY }
      );
      const auth = requestState.toAuth();
      if (!auth?.userId) return next(new Error("Unauthorized"));
      socket.data.userId = auth.userId;
      next();
    } catch (err) {
      logger.warn({ err }, "Socket auth failed");
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.data.userId as string;
    logger.info({ userId, socketId: socket.id }, "Socket connected");

    socket.on("join_room", async (matchId: string) => {
      if (typeof matchId !== "string") return;
      try {
        const [match] = await db
          .select()
          .from(matchesTable)
          .where(eq(matchesTable.id, matchId))
          .limit(1);

        if (!match || (match.userId1 !== userId && match.userId2 !== userId)) {
          socket.emit("error", "Forbidden");
          return;
        }

        socket.join(`match:${matchId}`);
        logger.info({ userId, matchId }, "User joined room");
      } catch (err) {
        logger.error({ err }, "Error joining room");
        socket.emit("error", "Server error");
      }
    });

    socket.on("leave_room", (matchId: string) => {
      if (typeof matchId !== "string") return;
      socket.leave(`match:${matchId}`);
    });

    socket.on("typing", ({ matchId, isTyping }: { matchId: string; isTyping: boolean }) => {
      if (typeof matchId !== "string") return;
      socket.to(`match:${matchId}`).emit("typing", { userId, isTyping });
    });

    socket.on("send_message", async ({ matchId, content }: { matchId: string; content: string }) => {
      if (typeof matchId !== "string" || typeof content !== "string" || !content.trim()) return;
      try {
        const [match] = await db
          .select()
          .from(matchesTable)
          .where(eq(matchesTable.id, matchId))
          .limit(1);

        if (!match || (match.userId1 !== userId && match.userId2 !== userId)) {
          socket.emit("error", "Forbidden");
          return;
        }

        const [message] = await db
          .insert(messagesTable)
          .values({
            matchId,
            senderId: userId,
            content: content.trim(),
            isRead: false,
          })
          .returning();

        io.to(`match:${matchId}`).emit("new_message", message);
        logger.info({ userId, matchId, messageId: message?.id }, "Message sent via socket");
      } catch (err) {
        logger.error({ err }, "Error sending socket message");
        socket.emit("error", "Failed to send message");
      }
    });

    socket.on("mark_read", async ({ matchId }: { matchId: string }) => {
      if (typeof matchId !== "string") return;
      try {
        await db
          .update(messagesTable)
          .set({ isRead: true })
          .where(
            and(
              eq(messagesTable.matchId, matchId),
              eq(messagesTable.isRead, false),
              sql`${messagesTable.senderId} != ${userId}`
            )
          );
      } catch (err) {
        logger.error({ err }, "Error marking messages read");
      }
    });

    socket.on("disconnect", () => {
      logger.info({ userId, socketId: socket.id }, "Socket disconnected");
    });
  });

  return io;
}
