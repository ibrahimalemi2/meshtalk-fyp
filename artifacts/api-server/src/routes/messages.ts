import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { messagesTable, insertMessageSchema } from "@workspace/db/schema";
import { eq, and, or } from "drizzle-orm";

const router: IRouter = Router();

// POST /api/messages - Send a message
router.post("/", async (req, res) => {
  try {
    const body = insertMessageSchema.parse(req.body);
    
    const message = await db.insert(messagesTable).values(body).returning();
    
    res.status(201).json(message[0]);
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

// GET /api/messages - Get all messages (for admin/debugging)
router.get("/", async (_req, res) => {
  try {
    const messages = await db.select().from(messagesTable);
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/messages/:peerId - Get message history with a peer
router.get("/:peerId", async (req, res) => {
  try {
    const { peerId } = req.params;
    const { userId } = req.query; // Current user ID
    
    if (!userId) {
      res.status(400).json({ error: "userId query parameter required" });
      return;
    }
    
    const messages = await db
      .select()
      .from(messagesTable)
      .where(
        or(
          and(
            eq(messagesTable.senderId, userId as string),
            eq(messagesTable.receiverId, peerId)
          ),
          and(
            eq(messagesTable.senderId, peerId),
            eq(messagesTable.receiverId, userId as string)
          )
        )
      );
    
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/messages/:id - Mark message as read
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { isRead, deliveryStatus } = req.body;
    
    const message = await db
      .update(messagesTable)
      .set({ isRead, deliveryStatus })
      .where(eq(messagesTable.id, id))
      .returning();
    
    if (message.length === 0) {
      res.status(404).json({ error: "Message not found" });
      return;
    }
    
    res.json(message[0]);
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

// DELETE /api/messages/:id - Delete message
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const message = await db
      .delete(messagesTable)
      .where(eq(messagesTable.id, id))
      .returning();
    
    if (message.length === 0) {
      res.status(404).json({ error: "Message not found" });
      return;
    }
    
    res.json({ message: "Message deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
