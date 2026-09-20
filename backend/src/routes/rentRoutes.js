import { Router } from 'express';
import { body } from 'express-validator';
import validate from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import * as ctrl from '../controllers/rentController.js';

const router = Router();

router.use(requireAuth);

router.get('/', ctrl.list);
router.post('/generate', ctrl.generate);
router.post(
  '/:id/mark-paid',
  [body('method').optional().isIn(['cash', 'gcash', 'maya', 'bank_transfer', 'other'])],
  validate,
  ctrl.markPaid
);
router.post('/:id/mark-unpaid', ctrl.markUnpaid);

export default router;
