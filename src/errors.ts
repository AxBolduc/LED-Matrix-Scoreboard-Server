import { TaggedError, UnhandledException } from "better-result";

/**
 * WebSocket connection upgrade failed
 */
export class WebSocketUpgradeError extends TaggedError(
  "WebSocketUpgradeError",
)<{
  message: string;
  cause?: unknown;
}>() {}

/**
 * No Device ID provided on WebSocket upgrade request
 */
export class DeviceIdRequiredError extends TaggedError(
  "DeviceIdRequiredError",
)<{ message: string; cause?: unknown }>() {}

/**
 * Invalid Device ID format provided on WebSocket upgrade request
 */
export class InvalidDeviceIdError extends TaggedError("InvalidDeviceIdError")<{
  message: string;
  cause?: unknown;
}>() {}

/**
 * Invalid message format or content received from client
 */
export class InvalidMessageError extends TaggedError("InvalidMessageError")<{
  message: string;
  receivedMessage: string | ArrayBuffer;
  reason: string;
}>() {}

/**
 * Failed to deserialize WebSocket attachment (session data)
 */
export class AttachmentDeserializationError extends TaggedError(
  "AttachmentDeserializationError",
)<{
  message: string;
  cause?: unknown;
}>() {}

/**
 * Session not found for given WebSocket
 */
export class SessionNotFoundError extends TaggedError("SessionNotFoundError")<{
  message: string;
}>() {}

/**
 * Failed to send message to WebSocket client
 */
export class MessageSendError extends TaggedError("MessageSendError")<{
  message: string;
  sessionId: string;
  cause?: unknown;
}>() {}

/**
 * Failed to broadcast message to all connected clients
 */
export class BroadcastError extends TaggedError("BroadcastError")<{
  message: string;
  failedCount: number;
  totalCount: number;
  cause?: unknown;
}>() {}

/**
 * Device not found - no active connection for given deviceId
 */
export class DeviceNotFoundError extends TaggedError("DeviceNotFoundError")<{
  message: string;
  deviceId: string;
}>() {}

/**
 * Invalid or unknown command received from client
 */
export class InvalidCommandError extends TaggedError("InvalidCommandError")<{
  message: string;
  receivedCommand: string;
  availableCommands: string[];
}>() {}

/**
 * Union type of all possible errors in the application
 */
export type AppError =
  | WebSocketUpgradeError
  | InvalidMessageError
  | AttachmentDeserializationError
  | SessionNotFoundError
  | MessageSendError
  | BroadcastError
  | InvalidCommandError
  | DeviceNotFoundError
  | UnhandledException
  | DeviceIdRequiredError
  | InvalidDeviceIdError;
