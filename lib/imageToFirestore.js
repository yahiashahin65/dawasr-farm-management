const MAX_FIRESTORE_IMAGE_BYTES = 750 * 1024;
const MAX_IMAGE_DIMENSION = 1200;
const DEFAULT_IMAGE_QUALITY = 0.72;

const getTextByteSize = (value) => new Blob([value]).size;

const loadImage = (file) => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("فشل قراءة الصورة"));
    };

    image.src = url;
  });
};

export const fileToFirestoreImage = async (file) => {
  if (!file) return "";

  if (!file.type || !file.type.startsWith("image/")) {
    throw new Error("الملف المختار يجب أن يكون صورة");
  }

  const image = await loadImage(file);

  const scale = Math.min(
    1,
    MAX_IMAGE_DIMENSION / Math.max(image.width, image.height)
  );

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);

  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  let quality = DEFAULT_IMAGE_QUALITY;
  let dataUrl = canvas.toDataURL("image/jpeg", quality);

  while (getTextByteSize(dataUrl) > MAX_FIRESTORE_IMAGE_BYTES && quality > 0.35) {
    quality -= 0.08;
    dataUrl = canvas.toDataURL("image/jpeg", quality);
  }

  if (getTextByteSize(dataUrl) > MAX_FIRESTORE_IMAGE_BYTES) {
    throw new Error("الصورة كبيرة جدًا. من فضلك اختر صورة أصغر.");
  }

  return dataUrl;
};
