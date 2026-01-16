/**
 * Validate deviceId format
 * Must be 1-255 alphanumeric characters, dashes, or underscores
 */
export function isValidDeviceId(deviceId: string): boolean {
  return /^[a-zA-Z0-9_-]{1,255}$/.test(deviceId);
}
