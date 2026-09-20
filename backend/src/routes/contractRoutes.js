import { Router } from 'express';
import { body } from 'express-validator';
import validate from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import * as ctrl from '../controllers/contractController.js';

const router = Router();

router.use(requireAuth);

router.get('/', ctrl.list);
router.get('/expiring-soon', ctrl.expiringSoon);

router.post(
  '/:id/renew',
  [
    body('startDate').isISO8601(),
    body('endDate').isISO8601(),
    body('durationMonths').isInt({ min: 1 }),
    body('advanceMonths').optional().isFloat({ min: 0 }),
    body('advanceAmount').optional({ values: 'falsy' }).isFloat({ min: 0 }),
    body('depositMonths').optional().isFloat({ min: 0 }),
    body('depositAmount').optional({ values: 'falsy' }).isFloat({ min: 0 }),
  ],
  validate,
  ctrl.renew
);

export default router;