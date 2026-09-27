import { Router } from 'express';
import { body } from 'express-validator';
import validate from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import * as controller from '../controllers/unitController.js';

const router = Router();

router.use(requireAuth);

router.get('/', controller.list);

router.post(
  '/',
  [
    body('propertyId').isUUID().withMessage('A valid property is required.'),
    body('name').trim().notEmpty().withMessage('Unit name is required.'),
    body('monthlyRent').isFloat({ min: 0 }).withMessage('Monthly rent must be a positive number.'),
    body('utilities.electricity.amount').optional({ values: 'falsy' }).isFloat({ min: 0 }).withMessage('Electricity bill must be a positive number.'),
    body('utilities.electricity.dueDay').optional({ values: 'falsy' }).isInt({ min: 1, max: 31 }).withMessage('Electricity due day must be between 1 and 31.'),
    body('utilities.water.amount').optional({ values: 'falsy' }).isFloat({ min: 0 }).withMessage('Water bill must be a positive number.'),
    body('utilities.water.dueDay').optional({ values: 'falsy' }).isInt({ min: 1, max: 31 }).withMessage('Water due day must be between 1 and 31.'),
    body('utilities.wifi.amount').optional({ values: 'falsy' }).isFloat({ min: 0 }).withMessage('Wifi bill must be a positive number.'),
    body('utilities.wifi.dueDay').optional({ values: 'falsy' }).isInt({ min: 1, max: 31 }).withMessage('Wifi due day must be between 1 and 31.'),
  ],
  validate,
  controller.create
);

router.patch(
  '/:id',
  [
    body('name').optional().trim().notEmpty().withMessage('Unit name cannot be empty.'),
    body('monthlyRent').optional().isFloat({ min: 0 }).withMessage('Monthly rent must be a positive number.'),
    body('status').optional().isIn(['occupied', 'vacant', 'reserved', 'maintenance']).withMessage('Invalid unit status.'),
    body('utilities.electricity.amount').optional({ values: 'falsy' }).isFloat({ min: 0 }).withMessage('Electricity bill must be a positive number.'),
    body('utilities.electricity.dueDay').optional({ values: 'falsy' }).isInt({ min: 1, max: 31 }).withMessage('Electricity due day must be between 1 and 31.'),
    body('utilities.water.amount').optional({ values: 'falsy' }).isFloat({ min: 0 }).withMessage('Water bill must be a positive number.'),
    body('utilities.water.dueDay').optional({ values: 'falsy' }).isInt({ min: 1, max: 31 }).withMessage('Water due day must be between 1 and 31.'),
    body('utilities.wifi.amount').optional({ values: 'falsy' }).isFloat({ min: 0 }).withMessage('Wifi bill must be a positive number.'),
    body('utilities.wifi.dueDay').optional({ values: 'falsy' }).isInt({ min: 1, max: 31 }).withMessage('Wifi due day must be between 1 and 31.'),
  ],
  validate,
  controller.update
);
router.delete('/:id', controller.remove);

export default router;
