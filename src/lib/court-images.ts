import "server-only";

import { del, put } from "@vercel/blob";

/**
 * Court photos, stored in Vercel Blob.
 *
 * The app's own filesystem is read-only on Vercel, so uploads have to live elsewhere.
 * Blob gives each file a public URL, and that URL is what goes into `Court.imageUrl` —
 * the rest of the app keeps treating the column as a plain link and never needs to know
 * where the bytes are.
 *
 * Needs BLOB_READ_WRITE_TOKEN, which Vercel injects once a Blob store is connected to the
 * project. Locally, copy it into .env.local.
 */

/** Upper bound for one photo. Keep below `serverActions.bodySizeLimit` in next.config.ts. */
export const MAX_COURT_IMAGE_BYTES = 4 * 1024 * 1024;

/** Mirrored by the file picker's `accept` in CourtForm, which cannot import this module. */
type CourtImageType = "image/jpeg" | "image/png" | "image/webp";

const EXTENSION: Record<CourtImageType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Hostname suffix of public Blob URLs. Also listed in next.config.ts for next/image. */
const BLOB_HOST_SUFFIX = ".public.blob.vercel-storage.com";

export class CourtImageError extends Error {}

/** A file input submitted empty arrives as a zero-byte File named "", not as null. */
export function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return value instanceof File && value.size > 0;
}

/**
 * Work out the real image type from the file's first bytes.
 *
 * `File.type` comes from the browser — or from whoever crafted the request — so it is
 * only a claim. Checking the magic numbers means a renamed HTML or SVG file cannot end up
 * served as a "photo".
 */
function sniffImageType(bytes: Uint8Array): CourtImageType | null {
  const startsWith = (signature: number[], offset = 0) =>
    signature.every((byte, index) => bytes[offset + index] === byte);

  if (startsWith([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  // RIFF....WEBP
  if (startsWith([0x52, 0x49, 0x46, 0x46]) && startsWith([0x57, 0x45, 0x42, 0x50], 8)) {
    return "image/webp";
  }
  return null;
}

/** Validate and store a court photo. Returns its public URL. */
export async function uploadCourtImage(file: File): Promise<string> {
  if (file.size > MAX_COURT_IMAGE_BYTES) {
    throw new CourtImageError("Снимката е твърде голяма — максимум 4 MB.");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const type = sniffImageType(bytes);
  if (!type) {
    throw new CourtImageError("Позволени са само JPG, PNG и WebP снимки.");
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new CourtImageError(
      "Качването на снимки не е настроено (липсва BLOB_READ_WRITE_TOKEN).",
    );
  }

  try {
    // The random suffix makes every upload a new URL, so a replaced photo is never
    // served stale from a CDN or next/image cache that still holds the old one.
    const blob = await put(`courts/court.${EXTENSION[type]}`, bytes, {
      access: "public",
      contentType: type,
      addRandomSuffix: true,
    });
    return blob.url;
  } catch (error) {
    console.error("[court-images] upload failed", error);
    throw new CourtImageError("Снимката не можа да бъде качена. Опитай отново.");
  }
}

/** True for URLs this module created, as opposed to bundled ones like /images/court.jpg. */
export function isBlobUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    return new URL(url).hostname.endsWith(BLOB_HOST_SUFFIX);
  } catch {
    return false;
  }
}

/**
 * Delete a photo that is no longer referenced.
 *
 * Best effort: the court has already been saved by the time this runs, so a failure only
 * leaves an orphaned file behind and must not be reported to the admin as a failed save.
 */
export async function deleteCourtImage(url: string | null | undefined): Promise<void> {
  if (!isBlobUrl(url)) return;
  try {
    await del(url);
  } catch (error) {
    console.error("[court-images] delete failed", url, error);
  }
}
