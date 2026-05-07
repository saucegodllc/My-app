import express, { Router, type IRouter } from "express";
import healthRouter from "./health";
import profilesRouter from "./profiles";
import discoveryRouter from "./discovery";
import matchesRouter from "./matches";
import messagesRouter from "./messages";
import subscriptionsRouter from "./subscriptions";
import reportsRouter from "./reports";
import dashboardRouter from "./dashboard";
import storageRouter from "./storage";
import resumeRouter from "./resume";
import authServerRouter from "./authServer";
import bioRouter from "./bio";
import eventsRouter from "./events";
import venuesRouter from "./venues";
import networkRouter from "./network";
import opportunitiesRouter from "./opportunities";

const router: IRouter = Router();

router.use((req, res, next) => {
  if (req.path === "/stripe/webhook") return next();
  return express.json({ limit: "15mb" })(req, res, next);
});

router.use(healthRouter);
router.use(profilesRouter);
router.use(discoveryRouter);
router.use(matchesRouter);
router.use(messagesRouter);
router.use(subscriptionsRouter);
router.use(reportsRouter);
router.use(dashboardRouter);
router.use(storageRouter);
router.use(resumeRouter);
router.use(authServerRouter);
router.use(bioRouter);
router.use(eventsRouter);
router.use(venuesRouter);
router.use(networkRouter);
router.use(opportunitiesRouter);

export default router;
