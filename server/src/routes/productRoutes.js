const express = require('express');
const { body } = require('express-validator');
const {
	listProducts,
	getProductById,
	createProduct,
	updateProduct,
	deleteProduct,
} = require('../controllers/productsController');
const {
	listProductReviews,
	createOrUpdateReview,
} = require('../controllers/reviewsController');
const { protect, authorizeRoles } = require('../middlewares/auth');
const { validateRequest } = require('../middlewares/errorHandler');

const router = express.Router();

router.get('/', listProducts);
router.post(
	'/',
	protect,
	authorizeRoles('admin'),
	[
		body('name').notEmpty().withMessage('Name is required'),
		body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
		body('image').notEmpty().withMessage('Image is required'),
		body('gender').isIn(['men', 'women']).withMessage('Gender must be men or women'),
		body('category').notEmpty().withMessage('Category is required'),
		body('quantity').optional().isInt({ min: 0 }).withMessage('Quantity must be 0 or greater'),
		validateRequest,
	],
	createProduct
);

router.patch(
	'/:id',
	protect,
	authorizeRoles('admin'),
	[
		body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a positive number'),
		body('quantity').optional().isInt({ min: 0 }).withMessage('Quantity must be 0 or greater'),
		validateRequest,
	],
	updateProduct
);

router.get('/:id/reviews', listProductReviews);
router.post(
	'/:id/reviews',
	protect,
	[
		body('rating')
			.isFloat({ min: 1, max: 5 })
			.withMessage('Rating must be between 1 and 5')
			.custom((value) => {
				const num = Number(value);
				if (Math.round(num * 10) !== num * 10) {
					throw new Error('Rating can have at most 1 decimal place');
				}
				return true;
			}),
		body('comment').optional().isLength({ max: 1000 }).withMessage('Comment is too long'),
		validateRequest,
	],
	createOrUpdateReview
);

router.delete('/:id', protect, authorizeRoles('admin'), deleteProduct);
router.get('/:id', getProductById);

module.exports = router;
