import express from 'express';
import controller from '../controllers/PlayerImage';

const router = express.Router();

router.post('/upload', controller.upsertPlayerImage);
router.get('/get/:playerName', controller.getPlayerImage);
router.get('/list', controller.listPlayerImages);
router.get('/raw/:playerName', controller.getRawPlayerImage);
router.delete('/delete/:playerName', controller.deletePlayerImage);

export = router;
