import express from "express";
import controller from "../controllers/LeagueCup";

const router = express.Router();

router.get("/get/:season", controller.readLeagueCup);
router.post("/create", controller.createLeagueCup);
router.post("/round/:leagueCupId", controller.addNextRound);
router.delete("/round/:leagueCupId", controller.undoLastRound);
router.patch("/update/:leagueCupId", controller.updateLeagueCup);
router.delete("/delete/:leagueCupId", controller.deleteLeagueCup);

export = router;
