const express = require('express');
const { body } = require('express-validator');
const {
  checkout,
  getMyOrders,
  getAllOrders,
  updateOrderStatus,
} = require('../controllers/ordersController');
const { protect, authorizeRoles } = require('../middlewares/auth');
const { validateRequest } = require('../middlewares/errorHandler');

const router = express.Router();

router.use(protect);

router.post(
  '/checkout',
  [
    body('paymentMethod').isIn(['UPI', 'Card', 'COD']).withMessage('Invalid payment method'),
    body('transactionRef').optional().isString(),
    body('couponCode').optional().isString(),
    validateRequest,
  ],
  checkout
);

router.get('/my', getMyOrders);

router.get('/admin', authorizeRoles('admin'), getAllOrders);

router.patch(
  '/:id/status',
  authorizeRoles('admin'),
  [
    body('status')
      .isIn(['placed', 'processing', 'shipped', 'delivered', 'cancelled'])
      .withMessage('Invalid order status'),
    validateRequest,
  ],
  updateOrderStatus
);

module.exports = router;
