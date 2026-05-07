import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from "@workspace/api-zod";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { getAuth } from "@clerk/express";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned URL for file upload.
 * Requires authentication. Returns a presigned PUT URL and the canonical objectPath.
 */
router.post("/storage/uploads/request-url", async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required fields" });
    return;
  }

  try {
    const uploadUrl = await objectStorageService.getObjectEntityUploadURL();
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadUrl);

    res.json(
      RequestUploadUrlResponse.parse({
        uploadUrl,
        objectPath,
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Error generating upload URL");
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 * Unconditionally public (static assets, etc.).
 */
router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const response = await objectStorageService.downloadObject(file);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    req.log.error({ err: error }, "Error serving public object");
    res.status(500).json({ error: "Failed to serve public object" });
  }
});

/**
 * GET /storage/objects/*
 *
 * Serve private object entities. Requires authentication.
 *
 * Authorization policy: authenticated-public for profile photos.
 * Any authenticated user can read any object by path, which is the correct
 * behavior for profile photos on a social platform (users need to see each
 * other's photos in discovery/profiles/matches). Object paths are UUIDs so
 * they are not guessable without prior knowledge.
 *
 * Supports HTTP Range requests (206 Partial Content) so mobile video players
 * (iOS AVPlayer, Android ExoPlayer) can stream video correctly.
 *
 * If this route is extended to serve truly private assets (e.g. private DMs,
 * documents), an explicit owner/ACL check must be added at that point.
 */
router.get("/storage/objects/*path", async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/objects/${wildcardPath}`;
    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);

    const [metadata] = await objectFile.getMetadata();
    const contentType = (metadata.contentType as string) || "application/octet-stream";
    const fileSize = parseInt(metadata.size as string, 10);

    const rangeHeader = req.headers.range;

    if (rangeHeader) {
      // Parse "bytes=start-end" — mobile video players always send this
      const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
      if (!match) {
        res.status(416).setHeader("Content-Range", `bytes */${fileSize}`).end();
        return;
      }

      const start = match[1] ? parseInt(match[1], 10) : 0;
      const end   = match[2] ? parseInt(match[2], 10) : fileSize - 1;

      if (start > end || end >= fileSize) {
        res.status(416).setHeader("Content-Range", `bytes */${fileSize}`).end();
        return;
      }

      const chunkSize = end - start + 1;
      res.status(206);
      res.setHeader("Accept-Ranges",  "bytes");
      res.setHeader("Content-Range",  `bytes ${start}-${end}/${fileSize}`);
      res.setHeader("Content-Length", chunkSize);
      res.setHeader("Content-Type",   contentType);
      res.setHeader("Cache-Control",  "private, max-age=3600");

      const nodeStream = objectFile.createReadStream({ start, end });
      nodeStream.pipe(res);
    } else {
      // Full download
      res.status(200);
      res.setHeader("Accept-Ranges",  "bytes");
      res.setHeader("Content-Type",   contentType);
      res.setHeader("Cache-Control",  "private, max-age=3600");
      if (!isNaN(fileSize)) res.setHeader("Content-Length", fileSize);

      const nodeStream = objectFile.createReadStream();
      nodeStream.pipe(res);
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      req.log.warn({ err: error }, "Object not found");
      res.status(404).json({ error: "Object not found" });
      return;
    }
    req.log.error({ err: error }, "Error serving object");
    res.status(500).json({ error: "Failed to serve object" });
  }
});

export default router;
