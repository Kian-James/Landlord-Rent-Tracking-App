import { supabase } from '../config/supabase.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { toApi } from '../db/mapper.js';
import { getOrCreateLandlord } from '../services/landlords.js';

const requireAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new ApiError(401, 'Authentication required.');

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    throw new ApiError(401, 'Session expired or invalid. Please log in again.');
  }

  const { landlord, isNew } = await getOrCreateLandlord(data.user, { ip: req.ip });
  req.landlordId = landlord.id;
  req.landlord = toApi(landlord);
  req.isNewLandlord = isNew;
  next();
});

export { requireAuth };
