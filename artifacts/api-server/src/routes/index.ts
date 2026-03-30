import { Router, type IRouter } from "express";
import healthRouter from "./health";
import filesRouter from "./files";
import terminalRouter from "./terminal";

const router: IRouter = Router();

router.use(healthRouter);
router.use(filesRouter);
router.use(terminalRouter);

export default router;
