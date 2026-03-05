const env = require('../config/env');

const friendlyUploadMessage = 'Please upload a clear full-body photo.';
const friendlyProcessMessage = 'Unable to process image. Please try another photo.';

const forwardMultipartToFlask = async ({ req, res, flaskPath, requiredFields }) => {
  try {
    if (!req.files) {
      return res.status(400).json({ error: friendlyUploadMessage });
    }

    for (const fieldName of requiredFields) {
      if (!req.files[fieldName] || req.files[fieldName].length === 0) {
        return res.status(400).json({ error: friendlyUploadMessage });
      }
    }

    const formData = new FormData();

    for (const fieldName of Object.keys(req.files)) {
      const uploadedItems = req.files[fieldName] || [];
      for (const uploadedFile of uploadedItems) {
        const blob = new Blob([uploadedFile.buffer], {
          type: uploadedFile.mimetype || 'application/octet-stream',
        });
        formData.append(fieldName, blob, uploadedFile.originalname || `${fieldName}.bin`);
      }
    }

    for (const [key, value] of Object.entries(req.body || {})) {
      if (value !== undefined && value !== null) {
        formData.append(key, String(value));
      }
    }

    const controller = new AbortController();
    const timeoutMs = 180000;
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    const targetUrl = `${env.FLASK_AI_URL}${flaskPath}`;
    const flaskResponse = await fetch(targetUrl, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutHandle);

    const contentType = flaskResponse.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const jsonPayload = await flaskResponse.json();
      if (!flaskResponse.ok) {
        return res.status(flaskResponse.status).json({
          error: jsonPayload?.error || friendlyProcessMessage,
        });
      }
      return res.status(flaskResponse.status).json(jsonPayload);
    }

    const textPayload = await flaskResponse.text();
    if (!flaskResponse.ok) {
      return res.status(flaskResponse.status).json({ error: textPayload || friendlyProcessMessage });
    }
    return res.status(flaskResponse.status).send(textPayload);
  } catch (error) {
    if (error.name === 'AbortError') {
      return res.status(504).json({ error: friendlyProcessMessage });
    }
    return res.status(502).json({
      error: friendlyProcessMessage,
      details: error.message,
    });
  }
};

const toNumericOrNull = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const normalizePredictSizePayload = (payload = {}) => {
  const rawMeasurements = payload.measurements || {};

  const normalizedMeasurements = {
    height_cm: toNumericOrNull(rawMeasurements.height_cm ?? rawMeasurements.estimated_height_cm),
    chest_cm: toNumericOrNull(rawMeasurements.chest_cm ?? rawMeasurements.chest_width_cm),
    waist_cm: toNumericOrNull(rawMeasurements.waist_cm ?? rawMeasurements.waist_width_cm),
    hip_cm: toNumericOrNull(rawMeasurements.hip_cm ?? rawMeasurements.hip_width_cm),
  };

  return {
    ...payload,
    estimated_size: payload.estimated_size || payload.recommended_size || 'N/A',
    recommended_size: payload.recommended_size || payload.estimated_size || 'N/A',
    measurements: normalizedMeasurements,
  };
};

