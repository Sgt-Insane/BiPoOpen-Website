import express from "express";
import controller from "../controllers/Push";

const router = express.Router();

router.get("/vapidPublicKey", controller.getVapidPublicKey);
router.post("/subscribe", controller.subscribe);
router.patch("/preferences", controller.updatePreferences);
router.post("/status", controller.getStatus);
router.post("/unsubscribe", controller.unsubscribe);
router.post("/test", controller.sendTest);

export = router;
