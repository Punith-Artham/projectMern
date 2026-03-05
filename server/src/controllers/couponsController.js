const Coupon = require('../models/Coupon');

const normalizeCode = (code = '') => String(code).trim().toUpperCase();

const calculateDiscount = (coupon, subtotal) => {
  if (coupon.type === 'percent') {
    const rawDiscount = (subtotal * Number(coupon.value || 0)) / 100;
    if (coupon.maxDiscountAmount != null) {
      return Math.min(rawDiscount, Number(coupon.maxDiscountAmount || 0));
    }
    return rawDiscount;
  }

  return Math.min(Number(coupon.value || 0), subtotal);
};

const ensureCouponIsValid = (coupon, subtotal) => {
  if (!coupon || !coupon.isActive) {
    return { valid: false, message: 'Coupon is invalid or inactive' };
  }

  if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
    return { valid: false, message: 'Coupon has expired' };
  }

  if (coupon.usageLimit != null && Number(coupon.usedCount || 0) >= Number(coupon.usageLimit)) {
    return { valid: false, message: 'Coupon usage limit reached' };
  }

  if (subtotal < Number(coupon.minOrderAmount || 0)) {
    return {
      valid: false,
      message: `Minimum order amount is ₹${Number(coupon.minOrderAmount || 0)}`,
    };
  }

  return { valid: true };
};

const createCoupon = async (req, res, next) => {
  try {
    const {
      code,
      type,
      value,
      minOrderAmount = 0,
      maxDiscountAmount = null,
      usageLimit = null,
      expiresAt = null,
    } = req.body;

    const normalizedCode = normalizeCode(code);

    const exists = await Coupon.findOne({ code: normalizedCode });
    if (exists) {
      return res.status(409).json({ message: 'Coupon code already exists' });
    }

    const coupon = await Coupon.create({
      code: normalizedCode,
      type,
      value: Number(value),
      minOrderAmount: Number(minOrderAmount || 0),
      maxDiscountAmount: maxDiscountAmount == null || maxDiscountAmount === ''
        ? null
        : Number(maxDiscountAmount),
      usageLimit: usageLimit == null || usageLimit === '' ? null : Number(usageLimit),
      expiresAt: expiresAt || null,
      createdBy: req.user._id,
    });

    return res.status(201).json(coupon);
  } catch (error) {
    next(error);
  }
};

const listCoupons = async (_req, res, next) => {
  try {
    const items = await Coupon.find({}).sort({ createdAt: -1 });
    return res.json({ items });
  } catch (error) {
    next(error);
  }
};

const validateCoupon = async (req, res, next) => {
  try {
    const { code, subtotal } = req.body;
    const normalizedCode = normalizeCode(code);

    const coupon = await Coupon.findOne({ code: normalizedCode });
    const amount = Number(subtotal || 0);

    const validation = ensureCouponIsValid(coupon, amount);
    if (!validation.valid) {
      return res.status(400).json({ message: validation.message });
    }

    const discountAmount = calculateDiscount(coupon, amount);
    const finalAmount = Math.max(amount - discountAmount, 0);

    return res.json({
      code: coupon.code,
      discountAmount,
      finalAmount,
      type: coupon.type,
      value: coupon.value,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createCoupon,
  listCoupons,
  validateCoupon,
  normalizeCode,
  calculateDiscount,
  ensureCouponIsValid,
};
