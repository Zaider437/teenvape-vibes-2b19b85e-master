import imageCompression from "browser-image-compression";

export async function compressImageFile(file: File): Promise<File> {
  try {
    const compressedBlob = await imageCompression(file, {
      maxSizeMB: 1.5,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
    });
    return new File([compressedBlob], file.name, { type: compressedBlob.type });
  } catch {
    return file;
  }
}
