import rateLimit from 'express-rate-limit';

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
});

export { apiLimiter };

// Reading and converting an uploaded contract is the heaviest thing the API does.
const contractConvertLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many contract uploads. Please try again in an hour.' } },
});

// Previews are asked for after each edit in the template editor.
const contractPreviewLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many previews. Please try again in a little while.' } },
});

export { contractConvertLimiter, contractPreviewLimiter };
