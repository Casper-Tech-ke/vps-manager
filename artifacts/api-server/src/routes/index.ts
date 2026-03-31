import { Router, type IRouter } from "express";
import healthRouter from "./health";
import filesRouter from "./files";
import terminalRouter from "./terminal";
import authRouter from "./auth";
import systemRouter from "./system";

const router: IRouter = Router();

router.use(authRouter);
router.use(systemRouter);
router.use(healthRouter);
router.use(filesRouter);
router.use(terminalRouter);

export default router;
