/**
 * Command message structure sent by clients
 */
export interface CommandMessage {
  command: string;
  // Future: add payload for commands that need parameters
}

/**
 * Response for listDevices command
 */
export interface ListDevicesResponse {
  command: "listDevices";
  devices: string[];
  totalCount: number;
}

/**
 * Error response sent to clients
 */
export interface ErrorResponse {
  error: string;
  message: string;
}

/**
 * Union type for all command responses
 */
export type CommandResponse = ListDevicesResponse | ErrorResponse;
