import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { peersTable, insertPeerSchema } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

// POST /api/peers - Register/create a peer
router.post("/", async (req, res) => {
  try {
    const body = insertPeerSchema.parse(req.body);
    
    const peer = await db.insert(peersTable).values(body).returning();
    
    res.status(201).json(peer[0]);
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

// GET /api/peers - Get all peers (peer discovery)
router.get("/", async (_req, res) => {
  try {
    const peers = await db.select().from(peersTable);
    res.json(peers);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/peers/:id - Get peer by ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const peer = await db.select().from(peersTable).where(eq(peersTable.id, id));
    
    if (peer.length === 0) {
      res.status(404).json({ error: "Peer not found" });
      return;
    }
    
    res.json(peer[0]);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/peers/:id - Update peer status (online/offline/relay)
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const body = insertPeerSchema.partial().parse(req.body);
    
    const peer = await db
      .update(peersTable)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(peersTable.id, id))
      .returning();
    
    if (peer.length === 0) {
      res.status(404).json({ error: "Peer not found" });
      return;
    }
    
    res.json(peer[0]);
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

// DELETE /api/peers/:id - Remove peer from network
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const peer = await db
      .delete(peersTable)
      .where(eq(peersTable.id, id))
      .returning();
    
    if (peer.length === 0) {
      res.status(404).json({ error: "Peer not found" });
      return;
    }
    
    res.json({ message: "Peer removed successfully" });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
