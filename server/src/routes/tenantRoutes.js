import { Router } from 'express';
import { body } from 'express-validator';
import validate from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import * as controller from '../controllers/tenantController.js';

const router = Router();

router.use(requireAuth);

router.get('/', controller.list);
router.get('/:id', controller.getOne);

router.post(
  '/',
  [
    body('unitId').isUUID().withMessage('A valid unit is required.'),
    body('fullName').trim().notEmpty().withMessage('Tenant name is required.'),
    body('leaseStartDate').isISO8601().withMessage('A valid lease start date is required.'),
    body('leaseEndDate').isISO8601().withMessage('A valid lease end date is required.'),
    body('email').optional({ values: 'falsy' }).isEmail().withMessage('Email must be valid.'),
    body('phone').optional({ values: 'falsy' }).matches(/^09\d{9}$/).withMessage('Phone number must be 11 digits and start with 09.'),
    body('advanceMonths').optional().isFloat({ min: 0 }).withMessage('Advance months must be 0 or more.'),
    body('advanceAmount').optional({ values: 'falsy' }).isFloat({ min: 0 }).withMessage('Advance amount must be 0 or more.'),
    body('depositMonths').optional().isFloat({ min: 0 }).withMessage('Deposit months must be 0 or more.'),
    body('depositAmount').optional({ values: 'falsy' }).isFloat({ min: 0 }).withMessage('Deposit amount must be 0 or more.'),
  ],
  validate,
  controller.create
);

router.patch(
  '/:id',
  [
    body('email').optional({ values: 'falsy' }).isEmail().withMessage('Email must be valid.'),
    body('phone').optional({ values: 'falsy' }).matches(/^09\d{9}$/).withMessage('Phone number must be 11 digits and start with 09.'),
    body('status').optional().isIn(['active', 'notice_period', 'vacated', 'inactive']).withMessage('Invalid tenant status.'),
  ],
  validate,
  controller.update
);
router.post('/:id/move-out', controller.moveOut);

export default router;