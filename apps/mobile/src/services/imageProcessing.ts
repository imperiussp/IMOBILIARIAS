import * as ImageManipulator from "expo-image-manipulator";

async function renderJpeg(uri: string, width: number, compress: number) {
  const context = ImageManipulator.ImageManipulator.manipulate(uri);
  context.resize({ width, height: null });
  const rendered = await context.renderAsync();
  return rendered.saveAsync({ format: ImageManipulator.SaveFormat.JPEG, compress });
}

export async function preparePropertyPhoto(uri: string) {
  const [full, thumb] = await Promise.all([
    renderJpeg(uri, 1800, 0.8),
    renderJpeg(uri, 520, 0.68),
  ]);
  return { fullUri: full.uri, thumbnailUri: thumb.uri };
}
