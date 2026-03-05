const { validationResult } = require('express-validator');
const multer = require('multer');

const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: errors.array(),
    });
  }
  next();
};

const notFound = (_req, res) => {
  res.status(404).json({ message: 'Route not found' });
};

const errorHandler = (err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'Image size should be 5MB or smaller.' });
    }
    return res.status(400).json({ message: err.message || 'File upload failed.' });
  }

  if (err?.message?.toLowerCase().includes('only jpg') || err?.message?.toLowerCase().includes('image')) {
    return res.status(400).json({ message: err.message });
  }

  const status = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  res.status(status).json({
    message,
    ...(process.env.NODE_ENV !== 'production' ? { stack: err.stack } : {}),
  });
};

module.exports = {
  validateRequest,
  notFound,
  errorHandler,
};
