import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { broadcastsTable, insertBroadcastSchema } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

// POST /api/broadcasts - Send a broadcast message
router.post("/", async (req, res) => {
  try {
    const body = insertBroadcastSchema.parse(req.body);
    
    const broadcast = await db.insert(broadcastsTable).values(body).returning();
    
    res.status(201).json(broadcast[0]);
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

// GET /api/broadcasts - Get all broadcasts
router.get("/", async (_req, res) => {
  try {
    const broadcasts = await db.select().from(broadcastsTable);
    res.json(broadcasts);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/broadcasts/:id - Get broadcast by ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const broadcast = await db.select().from(broadcastsTable).where(eq(broadcastsTable.id, id));
    
    if (broadcast.length === 0) {
      res.status(404).json({ error: "Broadcast not found" });
      return;
    }
    
    res.json(broadcast[0]);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/broadcasts/:id - Update broadcast recipient count
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { recipientCount } = req.body;
    
    const broadcast = await db
      .update(broadcastsTable)
      .set({ recipientCount })
      .where(eq(broadcastsTable.id, id))
      .returning();
    
    if (broadcast.length === 0) {
      res.status(404).json({ error: "Broadcast not found" });
      return;
    }
    
    res.json(broadcast[0]);
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

// DELETE /api/broadcasts/:id - Delete broadcast
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const broadcast = await db
      .delete(broadcastsTable)
      .where(eq(broadcastsTable.id, id))
      .returning();
    
    if (broadcast.length === 0) {
      res.status(404).json({ error: "Broadcast not found" });
      return;
    }
    
    res.json({ message: "Broadcast deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
