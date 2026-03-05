const Product = require('../models/Product');
const Review = require('../models/Review');

const listProducts = async (req, res, next) => {
  try {
    const {
      gender,
      category,
      search,
      page = 1,
      limit = 12,
    } = req.query;

    const query = {};
    if (gender) query.gender = gender;
    if (category) query.category = category;
    if (search) query.$text = { $search: search };

    const pageNumber = Math.max(Number(page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(limit) || 12, 1), 50);

    const [items, total] = await Promise.all([
      Product.find(query)
        .sort({ createdAt: -1 })
        .skip((pageNumber - 1) * pageSize)
        .limit(pageSize),
      Product.countDocuments(query),
    ]);

    return res.json({
      items,
      pagination: {
        page: pageNumber,
        limit: pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    next(error);
  }
};

const getProductById = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    return res.json(product);
  } catch (error) {
    next(error);
  }
};

const createProduct = async (req, res, next) => {
  try {
    const {
      name,
      brand,
      price,
      image,
      sizes,
      gender,
      category,
      season,
      quantity,
    } = req.body;

    const parsedSizes = Array.isArray(sizes)
      ? sizes
      : String(sizes || '')
          .split(',')
          .map((size) => size.trim())
          .filter(Boolean);

    const product = await Product.create({
      name,
      brand,
      price: Number(price),
      image,
      sizes: parsedSizes.length ? parsedSizes : ['S', 'M', 'L', 'XL'],
      gender,
      category,
      season,
      quantity: Math.max(Number(quantity) || 0, 0),
    });

    return res.status(201).json(product);
  } catch (error) {
    next(error);
  }
};

const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = {};

    if (req.body.name !== undefined) updates.name = req.body.name;
    if (req.body.brand !== undefined) updates.brand = req.body.brand;
    if (req.body.price !== undefined) updates.price = Number(req.body.price);
    if (req.body.image !== undefined) updates.image = req.body.image;
    if (req.body.gender !== undefined) updates.gender = req.body.gender;
    if (req.body.category !== undefined) updates.category = req.body.category;
    if (req.body.season !== undefined) updates.season = req.body.season;
    if (req.body.quantity !== undefined) {
      updates.quantity = Math.max(Number(req.body.quantity) || 0, 0);
    }

    if (req.body.sizes !== undefined) {
      updates.sizes = Array.isArray(req.body.sizes)
        ? req.body.sizes
        : String(req.body.sizes || '')
            .split(',')
            .map((size) => size.trim())
            .filter(Boolean);
    }

    const product = await Product.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    return res.json(product);
  } catch (error) {
    next(error);
  }
};

const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await Product.findByIdAndDelete(id);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    await Review.deleteMany({ product: product._id });

    return res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
};
