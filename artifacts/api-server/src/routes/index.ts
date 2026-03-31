import { Router, type IRouter } from "express";
import healthRouter from "./health";
import filesRouter from "./files";
import terminalRouter from "./terminal";
import authRouter from "./auth";
import systemRouter from "./system";
import githubRouter from "./github";
import settingsRouter from "./settings";
import { requireApiKey } from "../middleware/auth";

const router: IRouter = Router();

router.use(authRouter);
router.use(healthRouter);

router.use(requireApiKey);

router.use(systemRouter);
router.use(filesRouter);
router.use(terminalRouter);
router.use(githubRouter);
router.use(settingsRouter);

export default router;
