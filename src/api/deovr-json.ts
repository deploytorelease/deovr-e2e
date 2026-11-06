import { z } from 'zod';

/**
 * The DeoVR JSON format: what the DeoVR app reads from a site.
 *
 * The format is described in the developer documentation of DeoVR
 * (https://deovr.com/documentation, "Intro to the integration"); deovr.com
 * serves its own library in it: `/deovr` and `/deovr/video/id/<id>`. Only the
 * fields the tests rely on are declared; the schemas allow additional fields,
 * so a new field does not fail a test, a missing or retyped one does.
 */

export const videoSourceSchema = z.object({
  resolution: z.number().int().positive(),
  /** The stream URL; empty when the visitor has no access. */
  url: z.string(),
});

export const encodingSchema = z.object({
  name: z.string().min(1),
  /** Empty for a codec the video is not encoded in (seen: `mkv_h265_opus`, `av1`). */
  videoSources: z.array(videoSourceSchema),
});

export const videoSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1),
  videoLength: z.number().int().positive(),
  isPremium: z.boolean(),
  fullAccess: z.boolean(),
  is3d: z.boolean(),
  thumbnailUrl: z.url(),
  encodings: z.array(encodingSchema).min(1),
});
export type DeoVrVideo = z.infer<typeof videoSchema>;

export const libraryItemSchema = z.object({
  title: z.string().min(1),
  /** Any integer here; that it is positive is checked by `checkLibraryDurations`, with its known issues. */
  videoLength: z.number().int(),
  video_url: z.string().regex(/^https:\/\/deovr\.com\/deovr\/video\/id\/\d+$/),
  thumbnailUrl: z.url(),
});

export const librarySchema = z.object({
  scenes: z
    .array(
      z.object({
        name: z.string().min(1),
        list: z.array(libraryItemSchema).min(1),
      }),
    )
    .min(1),
});

/** All stream URLs of a video. */
export function streamUrls(video: DeoVrVideo): string[] {
  return video.encodings.flatMap((encoding) => encoding.videoSources.map((source) => source.url));
}
