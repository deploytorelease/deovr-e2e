/** `mm:ss` or `h:mm:ss` as shown on DeoVR → seconds. */
export function toSeconds(text: string): number {
  const parts = text.trim().split(':').map(Number);
  if (parts.length < 2 || parts.length > 3 || parts.some((part) => !Number.isInteger(part))) {
    throw new Error(`"${text}" is not a time of the form mm:ss or h:mm:ss`);
  }
  return parts.reduce((total, part) => total * 60 + part, 0);
}

/** Seconds → `mm:ss`, rounded down like the player shows it. */
export function toClock(seconds: number): string {
  const whole = Math.floor(seconds);
  const minutes = Math.floor(whole / 60);
  return `${String(minutes).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`;
}
