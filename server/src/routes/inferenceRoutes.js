const express = require('express');
const multer = require('multer');
const { predictSize, tryOn } = require('../controllers/inferenceController');
const { verifyToken } = require('../middlewares/auth');

const router = express.Router();
const allowedMimeTypes = new Set(['image/jpeg', 'image/jpg', 'image/png']);

const upload = multer({
	storage: multer.memoryStorage(),
	limits: {
		fileSize: 5 * 1024 * 1024,
	},
	fileFilter: (_req, file, cb) => {
		if (!allowedMimeTypes.has(file.mimetype)) {
			const error = new Error('Only jpg, jpeg, and png image files are allowed');
			error.statusCode = 400;
			return cb(error);
		}
		return cb(null, true);
	},
});

router.use(verifyToken);

router.post('/predict-size', upload.fields([{ name: 'file', maxCount: 1 }]), predictSize);
router.post(
	'/try-on',
	upload.fields([
		{ name: 'clothing_image', maxCount: 1 },
		{ name: 'avatar_image', maxCount: 1 },
	]),
	tryOn,
);

module.exports = router;
