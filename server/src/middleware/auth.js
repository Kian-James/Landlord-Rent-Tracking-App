import crypto from 'node:crypto';
import { supabase } from '../config/supabase.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { toApi } from '../db/mapper.js';
import { getOrCreateLandlord } from '../services/landlords.js';

// Every request has to prove who it is. Asking Supabase's auth server each time
// costs a network round trip, so:
//   1. the token is checked locally against Supabase's public signing keys when the
//      project supports it (getClaims), falling back to the auth server otherwise
//   2. a token that was just verified is remembered for a short while
// A signed-out or removed user's token can therefore keep working for up to
// TOKEN_TTL_MS (and until the token's own expiry at the latest).
const TOKEN_TTL_MS = 30 * 1000;
const MAX_CACHED = 500;
const verified = new Map(); // sha256(token) -> { user, until }

function tokenExpiry(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    return Number(payload.exp) * 1000 || 0;
  } catch {
    return 0;
  }
}

async function verifyToken(token) {
  const key = crypto.createHash('sha256').update(token).digest('hex');
  const hit = verified.get(key);
  if (hit && hit.until > Date.now()) return hit.user;
  verified.delete(key);

  let user = null;
  let exp = 0;

  if (typeof supabase.auth.getClaims === 'function') {
    const { data, error } = await supabase.auth.getClaims(token);
    const claims = data?.claims;
    if (!error && claims?.sub) {
      user = {
        id: claims.sub,
        email: claims.email,
        user_metadata: claims.user_metadata || {},
        app_metadata: claims.app_metadata || {},
      };
      exp = Number(claims.exp) * 1000 || 0;
    }
  }

  if (!user) {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      throw new ApiError(401, 'Session expired or invalid. Please log in again.');
    }
    user = data.user;
    exp = tokenExpiry(token);
  }

  verified.set(key, { user, until: Math.min(Date.now() + TOKEN_TTL_MS, exp || Infinity) });
  if (verified.size > MAX_CACHED) verified.delete(verified.keys().next().value);
  return user;
}

// After an account is deleted, forget its cached tokens so none can be used to
// re-create the landlord record during the cache window.
function revokeCachedTokens(userId) {
  for (const [key, entry] of verified) {
    if (entry.user?.id === userId) verified.delete(key);
  }
}

const requireAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new ApiError(401, 'Authentication required.');

  const user = await verifyToken(token);

  const { landlord, isNew } = await getOrCreateLandlord(user, { ip: req.ip });
  req.landlordId = landlord.id;
  req.landlord = toApi(landlord);
  req.isNewLandlord = isNew;
  next();
});

export { requireAuth, revokeCachedTokens };
