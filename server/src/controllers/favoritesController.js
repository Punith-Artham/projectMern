const Favorite = require('../models/Favorite');
const Product = require('../models/Product');

const listFavorites = async (req, res, next) => {
  try {
    const items = await Favorite.find({ user: req.user._id })
      .populate('product')
      .sort({ createdAt: -1 });

    return res.json({
      items: items
        .filter((item) => item.product)
        .map((item) => ({
          _id: item._id,
          product: item.product,
          createdAt: item.createdAt,
        })),
    });
  } catch (error) {
    next(error);
  }
};

const addFavorite = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    await Favorite.findOneAndUpdate(
      { user: req.user._id, product: productId },
      { user: req.user._id, product: productId },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return listFavorites(req, res, next);
  } catch (error) {
    next(error);
  }
};

const removeFavorite = async (req, res, next) => {
  try {
    const { productId } = req.params;
    await Favorite.findOneAndDelete({ user: req.user._id, product: productId });
    return listFavorites(req, res, next);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listFavorites,
  addFavorite,
  removeFavorite,
};