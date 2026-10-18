import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const MEDIA_MIME_TYPES: Record<string, string> = {
  // Images
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".bmp": "image/bmp",
  ".ico": "image/x-icon",
  ".heic": "image/heic",

  // Audio (Crucial: codecs=opus for WhatsApp Voice Notes / PTT)
  ".ogg": "audio/ogg; codecs=opus",
  ".oga": "audio/ogg",
  ".opus": "audio/ogg; codecs=opus",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".wav": "audio/wav",
  ".aac": "audio/aac",
  ".weba": "audio/webm",

  // Video
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".3gp": "video/3gpp",
  ".mkv": "video/x-matroska",

  // Documents
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".txt": "text/plain; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".zip": "application/zip",
  ".rar": "application/x-rar-compressed",
};

/**
 * Converts a Node.js ReadStream into a standard Web API ReadableStream<Uint8Array>.
 */
export function nodeStreamToWebStream(stream: fs.ReadStream): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      stream.on("data", (chunk: Buffer | string) => {
        const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
        controller.enqueue(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
      });
      stream.on("end", () => {
        controller.close();
      });
      stream.on("error", (err) => {
        controller.error(err);
      });
    },
    cancel() {
      stream.destroy();
    },
  });
}

/**
 * Resolves a physical file on disk from URL path segments with path-traversal guards and fallbacks.
 */
export function resolveSafeMediaFilePath(rawSegments: string[], baseDirName: string = "uploads"): string | null {
  if (!rawSegments || rawSegments.length === 0) return null;

  // Safely decode URL components (e.g. spaces, spanish accents)
  const decodedSegments = rawSegments.map((seg) => {
    try {
      return decodeURIComponent(seg).replace(/\.\./g, "").replace(/[\0\r\n]/g, "");
    } catch {
      return seg.replace(/\.\./g, "").replace(/[\0\r\n]/g, "");
    }
  });

  const uploadsBase = path.join(process.cwd(), "public", baseDirName);
  const targetPath = path.resolve(uploadsBase, ...decodedSegments);

  // Guard against directory traversal
  if (!targetPath.startsWith(uploadsBase)) {
    return null;
  }

  // 1. Direct file path check
  if (fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()) {
    return targetPath;
  }

  // 2. Flat filename check within uploads base
  const lastSegment = decodedSegments[decodedSegments.length - 1];
  if (lastSegment) {
    const flatPath = path.join(uploadsBase, lastSegment);
    if (fs.existsSync(flatPath) && fs.statSync(flatPath).isFile()) {
      return flatPath;
    }

    // Also check inside subdirectories (whatsapp, facebook, instagram)
    const subdirs = ["whatsapp", "facebook", "instagram"];
    for (const sub of subdirs) {
      const subPath = path.join(uploadsBase, sub, lastSegment);
      if (fs.existsSync(subPath) && fs.statSync(subPath).isFile()) {
        return subPath;
      }
    }
  }

  // 3. Fallback: check within public root
  const publicBase = path.join(process.cwd(), "public");
  const publicFallback = path.resolve(publicBase, ...decodedSegments);
  if (publicFallback.startsWith(publicBase) && fs.existsSync(publicFallback) && fs.statSync(publicFallback).isFile()) {
    return publicFallback;
  }

  return null;
}

/**
 * Handles HTTP Range requests and full file streaming for multimedia assets.
 */
export function serveMediaFileResponse(req: NextRequest, filePath: string): Response {
  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MEDIA_MIME_TYPES[ext] || "application/octet-stream";

  const range = req.headers.get("range");

  // Handle HTTP 206 Partial Content Range requests (essential for audio notes and video seeking)
  if (range && range.startsWith("bytes=")) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (isNaN(start) || start >= fileSize || (parts[1] && isNaN(end)) || start > end) {
      return new Response("Range Not Satisfiable", {
        status: 416,
        headers: {
          "Content-Range": `bytes */${fileSize}`,
          "Accept-Ranges": "bytes",
        },
      });
    }

    const effectiveEnd = Math.min(end, fileSize - 1);
    const chunkSize = effectiveEnd - start + 1;
    const fileStream = fs.createReadStream(filePath, { start, end: effectiveEnd });
    const iterator = nodeStreamToWebStream(fileStream);

    return new Response(iterator, {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${effectiveEnd}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunkSize.toString(),
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  // Full file streaming
  const fileStream = fs.createReadStream(filePath);
  const iterator = nodeStreamToWebStream(fileStream);

  return new Response(iterator, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": fileSize.toString(),
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=31536000, immutable",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
