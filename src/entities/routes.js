import express from 'express';
import * as entityController from './controller.js';
import { validate } from "../shared/middleware/validation.js";
import { schemas } from "../shared/middleware/validation.js";

const router = express.Router({ mergeParams: true });

router.get('/', validate(schemas.entity.list), entityController.getEntities);
router.get('/:id', validate(schemas.entity.get), entityController.getEntity);
router.post('/', validate(schemas.entity.create), entityController.addEntity);
router.put('/:id', validate(schemas.entity.update), entityController.editEntity);
router.delete('/:id', validate(schemas.entity.get), entityController.removeEntity);

export default router;