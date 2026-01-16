import { TaggedError, UnhandledException } from "better-result";

/**
 * WebSocket connection upgrade failed
 */
export class WebSocketUpgradeError extends TaggedError("WebSocketUpgradeError")<{
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
export class AttachmentDeserializationError extends TaggedError("AttachmentDeserializationError")<{
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
 * Union type of all possible errors in the application
 */
export type AppError =
  | WebSocketUpgradeError
  | InvalidMessageError
  | AttachmentDeserializationError
  | SessionNotFoundError
  | MessageSendError
  | BroadcastError
  | UnhandledException;