const postFormToFlask = async ({ flaskPath, formData, timeoutMs = 180000 }) => {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${env.FLASK_AI_URL}${flaskPath}`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    const contentType = response.headers.get('content-type') || '';
    let payload = null;
    if (contentType.includes('application/json')) {
      payload = await response.json();
    } else {
      payload = await response.text();
    }

    return { response, payload, contentType };
  } finally {
    clearTimeout(timeoutHandle);
  }
};

const predictSize = async (req, res) => {
  try {
    if (!req.files || !req.files.file || req.files.file.length === 0) {
      return res.status(400).json({ error: friendlyUploadMessage });
    }

    const formData = new FormData();
    const uploadedFile = req.files.file[0];
    const blob = new Blob([uploadedFile.buffer], {
      type: uploadedFile.mimetype || 'application/octet-stream',
    });
    formData.append('file', blob, uploadedFile.originalname || 'avatar.jpg');

    const controller = new AbortController();
    const timeoutMs = 180000;
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    const flaskResponse = await fetch(`${env.FLASK_AI_URL}/predict_size`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutHandle);

    const contentType = flaskResponse.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return res.status(502).json({ error: friendlyProcessMessage });
    }

    const payload = await flaskResponse.json();
    if (!flaskResponse.ok) {
      return res.status(flaskResponse.status).json({
        error: payload?.error || friendlyProcessMessage,
      });
    }

    return res.status(200).json(normalizePredictSizePayload(payload || {}));
  } catch (error) {
    if (error.name === 'AbortError') {
      return res.status(504).json({ error: friendlyProcessMessage });
    }
    return res.status(502).json({
      error: friendlyProcessMessage,
      details: error.message,
    });
  }
};

const tryOn = async (req, res) => {
  try {
    if (!req.files) {
      return res.status(400).json({ success: false, error: friendlyUploadMessage });
    }

    const clothingFile = req.files.clothing_image?.[0];
    const avatarFile = req.files.avatar_image?.[0];

    if (!clothingFile || !avatarFile) {
      return res.status(400).json({ success: false, error: friendlyUploadMessage });
    }

    const tryOnForm = new FormData();
    tryOnForm.append(
      'clothing_image',
      new Blob([clothingFile.buffer], { type: clothingFile.mimetype || 'application/octet-stream' }),
      clothingFile.originalname || 'clothing.jpg'
    );
    tryOnForm.append(
      'avatar_image',
      new Blob([avatarFile.buffer], { type: avatarFile.mimetype || 'application/octet-stream' }),
      avatarFile.originalname || 'avatar.jpg'
    );

    const { response: tryOnResponse, payload: tryOnPayload, contentType: tryOnContentType } =
      await postFormToFlask({ flaskPath: '/upload', formData: tryOnForm });

    if (!tryOnResponse.ok) {
      const errorText =
        typeof tryOnPayload === 'object'
          ? tryOnPayload?.error || friendlyProcessMessage
          : String(tryOnPayload || friendlyProcessMessage);
      return res.status(tryOnResponse.status).json({ success: false, error: errorText });
    }

    if (!tryOnContentType.includes('application/json') || typeof tryOnPayload !== 'object') {
      return res.status(502).json({ success: false, error: 'Invalid try-on response from AI service.' });
    }

    const imagePath = tryOnPayload.image_url;
    if (!imagePath) {
      return res.status(502).json({ success: false, error: 'No result image returned by AI service.' });
    }

    const predictForm = new FormData();
    predictForm.append(
      'file',
      new Blob([avatarFile.buffer], { type: avatarFile.mimetype || 'application/octet-stream' }),
      avatarFile.originalname || 'avatar.jpg'
    );

    let normalizedPrediction = {
      estimated_size: 'N/A',
      recommended_size: 'N/A',
      measurements: {
        height_cm: null,
        chest_cm: null,
        waist_cm: null,
        hip_cm: null,
      },
    };

    try {
      const { response: predictResponse, payload: predictPayload, contentType: predictContentType } =
        await postFormToFlask({ flaskPath: '/predict_size', formData: predictForm });

      if (predictResponse.ok && predictContentType.includes('application/json') && typeof predictPayload === 'object') {
        normalizedPrediction = normalizePredictSizePayload(predictPayload || {});
      }
    } catch {
      // keep default fallback prediction values
    }

    return res.status(200).json({
      success: true,
      result_image: imagePath,
      height: normalizedPrediction.measurements?.height_cm ?? null,
      chest: normalizedPrediction.measurements?.chest_cm ?? null,
      waist: normalizedPrediction.measurements?.waist_cm ?? null,
      hip: normalizedPrediction.measurements?.hip_cm ?? null,
      recommended_size: normalizedPrediction.recommended_size || normalizedPrediction.estimated_size || 'N/A',
      measurements: normalizedPrediction.measurements,
      estimated_size: normalizedPrediction.estimated_size || normalizedPrediction.recommended_size || 'N/A',
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      return res.status(504).json({ success: false, error: friendlyProcessMessage });
    }
    return res.status(502).json({
      success: false,
      error: friendlyProcessMessage,
      details: error.message,
    });
  }
};

module.exports = {
  predictSize,
  tryOn,
};
