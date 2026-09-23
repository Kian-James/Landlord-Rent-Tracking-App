import ApiError from '../utils/ApiError.js';

function notFound(req, res, next) {
  next(new ApiError(404, 'Not found.'));
}

function errorHandler(err, req, res, next) {
  const isOperational = err instanceof ApiError;
  const statusCode = isOperational ? err.statusCode : 500;

  if (!isOperational) {
    console.error('[unhandled error]', err);
  }

  res.status(statusCode).json({
    error: {
      message: isOperational ? err.message : 'Something went wrong. Please try again.',
      details: isOperational ? err.details : undefined,
    },
  });
}

export { notFound, errorHandler };
