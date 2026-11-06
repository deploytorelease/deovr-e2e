/**
 * Test data of the scenario. See SCENARIO.md, "Test data".
 *
 * A known free video, not "whatever comes first": the second result for this
 * query is premium. When the search ranking changes, the test stops with a
 * message to update this file instead of playing another video.
 */
export const SEARCH_QUERY = 'Immersive Iceland';

export const EXPECTED_VIDEO = {
  /** The path of the video page. Stored so that step 7 checks this video, not any six-letter path. */
  path: '/y2yde2',
  /** The id of the video in the DeoVR JSON API (`/deovr/video/id/<id>`). */
  apiId: 140261,
  title: 'Immersive Iceland & Beyond: Northern Lights, Wildlife & Nature | 3D VR180 Showreel',
  channel: 'Arni Hrolfsson',
  duration: '04:09',
} as const;

/**
 * A known premium video. A visitor must get the paywall instead of the video.
 * When it becomes free, the test stops with a message to update this file.
 */
export const PREMIUM_VIDEO = {
  path: '/wgp2ar',
  apiId: 125968,
  title: 'Iceland Travel 冰岛Vlog 🇮🇸｜Prologue预告',
} as const;
