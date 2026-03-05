const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    brand: { type: String, default: 'StyleHub' },
    price: { type: Number, required: true, min: 0 },
    image: { type: String, required: true },
    sizes: { type: [String], default: ['S', 'M', 'L', 'XL'] },
    rating: { type: Number, default: 4.3 },
    reviews: { type: Number, default: 0 },
    quantity: { type: Number, default: 0, min: 0 },
    gender: { type: String, enum: ['men', 'women'], required: true },
    category: { type: String, required: true },
    season: { type: String, default: 'summer' },
  },
  { timestamps: true }
);

productSchema.index({ gender: 1, category: 1 });
productSchema.index({ name: 'text', brand: 'text' });

module.exports = mongoose.model('Product', productSchema);
