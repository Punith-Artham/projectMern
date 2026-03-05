require('../src/config/env');
const path = require('path');
const fs = require('fs');
const connectDB = require('../src/config/db');
const Product = require('../src/models/Product');

const normalizeGender = (value) => (value === 'men' ? 'men' : 'women');

const toProduct = (gender, category, item) => ({
  name: item.name,
  brand: item.brand || 'StyleHub',
  price: Number(item.price || 0),
  image: String(item.img || '').replace('./static/assets', '/assets'),
  sizes: item.sizes || ['S', 'M', 'L', 'XL'],
  rating: Number(item.rating || 4.3),
  reviews: Number(item.reviews || 0),
  quantity: Math.max(Number(item.quantity || 20), 0),
  gender: normalizeGender(gender),
  category,
  season: item.collection || 'summer',
});

const titleFromFilename = (name) =>
  String(name || '')
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());

const generateFromStatic = ({ gender, category, relativeFolder, basePrice }) => {
  const absoluteFolder = path.resolve(__dirname, `../../static/assets/${relativeFolder}`);
  if (!fs.existsSync(absoluteFolder)) {
    return [];
  }

  const files = fs
    .readdirSync(absoluteFolder)
    .filter((name) => /\.(png|jpe?g)$/i.test(name))
    .sort();

  return files.map((file, index) =>
    toProduct(gender, category, {
      name: titleFromFilename(file),
      brand: 'StyleHub',
      price: basePrice + index * 120,
      img: `/assets/${relativeFolder}/${file}`,
      sizes: ['S', 'M', 'L', 'XL'],
      rating: 4.2 + (index % 6) * 0.1,
      reviews: 10 + index * 2,
      collection: index % 2 === 0 ? 'summer' : 'winter',
    })
  );
};

const run = async () => {
  const datasetPath = path.resolve(__dirname, '../../dataset.json');
  const raw = fs.readFileSync(datasetPath, 'utf-8');
  const data = JSON.parse(raw);

  const products = [];
  for (const gender of ['men', 'women']) {
    const categories = data[gender] || {};
    for (const [category, list] of Object.entries(categories)) {
      for (const item of list) {
        products.push(toProduct(gender, category, item));
      }
    }
  }

  const staticFallbacks = [
    { gender: 'men', category: 'tshirt', relativeFolder: 'mens/tshirts', basePrice: 899 },
    { gender: 'men', category: 'shirts', relativeFolder: 'mens/shirts', basePrice: 1199 },
    { gender: 'men', category: 'jackets', relativeFolder: 'mens/jackets', basePrice: 1899 },
    { gender: 'women', category: 'tops', relativeFolder: 'women/tops', basePrice: 999 },
    { gender: 'women', category: 'jackets', relativeFolder: 'women/jackets', basePrice: 1899 },
    { gender: 'women', category: 'dresses', relativeFolder: 'women/casuals', basePrice: 1299 },
  ];

  for (const fallback of staticFallbacks) {
    const exists = products.some(
      (item) => item.gender === fallback.gender && item.category === fallback.category
    );
    if (!exists) {
      products.push(...generateFromStatic(fallback));
    }
  }

  const extraProducts = products
    .filter((item) => ['tshirt', 'shirts', 'jackets', 'tops', 'dresses'].includes(item.category))
    .slice(0, 20)
    .map((item, index) => ({
      ...item,
      name: `${item.name} Variant ${index + 1}`,
      price: Number(item.price || 999) + 150 + index * 20,
      reviews: Number(item.reviews || 10) + 5,
      quantity: Math.max(Number(item.quantity || 20) + 5, 5),
    }));

  products.push(...extraProducts);

  await connectDB();
  await Product.deleteMany({});
  await Product.insertMany(products);

  console.log(`Seeded ${products.length} products`);
  process.exit(0);
};

run().catch((error) => {
  console.error('Seeding failed:', error.message);
  process.exit(1);
});
