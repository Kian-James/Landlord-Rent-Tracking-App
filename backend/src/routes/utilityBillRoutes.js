import { Router } from 'express';
import { body } from 'express-validator';
import validate from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import * as ctrl from '../controllers/utilityBillController.js';

const router = Router();

router.use(requireAuth);

router.get('/', ctrl.list);
router.post('/generate', ctrl.generate);
router.post(
  '/:id/mark-paid',
  [body('paidAmount').optional().isFloat({ min: 0 })],
  validate,
  ctrl.markPaid
);
router.post('/:id/mark-unpaid', ctrl.markUnpaid);

export default router;
