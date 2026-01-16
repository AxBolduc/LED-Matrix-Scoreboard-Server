import { Result } from "better-result";
import { AttachmentDeserializationError } from "../../errors";
import type { SessionData } from "./types";

/**
 * Safely deserialize WebSocket attachment
 */
export function deserializeSessionAttachment(
  ws: WebSocket,
): Result<SessionData, AttachmentDeserializationError> {
  return Result.try({
    try: () => {
      const attachment = ws.deserializeAttachment();
      if (!attachment || typeof attachment !== "object") {
        throw new Error("Attachment is missing or invalid");
      }
      if (!("id" in attachment) || typeof attachment.id !== "string") {
        throw new Error("Attachment missing required 'id' field");
      }
      if (
        !("deviceId" in attachment) ||
        typeof attachment.deviceId !== "string"
      ) {
        throw new Error("Attachment missing required 'deviceId' field");
      }
      return {
        id: attachment.id,
        deviceId: attachment.deviceId,
      } as SessionData;
    },
    catch: (cause) =>
      new AttachmentDeserializationError({
        message: "Failed to deserialize WebSocket attachment",
        cause,
      }),
  });
}
