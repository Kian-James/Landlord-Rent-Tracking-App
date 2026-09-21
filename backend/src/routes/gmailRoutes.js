import { Router } from 'express';
import crypto from 'crypto';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import { requireAuth } from '../middleware/auth.js';
import { recordAudit } from '../services/audit.js';
import { updateLandlord } from '../services/landlords.js';

const router = Router();

const GMAIL_SCOPES = ['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/gmail.readonly'];

function isConfigured() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GMAIL_REDIRECT_URI);
}

router.get(
  '/oauth/start',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!isConfigured()) {
      throw new ApiError(501, 'Gmail integration is not configured on this server yet. See docs/GMAIL_INTEGRATION.md.');
    }
    const state = Buffer.from(JSON.stringify({ landlordId: req.landlordId, nonce: crypto.randomUUID() })).toString(
      'base64url'
    );
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID);
    url.searchParams.set('redirect_uri', process.env.GMAIL_REDIRECT_URI);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
    url.searchParams.set('scope', GMAIL_SCOPES.join(' '));
    url.searchParams.set('state', state);
    res.json({ redirectUrl: url.toString() });
  })
);

router.get(
  '/oauth/callback',
  asyncHandler(async (req, res) => {
    if (!isConfigured()) {
      throw new ApiError(501, 'Gmail integration is not configured on this server yet.');
    }
    const { code, state } = req.query;
    if (!code || !state) throw new ApiError(400, 'Missing OAuth code or state.');

    let landlordId;
    try {
      ({ landlordId } = JSON.parse(Buffer.from(state, 'base64url').toString()));
    } catch {
      throw new ApiError(400, 'Invalid OAuth state.');
    }

    throw new ApiError(
      501,
      'Gmail token exchange is not implemented in this environment (no live Google credentials). See docs/GMAIL_INTEGRATION.md for the exact two calls to add here.'
    );

  })
);

router.post(
  '/disconnect',
  requireAuth,
  asyncHandler(async (req, res) => {
    await updateLandlord(req.landlordId, {
      gmail_integration: { connected: false, gmailAddress: null, scopes: [] },
    });
    await recordAudit('gmail.disconnected', { landlord: req.landlordId });
    res.status(204).end();
  })
);

router.get(
  '/status',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({
      configured: isConfigured(),
      connected: !!req.landlord.gmailIntegration?.connected,
      gmailAddress: req.landlord.gmailIntegration?.gmailAddress || null,
    });
  })
);

export default router;
