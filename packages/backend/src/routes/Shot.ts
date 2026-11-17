import express from "express";
import controller from "../controllers/Shot";

const router = express.Router();

router.get("/get", controller.readAll);
router.post("/create", controller.createShots);
router.patch("/drink/:shotId", controller.setDrunk);

export = router;
