const express = require('express');
const { body } = require('express-validator');
const {
  createCoupon,
  listCoupons,
  validateCoupon,
} = require('../controllers/couponsController');
const { protect, authorizeRoles } = require('../middlewares/auth');
const { validateRequest } = require('../middlewares/errorHandler');

const router = express.Router();

router.use(protect);

router.get('/', authorizeRoles('admin'), listCoupons);

router.post(
  '/',
  authorizeRoles('admin'),
  [
    body('code').notEmpty().withMessage('Coupon code is required'),
    body('type').isIn(['percent', 'fixed']).withMessage('Coupon type must be percent or fixed'),
    body('value').isFloat({ gt: 0 }).withMessage('Coupon value must be greater than 0'),
    body('minOrderAmount').optional().isFloat({ min: 0 }),
    body('maxDiscountAmount').optional({ nullable: true }).isFloat({ min: 0 }),
    body('usageLimit').optional({ nullable: true }).isInt({ min: 1 }),
    body('expiresAt').optional({ nullable: true }).isISO8601().withMessage('Invalid expiry date'),
    validateRequest,
  ],
  createCoupon
);

router.post(
  '/validate',
  [
    body('code').notEmpty().withMessage('Coupon code is required'),
    body('subtotal').isFloat({ min: 0 }).withMessage('Subtotal is required'),
    validateRequest,
  ],
  validateCoupon
);

module.exports = router;
