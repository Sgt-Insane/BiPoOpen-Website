import express from "express";
import controller from "../controllers/LiveGame";

const router = express.Router();

router.get("/list", controller.list);
router.post("/create", controller.create);
router.post("/join", controller.join);
router.get("/:id", controller.read);
router.post("/:id/sync", controller.sync);
router.post("/:id/finish", controller.finish);

export = router;
