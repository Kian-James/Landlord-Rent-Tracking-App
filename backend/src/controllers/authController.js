import asyncHandler from '../utils/asyncHandler.js';

// GET /api/auth/user
const user = asyncHandler(async (req, res) => {
  res.json({ landlord: req.landlord });
});

export { user };
