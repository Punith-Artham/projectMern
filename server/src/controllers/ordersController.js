const Cart = require('../models/Cart');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Coupon = require('../models/Coupon');
const {
  normalizeCode,
  calculateDiscount,
  ensureCouponIsValid,
} = require('./couponsController');

const checkout = async (req, res, next) => {
  try {
    const { paymentMethod, transactionRef = '', couponCode = '' } = req.body;

    if (!['UPI', 'Card', 'COD'].includes(paymentMethod)) {
      return res.status(400).json({ message: 'Invalid payment method' });
    }

    if ((paymentMethod === 'UPI' || paymentMethod === 'Card') && !transactionRef.trim()) {
      return res.status(400).json({
        message: 'Transaction reference is required for UPI/Card payment',
      });
    }

    const cart = await Cart.findOne({ user: req.user._id }).populate('items.product');
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: 'Cart is empty' });
    }

    const orderItems = [];
    for (const item of cart.items) {
      const product = await Product.findById(item.product._id);
      if (!product) {
        return res.status(404).json({ message: `${item.product.name} is no longer available` });
      }

      const itemQty = Number(item.quantity || 1);
      if (Number(product.quantity || 0) < itemQty) {
        return res.status(400).json({
          message: `${product.name} has only ${Number(product.quantity || 0)} item(s) left`,
        });
      }

      orderItems.push({
        product: product._id,
        name: product.name,
        image: product.image,
        size: item.size,
        unitPrice: Number(product.price || 0),
        quantity: itemQty,
      });
    }

    const subtotalAmount = orderItems.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0
    );

    let coupon = null;
    let normalizedCouponCode = '';
    let discountAmount = 0;

    if (String(couponCode || '').trim()) {
      normalizedCouponCode = normalizeCode(couponCode);
      coupon = await Coupon.findOne({ code: normalizedCouponCode });

      const validation = ensureCouponIsValid(coupon, subtotalAmount);
      if (!validation.valid) {
        return res.status(400).json({ message: validation.message });
      }

      discountAmount = calculateDiscount(coupon, subtotalAmount);
    }

    const totalAmount = Math.max(subtotalAmount - discountAmount, 0);

    const order = await Order.create({
      user: req.user._id,
      items: orderItems,
      totalAmount,
      subtotalAmount,
      discountAmount,
      couponCode: normalizedCouponCode,
      paymentMethod,
      transactionRef,
    });

    if (coupon) {
      coupon.usedCount = Number(coupon.usedCount || 0) + 1;
      await coupon.save();
    }

    for (const item of orderItems) {
      await Product.findByIdAndUpdate(item.product, { $inc: { quantity: -item.quantity } });
    }

    cart.items = [];
    await cart.save();

    return res.status(201).json({
      message: discountAmount > 0 ? 'Order placed with coupon applied' : 'Order placed successfully',
      order,
    });
  } catch (error) {
    next(error);
  }
};

const getMyOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
    return res.json({ items: orders });
  } catch (error) {
    next(error);
  }
};

const getAllOrders = async (_req, res, next) => {
  try {
    const orders = await Order.find({})
      .populate('user', 'email role')
      .sort({ createdAt: -1 });
    return res.json({ items: orders });
  } catch (error) {
    next(error);
  }
};

const updateOrderStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const order = await Order.findByIdAndUpdate(
      id,
      { status },
      { new: true, runValidators: true }
    ).populate('user', 'email role');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    return res.json(order);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  checkout,
  getMyOrders,
  getAllOrders,
  updateOrderStatus,
};
