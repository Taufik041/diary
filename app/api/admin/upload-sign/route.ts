import { requireAdmin } from "@/lib/auth";
import { PHOTO_UPLOAD, cloudinaryConfig, signParams } from "@/lib/cloudinary";
import { errorMessage, readJson } from "@/lib/http";

export const runtime = "nodejs";

type Payload = { contentType?: unknown; size?: unknown };

/** Signs a direct browser → Cloudinary upload. The file never passes through
 *  our functions, and the API secret never leaves this handler. */
export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await readJson<Payload>(request, 10_000);
  if (!body) return Response.json({ error: "bad request" }, { status: 400 });

  const contentType = String(body.contentType ?? "").toLowerCase();
  const size = Number(body.size);

  if (!PHOTO_UPLOAD.mimeTypes.includes(contentType)) {
    return Response.json({ error: `${contentType || "that file type"} is not allowed` }, { status: 400 });
  }
  if (!Number.isFinite(size) || size <= 0 || size > PHOTO_UPLOAD.maxBytes) {
    return Response.json(
      { error: `photo must be under ${Math.round(PHOTO_UPLOAD.maxBytes / 1024 / 1024)}MB` },
      { status: 400 },
    );
  }

  try {
    const { cloudName, apiKey, apiSecret } = cloudinaryConfig();
    const timestamp = Math.floor(Date.now() / 1000);
    const signed = {
      allowed_formats: PHOTO_UPLOAD.formats.join(","),
      folder: PHOTO_UPLOAD.folder,
      timestamp: String(timestamp),
    };

    return Response.json({
      url: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      fields: { ...signed, api_key: apiKey, signature: signParams(signed, apiSecret) },
      expiresAt: (timestamp + PHOTO_UPLOAD.ttlSeconds) * 1000,
    });
  } catch (error) {
    return Response.json({ error: errorMessage(error, "signing failed") }, { status: 500 });
  }
}
