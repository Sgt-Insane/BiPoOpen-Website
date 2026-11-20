import express from "express";
import controller from "../controllers/KnechtSession";

const router = express.Router();

router.post("/create", controller.create);
router.post("/join", controller.join);
router.post("/bump", controller.bump);
router.post("/bump/:bumpId", controller.bumpStatus);
router.post("/:code/get", controller.get);
router.post("/:code/update", controller.update);
router.post("/:code/leave", controller.leave);

export = router;
