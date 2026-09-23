import { Router } from 'express';
import { body } from 'express-validator';
import validate from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import asyncHandler from '../utils/asyncHandler.js';
import { toApi } from '../db/mapper.js';
import { updateLandlord } from '../services/landlords.js';

const router = Router();

router.use(requireAuth);

router.patch(
  '/profile',
  [body('name').trim().isLength({ min: 1, max: 120 })],
  validate,
  asyncHandler(async (req, res) => {
    const landlord = await updateLandlord(req.landlordId, { name: req.body.name });
    res.json({ landlord: toApi(landlord) });
  })
);

router.patch(
  '/notifications',
  [
    body('rentReminders').optional().isBoolean(),
    body('contractReminders').optional().isBoolean(),
    body('reminderDaysBefore').optional().isArray(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const updates = {};
    for (const key of ['rentReminders', 'contractReminders', 'reminderDaysBefore']) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    const landlord = await updateLandlord(req.landlordId, {
      notification_preferences: { ...req.landlord.notificationPreferences, ...updates },
    });
    res.json({ landlord: toApi(landlord) });
  })
);

export default router;
