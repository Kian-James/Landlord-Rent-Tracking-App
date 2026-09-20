import { Router } from 'express';
import { body } from 'express-validator';
import validate from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import * as controller from '../controllers/propertyController.js';

const router = Router();

router.use(requireAuth);

router.get('/', controller.list);
router.get('/:id', controller.getOne);

router.post(
  '/',
  [body('name').trim().notEmpty().withMessage('Property name is required.'), body('address').trim().notEmpty().withMessage('Address is required.')],
  validate,
  controller.create
);

router.patch(
  '/:id',
  [
    body('name').optional().trim().notEmpty().withMessage('Property name cannot be empty.'),
    body('address').optional().trim().notEmpty().withMessage('Address cannot be empty.'),
    body('description').optional().isLength({ max: 2000 }).withMessage('Description is too long.'),
  ],
  validate,
  controller.update
);
router.delete('/:id', controller.archive);

export default router;
