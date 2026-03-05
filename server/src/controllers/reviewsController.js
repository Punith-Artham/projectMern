const Product = require('../models/Product');
const Review = require('../models/Review');
const Order = require('../models/Order');

const recalculateProductRating = async (productId) => {
  const aggregate = await Review.aggregate([
    { $match: { product: productId } },
    {
      $group: {
        _id: '$product',
        avgRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 },
      },
    },
  ]);

  const next = aggregate[0] || { avgRating: 0, totalReviews: 0 };

  await Product.findByIdAndUpdate(productId, {
    rating: Number(Number(next.avgRating || 0).toFixed(1)),
    reviews: Number(next.totalReviews || 0),
  });
};

const listProductReviews = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const items = await Review.find({ product: product._id })
      .populate('user', 'email')
      .sort({ createdAt: -1 });

    return res.json({
      items: items.map((review) => ({
        _id: review._id,
        rating: review.rating,
        comment: review.comment,
        verifiedBuyer: review.verifiedBuyer,
        createdAt: review.createdAt,
        user: {
          id: review.user?._id,
          email: review.user?.email || 'User',
        },
      })),
    });
  } catch (error) {
    next(error);
  }
};

const createOrUpdateReview = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const hasPurchased = await Order.exists({
      user: req.user._id,
      status: 'delivered',
      'items.product': product._id,
    });

    if (!hasPurchased) {
      return res.status(403).json({
        message: 'Only delivered buyers can review this product',
      });
    }

    const { rating, comment = '' } = req.body;
    const normalizedRating = Number(rating);

    if (!Number.isFinite(normalizedRating) || normalizedRating < 1 || normalizedRating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    if (Math.round(normalizedRating * 10) !== normalizedRating * 10) {
      return res.status(400).json({ message: 'Rating can have at most 1 decimal place' });
    }

    const review = await Review.findOneAndUpdate(
      { product: product._id, user: req.user._id },
      {
        rating: normalizedRating,
        comment: String(comment || '').trim(),
        verifiedBuyer: true,
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
        runValidators: true,
      }
    );

    await recalculateProductRating(product._id);

    return res.status(201).json({
      _id: review._id,
      rating: review.rating,
      comment: review.comment,
      verifiedBuyer: review.verifiedBuyer,
      createdAt: review.createdAt,
      user: {
        id: req.user._id,
        email: req.user.email,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Review already exists' });
    }
    next(error);
  }
};

module.exports = {
  listProductReviews,
  createOrUpdateReview,
};
