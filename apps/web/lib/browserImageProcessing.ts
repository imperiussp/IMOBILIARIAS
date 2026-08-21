async function canvasBlob(file: File, maxWidth: number, quality: number) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / bitmap.width);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Não foi possível preparar a imagem.");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) throw new Error("Não foi possível comprimir a imagem.");
  return blob;
}

export async function prepareBrowserPropertyPhoto(file: File) {
  const [full, thumbnail] = await Promise.all([
    canvasBlob(file, 1800, 0.82),
    canvasBlob(file, 520, 0.7),
  ]);
  return { full, thumbnail };
}
