import express from 'express';
import * as entityController from '../controllers/Entitycontroller.js';
import { validate } from "../middleware/validation.js";
import { schemas } from "../middleware/validation.js";

const router = express.Router({ mergeParams: true });

router.get('/', validate(schemas.entity.list), entityController.getEntities);
router.get('/:id', validate(schemas.entity.get), entityController.getEntity);
router.post('/', validate(schemas.entity.create), entityController.addEntity);
router.put('/:id', validate(schemas.entity.update), entityController.editEntity);
router.delete('/:id', validate(schemas.entity.get), entityController.removeEntity);

export default router;