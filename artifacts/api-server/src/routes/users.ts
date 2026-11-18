import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable, insertUserSchema } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

// POST /api/users - Create a new user
router.post("/", async (req, res) => {
  try {
    const body = insertUserSchema.parse(req.body);
    
    const user = await db.insert(usersTable).values(body).returning();
    
    res.status(201).json(user[0]);
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

// GET /api/users - Get all users
router.get("/", async (_req, res) => {
  try {
    const users = await db.select().from(usersTable);
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/users/:id - Get user by ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await db.select().from(usersTable).where(eq(usersTable.id, id));
    
    if (user.length === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    
    res.json(user[0]);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/users/:id - Update user
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const body = insertUserSchema.partial().parse(req.body);
    
    const user = await db
      .update(usersTable)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(usersTable.id, id))
      .returning();
    
    if (user.length === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    
    res.json(user[0]);
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

// DELETE /api/users/:id - Delete user
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await db
      .delete(usersTable)
      .where(eq(usersTable.id, id))
      .returning();
    
    if (user.length === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    
    res.json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
