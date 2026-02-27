/**
 * Image Preprocessing Utilities
 * 
 * These functions improve OCR accuracy by preprocessing images before recognition.
 */

/**
 * Convert image file to HTMLImageElement
 */
export const loadImage = (file) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = reject;
    img.src = url;
  });
};

/**
 * Convert canvas to blob
 */
export const canvasToBlob = (canvas, type = 'image/png') => {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Failed to convert canvas to blob'));
      }
    }, type);
  });
};

/**
 * Convert canvas to File
 */
export const canvasToFile = async (
  canvas,
  filename = 'processed-image.png',
  type = 'image/png'
) => {
  const blob = await canvasToBlob(canvas, type);
  return new File([blob], filename, { type });
};

/**
 * 1. Grayscale Conversion
 */
export const convertToGrayscale = async (file) => {
  const img = await loadImage(file);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  canvas.width = img.width;
  canvas.height = img.height;

  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    data[i] = gray;     // Red
    data[i + 1] = gray; // Green
    data[i + 2] = gray; // Blue
  }

  ctx.putImageData(imageData, 0, 0);
  return canvasToFile(canvas, file.name);
};

/**
 * 2. Contrast Enhancement
 */
export const enhanceContrast = async (file, factor = 1.5) => {
  const img = await loadImage(file);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  canvas.width = img.width;
  canvas.height = img.height;

  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  const factorAdjusted = (259 * (factor + 255)) / (255 * (259 - factor));

  for (let i = 0; i < data.length; i += 4) {
    data[i] = factorAdjusted * (data[i] - 128) + 128;       // Red
    data[i + 1] = factorAdjusted * (data[i + 1] - 128) + 128; // Green
    data[i + 2] = factorAdjusted * (data[i + 2] - 128) + 128; // Blue
  }

  ctx.putImageData(imageData, 0, 0);
  return canvasToFile(canvas, file.name);
};

/**
 * 3. Brightness Adjustment
 */
export const adjustBrightness = async (file, amount = 20) => {
  const img = await loadImage(file);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  canvas.width = img.width;
  canvas.height = img.height;

  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    data[i] += amount;     // Red
    data[i + 1] += amount; // Green
    data[i + 2] += amount; // Blue
  }

  ctx.putImageData(imageData, 0, 0);
  return canvasToFile(canvas, file.name);
};

/**
 * 4. Sharpening
 */
export const sharpenImage = async (file) => {
  const img = await loadImage(file);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  canvas.width = img.width;
  canvas.height = img.height;

  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const width = canvas.width;
  const height = canvas.height;

  const kernel = [
    0, -1, 0,
    -1, 5, -1,
    0, -1, 0
  ];

  const output = ctx.createImageData(width, height);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const pixelIndex = ((y + ky) * width + (x + kx)) * 4 + c;
            const kernelIndex = (ky + 1) * 3 + (kx + 1);
            sum += data[pixelIndex] * kernel[kernelIndex];
          }
        }
        output.data[(y * width + x) * 4 + c] = Math.min(255, Math.max(0, sum));
      }
      output.data[(y * width + x) * 4 + 3] = 255; // Alpha
    }
  }

  ctx.putImageData(output, 0, 0);
  return canvasToFile(canvas, file.name);
};

/**
 * 5. Binarization (Otsu's Method)
 */
export const binarize = async (file) => {
  const img = await loadImage(file);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  canvas.width = img.width;
  canvas.height = img.height;

  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
  }

  const histogram = new Array(256).fill(0);
  for (let i = 0; i < data.length; i += 4) {
    histogram[data[i]]++;
  }

  const total = canvas.width * canvas.height;
  let sum = 0;
  for (let i = 0; i < 256; i++) {
    sum += i * histogram[i];
  }

  let sumB = 0;
  let wB = 0;
  let wF = 0;
  let maxVariance = 0;
  let threshold = 0;

  for (let t = 0; t < 256; t++) {
    wB += histogram[t];
    if (wB === 0) continue;

    wF = total - wB;
    if (wF === 0) break;

    sumB += t * histogram[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;

    const variance = wB * wF * (mB - mF) * (mB - mF);

    if (variance > maxVariance) {
      maxVariance = variance;
      threshold = t;
    }
  }

  for (let i = 0; i < data.length; i += 4) {
    const value = data[i] > threshold ? 255 : 0;
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvasToFile(canvas, file.name);
};

/**
 * 6. Noise Reduction (Median Filter)
 */
export const reduceNoise = async (file) => {
  const img = await loadImage(file);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  canvas.width = img.width;
  canvas.height = img.height;

  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const width = canvas.width;
  const height = canvas.height;

  const output = ctx.createImageData(width, height);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let c = 0; c < 3; c++) {
        const neighbors = [];
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            neighbors.push(data[((y + ky) * width + (x + kx)) * 4 + c]);
          }
        }
        neighbors.sort((a, b) => a - b);
        output.data[(y * width + x) * 4 + c] = neighbors[4]; // Median
      }
      output.data[(y * width + x) * 4 + 3] = 255; // Alpha
    }
  }

  ctx.putImageData(output, 0, 0);
  return canvasToFile(canvas, file.name);
};

/**
 * 7. Upscaling
 */
export const upscaleImage = async (file, scale = 2) => {
  const img = await loadImage(file);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  canvas.width = img.width * scale;
  canvas.height = img.height * scale;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvasToFile(canvas, file.name);
};

/**
 * 8. COMPREHENSIVE Preprocessing Pipeline
 */
export const preprocessForOCR = async (file, options = {}) => {
  const {
    grayscale: shouldGrayscale = true,
    contrast: contrastValue = 1.3,
    brightness: brightnessValue = 10,
    sharpen: shouldSharpen = true,
    binarize: shouldBinarize = true,
    denoise: shouldDenoise = false,
    upscale: upscaleValue = 1,
  } = options;

  let processed = file;

  if (upscaleValue > 1) {
    processed = await upscaleImage(processed, upscaleValue);
  }

  if (shouldDenoise) {
    processed = await reduceNoise(processed);
  }

  if (shouldGrayscale) {
    processed = await convertToGrayscale(processed);
  }

  if (brightnessValue !== 0) {
    processed = await adjustBrightness(processed, brightnessValue);
  }

  if (contrastValue !== 1) {
    processed = await enhanceContrast(processed, contrastValue);
  }

  if (shouldSharpen) {
    processed = await sharpenImage(processed);
  }

  if (shouldBinarize) {
    processed = await binarize(processed);
  }

  return processed;
};

/**
 * Auto-detect and apply best preprocessing
 */
export const autoPreprocess = async (file) => {
  const img = await loadImage(file);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  canvas.width = img.width;
  canvas.height = img.height;
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  let totalBrightness = 0;
  for (let i = 0; i < data.length; i += 4) {
    const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
    totalBrightness += brightness;
  }
  const avgBrightness = totalBrightness / (data.length / 4);

  const options = {
    grayscale: true,
    sharpen: true,
    binarize: true,
  };

  if (avgBrightness < 100) {
    options.brightness = 30;
    options.contrast = 1.5;
  }
  else if (avgBrightness > 180) {
    options.brightness = -20;
    options.contrast = 1.3;
  }
  else {
    options.brightness = 0;
    options.contrast = 1.2;
  }

  if (img.width < 800 || img.height < 600) {
    options.upscale = 2;
  }

  return preprocessForOCR(file, options);
};
