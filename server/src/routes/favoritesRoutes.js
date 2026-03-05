const express = require('express');
const { param } = require('express-validator');
const {
  listFavorites,
  addFavorite,
  removeFavorite,
} = require('../controllers/favoritesController');
const { protect } = require('../middlewares/auth');
const { validateRequest } = require('../middlewares/errorHandler');

const router = express.Router();

router.use(protect);

router.get('/', listFavorites);

router.post(
  '/:productId',
  [param('productId').isMongoId().withMessage('Invalid productId'), validateRequest],
  addFavorite
);

router.delete(
  '/:productId',
  [param('productId').isMongoId().withMessage('Invalid productId'), validateRequest],
  removeFavorite
);

module.exports = router;