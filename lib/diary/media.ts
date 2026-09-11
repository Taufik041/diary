const CLOUDINARY_UPLOAD = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/;

// Stored src is the original Cloudinary URL; what's displayed asks
// Cloudinary for a size-capped, auto-format, auto-quality derivative.
// 1600px covers the largest photo on a desktop spread at 2× DPR.
export function displaySrc(src: string, width = 1600): string {
  const m = CLOUDINARY_UPLOAD.exec(src);
  return m ? `${m[1]}f_auto,q_auto,c_limit,w_${width}/${m[2]}` : src;
}
