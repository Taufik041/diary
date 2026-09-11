// Browser side of photo upload: shrink first, then a server-signed direct
// upload to Cloudinary. Phone photos are 4–8MB; this sends ~0.5MB.

const MAX_SIDE = 2000;
const QUALITY = 0.85;

type Source = ImageBitmap | HTMLImageElement;

async function decode(file: Blob): Promise<Source> {
  try {
    // Applies EXIF orientation, so portrait phone photos stay upright.
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

/** Longest side capped at 2000px, re-encoded as JPEG. */
export async function resizeImage(file: Blob): Promise<{ blob: Blob; width: number; height: number }> {
  const source = await decode(file);
  const w0 = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
  const h0 = source instanceof HTMLImageElement ? source.naturalHeight : source.height;
  if (!w0 || !h0) throw new Error("that file isn't a photo");

  const k = Math.min(1, MAX_SIDE / Math.max(w0, h0));
  const width = Math.round(w0 * k);
  const height = Math.round(h0 * k);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("couldn't process that photo");
  ctx.fillStyle = "#fff"; // JPEG has no alpha; transparent PNGs go white, not black
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, width, height);
  if ("close" in source) source.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
  if (!blob) throw new Error("couldn't process that photo");
  return { blob, width, height };
}

type SignResponse = { url: string; fields: Record<string, string>; expiresAt: number; error?: string };

/** Signs on the server, then pushes the file straight to Cloudinary. */
export async function uploadPhoto(blob: Blob): Promise<string> {
  const signResponse = await fetch("/api/admin/upload-sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contentType: blob.type, size: blob.size }),
  });
  const signed = (await signResponse.json().catch(() => ({}))) as SignResponse;
  if (!signResponse.ok) throw new Error(signed.error ?? "could not sign upload");
  if (Date.now() > signed.expiresAt) throw new Error("signature expired, try again");

  const form = new FormData();
  for (const [key, value] of Object.entries(signed.fields)) form.append(key, value);
  form.append("file", blob, "photo.jpg");

  const uploadResponse = await fetch(signed.url, { method: "POST", body: form });
  const result = (await uploadResponse.json().catch(() => ({}))) as {
    secure_url?: string;
    error?: { message?: string };
  };
  if (!uploadResponse.ok || !result.secure_url) {
    throw new Error(result.error?.message ?? "upload failed");
  }
  return result.secure_url;
}

/** Warm the browser cache so swapping the preview for the real URL doesn't flash. */
export async function preload(src: string): Promise<void> {
  const img = new Image();
  img.src = src;
  await img.decode().catch(() => {});
}
