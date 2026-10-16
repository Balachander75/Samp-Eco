const MAX_REFERENCE_IMAGE_BYTES = 1_048_576;
const MAX_RAW_REFERENCE_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_REFERENCE_IMAGE_DIMENSION = 1600;
const MIN_REFERENCE_IMAGE_DIMENSION = 320;
const IMAGE_QUALITY = 0.7;

function loadImage(file: File): Promise<{ image: HTMLImageElement; objectUrl: string }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => resolve({ image, objectUrl });
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("The selected image could not be opened."));
    };
    image.src = objectUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string"
      ? resolve(reader.result)
      : reject(new Error("The compressed image could not be prepared."));
    reader.onerror = () => reject(new Error("The compressed image could not be prepared."));
    reader.readAsDataURL(blob);
  });
}

/** Compress an uploaded reference to WebP at 70% quality and keep it database-safe. */
export async function compressReferenceImage(file: File): Promise<{ url: string; sizeKb: number }> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose an image file to upload.");
  }
  if (file.size > MAX_RAW_REFERENCE_IMAGE_BYTES) {
    throw new Error("Choose an image smaller than 15 MB.");
  }

  const { image, objectUrl } = await loadImage(file);
  try {
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    if (!sourceWidth || !sourceHeight) throw new Error("The selected image has invalid dimensions.");

    const sourceMaxDimension = Math.max(sourceWidth, sourceHeight);
    let maxDimension = Math.min(sourceMaxDimension, MAX_REFERENCE_IMAGE_DIMENSION);
    let bestBlob: Blob | null = null;

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const scale = Math.min(1, maxDimension / sourceMaxDimension);
      const width = Math.max(1, Math.round(sourceWidth * scale));
      const height = Math.max(1, Math.round(sourceHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Image compression is unavailable in this browser.");
      context.drawImage(image, 0, 0, width, height);

      const compressed = await canvasToBlob(canvas, "image/webp", IMAGE_QUALITY);
      if (!compressed) throw new Error("The selected image could not be compressed.");
      bestBlob = compressed;

      if (compressed.size <= MAX_REFERENCE_IMAGE_BYTES || maxDimension <= MIN_REFERENCE_IMAGE_DIMENSION) break;
      const targetScale = Math.sqrt(MAX_REFERENCE_IMAGE_BYTES / compressed.size) * 0.94;
      maxDimension = Math.max(
        MIN_REFERENCE_IMAGE_DIMENSION,
        Math.min(maxDimension - 1, Math.floor(maxDimension * targetScale)),
      );
    }

    if (!bestBlob || bestBlob.size > MAX_REFERENCE_IMAGE_BYTES) {
      throw new Error("This image is still over 1 MB after compression. Try a smaller image.");
    }

    return {
      url: await blobToDataUrl(bestBlob),
      sizeKb: Math.max(1, Math.ceil(bestBlob.size / 1024)),
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
