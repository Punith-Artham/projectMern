const express = require('express');
const { body } = require('express-validator');
const {
  register,
  registerAdmin,
  login,
  loginAdmin,
  me,
} = require('../controllers/authController');
const { validateRequest } = require('../middlewares/errorHandler');
const { protect } = require('../middlewares/auth');

const router = express.Router();

router.post(
  '/register',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    validateRequest,
  ],
  register
);

router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
    validateRequest,
  ],
  login
);

router.post(
  '/register-admin',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    validateRequest,
  ],
  registerAdmin
);

router.post(
  '/login-admin',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
    validateRequest,
  ],
  loginAdmin
);

router.get('/me', protect, me);

module.exports = router;
