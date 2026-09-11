import "server-only";
import crypto from "node:crypto";

/**
 * Constraints are enforced here, on the signing endpoint — the file input's
 * `accept` is a convenience, not a control. `allowed_formats` goes into the
 * signed parameter set, so Cloudinary rejects anything else even if the
 * browser is tampered with. Photos arrive already resized to JPEG by the
 * browser; PNG and WebP are allowed for completeness.
 */
export const PHOTO_UPLOAD = {
  formats: ["jpg", "jpeg", "png", "webp"],
  mimeTypes: ["image/jpeg", "image/png", "image/webp"],
  maxBytes: 10 * 1024 * 1024,
  ttlSeconds: 10 * 60,
  folder: "diary/photos",
};

/** Cloudinary's signature: signed params sorted by key, joined, secret appended. */
export function signParams(params: Record<string, string>, apiSecret: string): string {
  const payload = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return crypto.createHash("sha1").update(payload + apiSecret).digest("hex");
}

export function cloudinaryConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary environment variables are not set");
  }
  return { cloudName, apiKey, apiSecret };
}
