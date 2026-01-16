import { Result } from "better-result";
import { InvalidMessageError, InvalidCommandError } from "../../errors";
import type { SessionManager } from "../session";
import type { CommandMessage, CommandResponse, ErrorResponse } from "./types";
import { handleListDevices } from "./handlers";

/**
 * Handles command validation, routing, and execution
 */
export class CommandHandler {
  constructor(private sessionManager: SessionManager) {}

  /**
   * Validate incoming message and parse as command
   */
  validateMessage(
    message: string | ArrayBuffer,
  ): Result<CommandMessage, InvalidMessageError> {
    return Result.try({
      try: () => {
        // Convert ArrayBuffer to string if needed
        const messageStr =
          typeof message === "string"
            ? message
            : new TextDecoder().decode(message);

        // Basic validation - ensure message is not empty
        if (messageStr.trim().length === 0) {
          throw new Error("Message is empty");
        }

        // Parse as JSON
        const parsed = JSON.parse(messageStr);

        // Validate command structure
        if (!parsed || typeof parsed !== "object") {
          throw new Error("Message must be a JSON object");
        }

        if (!("command" in parsed) || typeof parsed.command !== "string") {
          throw new Error("Message must have a 'command' string property");
        }

        return parsed as CommandMessage;
      },
      catch: (cause) =>
        new InvalidMessageError({
          message: "Invalid message format",
          receivedMessage: message,
          reason: cause instanceof Error ? cause.message : String(cause),
        }),
    });
  }

  /**
   * Route command to appropriate handler
   */
  routeCommand(
    command: CommandMessage,
  ): Result<CommandResponse, InvalidCommandError> {
    return Result.try({
      try: () => {
        switch (command.command) {
          case "listDevices":
            return handleListDevices(this.sessionManager);
          default:
            throw new Error(`Unknown command: ${command.command}`);
        }
      },
      catch: (cause) =>
        new InvalidCommandError({
          message: cause instanceof Error ? cause.message : "Invalid command",
          receivedCommand: command.command,
          availableCommands: ["listDevices"], // Update as you add commands
        }),
    });
  }

  /**
   * Create error response
   */
  createErrorResponse(error: { _tag: string; message: string }): ErrorResponse {
    return {
      error: error._tag,
      message: error.message,
    };
  }
}
