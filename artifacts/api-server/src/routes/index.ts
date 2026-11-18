import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import peersRouter from "./peers";
import messagesRouter from "./messages";
import groupsRouter from "./groups";
import broadcastsRouter from "./broadcasts";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/users", usersRouter);
router.use("/peers", peersRouter);
router.use("/messages", messagesRouter);
router.use("/groups", groupsRouter);
router.use("/broadcasts", broadcastsRouter);

export default router;
