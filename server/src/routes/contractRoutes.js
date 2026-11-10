import { Router } from 'express';
import { body } from 'express-validator';
import validate from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import * as controller from '../controllers/contractController.js';
import * as pdfController from '../controllers/contractPdfController.js';

const router = Router();

router.use(requireAuth);

router.get('/', controller.list);
router.get('/expiring-soon', controller.expiringSoon);

// Contract PDF: one click, built from the saved template and the lease's own details.
router.get('/:id/pdf', pdfController.download);

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
  controller.renew
);

export default router;