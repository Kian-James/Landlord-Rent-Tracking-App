import { Router } from 'express';
import { body } from 'express-validator';
import validate from '../middleware/validate.js';
import { requireAuth, revokeCachedTokens } from '../middleware/auth.js';
import { accountDeleteLimiter } from '../middleware/rateLimit.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { toApi } from '../db/mapper.js';
import { updateLandlord, deleteLandlordAccount } from '../services/landlords.js';

const router = Router();

router.use(requireAuth);

router.patch(
  '/profile',
  [body('name').trim().isLength({ min: 1, max: 120 }), body('address').optional().trim().isLength({ min: 5, max: 300 }).withMessage('Enter your full address (at least 5 characters). It is printed on your contracts.')],
  validate,
  asyncHandler(async (req, res) => {
    const patch = { name: req.body.name };
    if (req.body.address !== undefined) patch.address = req.body.address;
    const landlord = await updateLandlord(req.landlordId, patch);
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

// Permanently delete the signed-in landlord's account and all their data.
// The person has to type their account email as a deliberate confirmation (the app
// also re-checks their password first for email/password accounts).
router.delete(
  '/account',
  accountDeleteLimiter,
  [body('confirmEmail').isString().trim().isLength({ min: 3, max: 320 })],
  validate,
  asyncHandler(async (req, res) => {
    const typed = String(req.body.confirmEmail || '').trim().toLowerCase();
    if (typed !== String(req.landlord.email || '').toLowerCase()) {
      throw new ApiError(400, 'The email you typed does not match your account email.');
    }
    await deleteLandlordAccount(req.landlordId);
    revokeCachedTokens(req.landlordId);
    console.info(`[account] deleted landlord ${req.landlordId}`);
    res.json({ deleted: true });
  })
);

export default router;
