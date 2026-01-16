import type { SessionManager } from "../../session";
import type { ListDevicesResponse } from "../types";

/**
 * Handle listDevices command - returns all active deviceIds
 */
export function handleListDevices(
  sessionManager: SessionManager,
): ListDevicesResponse {
  const devices = sessionManager.getAllDeviceIds();

  return {
    command: "listDevices",
    devices,
    totalCount: devices.length,
  };
}
