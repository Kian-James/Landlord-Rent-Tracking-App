import { Router } from 'express';
import { body } from 'express-validator';
import validate from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import * as controller from '../controllers/utilityBillController.js';

const router = Router();

router.use(requireAuth);

router.get('/', controller.list);
router.post('/generate', controller.generate);
router.post(
  '/:id/mark-paid',
  [body('paidAmount').optional().isFloat({ min: 0 })],
  validate,
  controller.markPaid
);
router.post('/:id/mark-unpaid', controller.markUnpaid);

export default router;
