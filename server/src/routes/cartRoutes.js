const express = require('express');
const { body } = require('express-validator');
const {
  getCart,
  addCartItem,
  updateCartItem,
  removeCartItem,
} = require('../controllers/cartController');
const { protect } = require('../middlewares/auth');
const { validateRequest } = require('../middlewares/errorHandler');

const router = express.Router();

router.use(protect);

router.get('/', getCart);

router.post(
  '/items',
  [
    body('productId').isMongoId().withMessage('Valid productId is required'),
    body('size').isIn(['XS', 'S', 'M', 'L', 'XL']).withMessage('Invalid size'),
    body('quantity').optional().isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    validateRequest,
  ],
  addCartItem
);

router.patch(
  '/items/:itemId',
  [
    body('action').optional().isIn(['inc', 'dec']).withMessage('Action must be inc or dec'),
    body('quantity').optional().isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    validateRequest,
  ],
  updateCartItem
);

router.delete('/items/:itemId', removeCartItem);

module.exports = router;
