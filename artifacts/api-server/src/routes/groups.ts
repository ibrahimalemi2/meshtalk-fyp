import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { groupsTable, groupMembersTable, insertGroupSchema } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const router: IRouter = Router();

// POST /api/groups - Create a new group
router.post("/", async (req, res) => {
  try {
    const body = insertGroupSchema.parse(req.body);
    
    const group = await db.insert(groupsTable).values(body).returning();
    
    res.status(201).json(group[0]);
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

// GET /api/groups - Get all groups
router.get("/", async (_req, res) => {
  try {
    const groups = await db.select().from(groupsTable);
    res.json(groups);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/groups/:id - Get group by ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const group = await db.select().from(groupsTable).where(eq(groupsTable.id, id));
    
    if (group.length === 0) {
      res.status(404).json({ error: "Group not found" });
      return;
    }
    
    res.json(group[0]);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/groups/:id - Update group
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const body = insertGroupSchema.partial().parse(req.body);
    
    const group = await db
      .update(groupsTable)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(groupsTable.id, id))
      .returning();
    
    if (group.length === 0) {
      res.status(404).json({ error: "Group not found" });
      return;
    }
    
    res.json(group[0]);
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

// DELETE /api/groups/:id - Delete group
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const group = await db
      .delete(groupsTable)
      .where(eq(groupsTable.id, id))
      .returning();
    
    if (group.length === 0) {
      res.status(404).json({ error: "Group not found" });
      return;
    }
    
    res.json({ message: "Group deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/groups/:id/members - Get group members
router.get("/:id/members", async (req, res) => {
  try {
    const { id } = req.params;
    
    const members = await db
      .select()
      .from(groupMembersTable)
      .where(eq(groupMembersTable.groupId, id));
    
    res.json(members);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/groups/:id/members - Add member to group
router.post("/:id/members", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    
    if (!userId) {
      res.status(400).json({ error: "userId is required" });
      return;
    }
    
    const member = await db
      .insert(groupMembersTable)
      .values({ groupId: id, userId })
      .returning();
    
    res.status(201).json(member[0]);
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

// DELETE /api/groups/:groupId/members/:userId - Remove member from group
router.delete("/:groupId/members/:userId", async (req, res) => {
  try {
    const { groupId, userId } = req.params;
    
    const member = await db
      .delete(groupMembersTable)
      .where(
        and(
          eq(groupMembersTable.groupId, groupId),
          eq(groupMembersTable.userId, userId)
        )
      )
      .returning();
    
    if (member.length === 0) {
      res.status(404).json({ error: "Member not found in group" });
      return;
    }
    
    res.json({ message: "Member removed from group" });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
