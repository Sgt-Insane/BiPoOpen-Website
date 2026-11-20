import express from "express";
import controller from "../controllers/LiveGame";

const router = express.Router();

router.get("/list", controller.list);
router.post("/create", controller.create);
router.post("/peek", controller.peek);
router.post("/join", controller.join);
router.get("/:id", controller.read);
router.post("/:id/sync", controller.sync);
router.post("/:id/bind", controller.bind);
router.post("/:id/claim", controller.claim);
router.post("/:id/release", controller.release);
router.post("/:id/finish", controller.finish);
router.post("/:id/kick", controller.kick);
router.post("/:id/leave", controller.leave);

export = router;
