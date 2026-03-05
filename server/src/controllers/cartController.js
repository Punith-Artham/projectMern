const Cart = require('../models/Cart');
const Product = require('../models/Product');

const serializeCart = (cart) => {
  const items = (cart?.items || []).map((item) => {
    const unitPrice = Number(item.product?.price || 0);
    const quantity = Number(item.quantity || 0);
    return {
      _id: item._id,
      size: item.size,
      quantity,
      product: item.product,
      subtotal: unitPrice * quantity,
    };
  });

  const totalAmount = items.reduce((sum, item) => sum + item.subtotal, 0);

  return {
    _id: cart?._id,
    user: cart?.user,
    items,
    totalAmount,
  };
};

const getOrCreateCart = async (userId) => {
  let cart = await Cart.findOne({ user: userId }).populate('items.product');
  if (!cart) {
    cart = await Cart.create({ user: userId, items: [] });
    cart = await Cart.findById(cart._id).populate('items.product');
  }
  return cart;
};

const getCart = async (req, res, next) => {
  try {
    const cart = await getOrCreateCart(req.user._id);
    return res.json(serializeCart(cart));
  } catch (error) {
    next(error);
  }
};

const addCartItem = async (req, res, next) => {
  try {
    const { productId, size, quantity = 1 } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    if (!product.sizes.includes(size)) {
      return res.status(400).json({ message: 'Invalid size for product' });
    }

    const cart = await getOrCreateCart(req.user._id);
    const qtyToAdd = Math.max(Number(quantity) || 1, 1);

    const existing = cart.items.find(
      (item) => item.product._id.toString() === productId && item.size === size
    );

    const existingQty = Number(existing?.quantity || 0);
    if (existingQty + qtyToAdd > Number(product.quantity || 0)) {
      return res.status(400).json({
        message: `Only ${Number(product.quantity || 0)} item(s) available in stock`,
      });
    }

    if (existing) {
      existing.quantity += qtyToAdd;
    } else {
      cart.items.push({
        product: product._id,
        size,
        quantity: qtyToAdd,
      });
    }

    await cart.save();
    const updatedCart = await Cart.findById(cart._id).populate('items.product');
    return res.status(201).json(serializeCart(updatedCart));
  } catch (error) {
    next(error);
  }
};

const updateCartItem = async (req, res, next) => {
  try {
    const { action, quantity } = req.body;
    const { itemId } = req.params;

    const cart = await getOrCreateCart(req.user._id);
    const item = cart.items.id(itemId);

    if (!item) {
      return res.status(404).json({ message: 'Cart item not found' });
    }

    if (action === 'inc') {
      const product = await Product.findById(item.product._id);
      const stock = Number(product?.quantity || 0);
      if (item.quantity + 1 > stock) {
        return res.status(400).json({ message: `Only ${stock} item(s) available in stock` });
      }
      item.quantity += 1;
    } else if (action === 'dec') {
      item.quantity -= 1;
    } else if (quantity !== undefined) {
      const product = await Product.findById(item.product._id);
      const stock = Number(product?.quantity || 0);
      const requestedQty = Math.max(Number(quantity) || 1, 1);
      if (requestedQty > stock) {
        return res.status(400).json({ message: `Only ${stock} item(s) available in stock` });
      }
      item.quantity = requestedQty;
    } else {
      return res.status(400).json({ message: 'Invalid update payload' });
    }

    if (item.quantity <= 0) {
      item.deleteOne();
    }

    await cart.save();
    const updatedCart = await Cart.findById(cart._id).populate('items.product');
    return res.json(serializeCart(updatedCart));
  } catch (error) {
    next(error);
  }
};

const removeCartItem = async (req, res, next) => {
  try {
    const { itemId } = req.params;
    const cart = await getOrCreateCart(req.user._id);

    const item = cart.items.id(itemId);
    if (!item) {
      return res.status(404).json({ message: 'Cart item not found' });
    }

    item.deleteOne();
    await cart.save();

    const updatedCart = await Cart.findById(cart._id).populate('items.product');
    return res.json(serializeCart(updatedCart));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCart,
  addCartItem,
  updateCartItem,
  removeCartItem,
};
