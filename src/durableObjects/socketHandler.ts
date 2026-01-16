import { DurableObject } from "cloudflare:workers";
import { Result } from "better-result";
import {
  AttachmentDeserializationError,
  WebSocketUpgradeError,
  InvalidMessageError,
  MessageSendError,
  BroadcastError,
  SessionNotFoundError,
  InvalidCommandError,
  type AppError,
} from "../errors";

interface SessionData {
  id: string;
  deviceId: string;
}

/**
 * Command message structure sent by clients
 */
interface CommandMessage {
  command: string;
  // Future: add payload for commands that need parameters
}

/**
 * Response for listDevices command
 */
interface ListDevicesResponse {
  command: "listDevices";
  devices: string[];
  totalCount: number;
}

/**
 * Error response sent to clients
 */
interface ErrorResponse {
  error: string;
  message: string;
}

/**
 * Union type for all command responses
 */
type CommandResponse = ListDevicesResponse | ErrorResponse;

/**
 * Validate deviceId format
 * Must be 1-255 alphanumeric characters, dashes, or underscores
 */
function isValidDeviceId(deviceId: string): boolean {
  return /^[a-zA-Z0-9_-]{1,255}$/.test(deviceId);
}

export class SocketHandlerDO extends DurableObject<Env> {
  sessions: Map<WebSocket, SessionData>;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sessions = new Map();

    // Restore sessions from hibernated WebSockets
    this.ctx.getWebSockets().forEach((ws) => {
      const result = this.deserializeSessionAttachment(ws);
      result.match({
        ok: (attachment) => {
          this.sessions.set(ws, attachment);
        },
        err: (error) => {
          // Log error but continue - attachment may be missing for new connections
          console.error(
            "[SOCKET HANDLER] Failed to restore session:",
            error.message,
          );
        },
      });
    });
  }

  /**
   * Safely deserialize WebSocket attachment
   */
  private deserializeSessionAttachment(
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

  /**
   * Handle WebSocket upgrade request
   */
  async fetch(request: Request): Promise<Response> {
    const result = this.parseDeviceId(request).andThen((deviceId) =>
      this.handleWebSocketUpgrade(deviceId),
    );

    return result.match({
      ok: (response) => response,
      err: (error) => {
        console.error("[SOCKET HANDLER] WebSocket upgrade failed:", error);
        return new Response(error.message, {
          status: 400,
          headers: { "Content-Type": "text/plain" },
        });
      },
    });
  }

  private parseDeviceId(request: Request) {
    const url = new URL(request.url);
    const deviceId = url.searchParams.get("deviceId");

    if (!deviceId) {
      return Result.err(
        new DeviceIdRequiredError({
          message: "Missing deviceId parameter",
        }),
      );
    }

    if (!isValidDeviceId(deviceId)) {
      return Result.err(
        new InvalidDeviceIdError({
          message: "Invalid deviceId format",
        }),
      );
    }

    return Result.ok(deviceId);
  }

  /**
   * Create WebSocket connection with Result type
   */
  private handleWebSocketUpgrade(
    deviceId: string,
  ): Result<Response, WebSocketUpgradeError> {
    return Result.try({
      try: () => {
        const webSocketPair = new WebSocketPair();
        const [client, server] = Object.values(webSocketPair);

        // Accept WebSocket in Durable Object
        this.ctx.acceptWebSocket(server);

        // Generate session ID and attach to WebSocket
        const id = crypto.randomUUID();
        server.serializeAttachment({ id, deviceId });

        this.sessions.set(server, { id, deviceId });

        console.log(
          `[SOCKET HANDLER] New connection established: ${id} (device: ${deviceId})`,
        );

        return new Response(null, {
          status: 101,
          webSocket: client,
        });
      },
      catch: (cause) =>
        new WebSocketUpgradeError({
          message: "Failed to upgrade WebSocket connection",
          cause,
        }),
    });
  }

  /**
   * Validate incoming message and parse as command
   */
  private validateMessage(
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
   * Send message to specific WebSocket with error handling
   */
  private sendMessage(
    ws: WebSocket,
    message: string,
  ): Result<void, MessageSendError | SessionNotFoundError> {
    const session = this.sessions.get(ws);
    if (!session) {
      return Result.err(
        new SessionNotFoundError({
          message: "Session not found for WebSocket",
        }),
      );
    }

    return Result.try({
      try: () => {
        ws.send(message);
      },
      catch: (cause) =>
        new MessageSendError({
          message: "Failed to send message to client",
          sessionId: session.id,
          cause,
        }),
    });
  }

  /**
   * Handle command routing
   */
  private handleCommand(
    ws: WebSocket,
    command: CommandMessage,
  ): Result<CommandResponse, InvalidCommandError> {
    return Result.try({
      try: () => {
        switch (command.command) {
          case "listDevices":
            return this.handleListDevicesCommand();

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
   * Handle listDevices command - returns all active deviceIds
   */
  private handleListDevicesCommand(): ListDevicesResponse {
    // Collect all deviceIds from active sessions
    const devices = Array.from(this.sessions.values()).map(
      (session) => session.deviceId,
    );

    return {
      command: "listDevices",
      devices,
      totalCount: devices.length,
    };
  }

  /**
   * Broadcast message to all connected clients
   */
  private broadcastMessage(
    message: string,
    excludeWs?: WebSocket,
  ): Result<{ successCount: number; failedCount: number }, BroadcastError> {
    let successCount = 0;
    let failedCount = 0;
    const errors: AppError[] = [];

    for (const [ws, session] of this.sessions.entries()) {
      if (ws === excludeWs) continue;

      const result = this.sendMessage(ws, message);
      result.match({
        ok: () => {
          successCount++;
        },
        err: (error) => {
          failedCount++;
          errors.push(error);
          console.error(
            `[SOCKET HANDLER] Failed to send to ${session.id}:`,
            error.message,
          );
        },
      });
    }

    if (failedCount > 0 && successCount === 0) {
      // Complete failure
      return Result.err(
        new BroadcastError({
          message: "Failed to broadcast message to any clients",
          failedCount,
          totalCount: this.sessions.size,
          cause: errors,
        }),
      );
    }

    // Partial or complete success
    return Result.ok({ successCount, failedCount });
  }

  /**
   * Handle incoming WebSocket message
   */
  async webSocketMessage(
    ws: WebSocket,
    message: string | ArrayBuffer,
  ): Promise<void> {
    const session = this.sessions.get(ws);
    const sessionId = session?.id || "unknown";
    const deviceId = session?.deviceId || "unknown";

    console.log(
      `[SOCKET HANDLER] Received message from ${sessionId} (device: ${deviceId}):`,
      message,
    );

    // Validate and parse message as command
    const validationResult = this.validateMessage(message);

    const processResult = validationResult.andThen((command) => {
      // Handle the command
      const commandResult = this.handleCommand(ws, command);

      return commandResult.andThen((response) => {
        // Send response back to the requester
        return this.sendMessage(ws, JSON.stringify(response));
      });
    });

    // Handle final result
    processResult.match({
      ok: () => {
        console.log(
          `[SOCKET HANDLER] Command processed successfully for ${deviceId}`,
        );
      },
      err: (error) => {
        console.error(`[SOCKET HANDLER] Error processing command:`, error);

        // Send error response back to client
        const errorResponse: ErrorResponse = {
          error: error._tag,
          message: error.message,
        };

        this.sendMessage(ws, JSON.stringify(errorResponse));
      },
    });
  }

  /**
   * Handle WebSocket close
   */
  async webSocketClose(
    ws: WebSocket,
    code: number,
    reason: string,
    wasClean: boolean,
  ): Promise<void> {
    const session = this.sessions.get(ws);
    const sessionId = session?.id || "unknown";

    console.log(
      `[SOCKET HANDLER] Connection closed: ${sessionId} (code: ${code}, clean: ${wasClean})`,
    );

    this.sessions.delete(ws);

    // Attempt to close with proper reason, wrapped in Result
    Result.try({
      try: () => {
        ws.close(code, "closing down");
      },
      catch: (cause) =>
        new MessageSendError({
          message: "Failed to close WebSocket cleanly",
          sessionId,
          cause,
        }),
    }).match({
      ok: () => {},
      err: (error) => {
        console.error(
          `[SOCKET HANDLER] Error closing WebSocket:`,
          error.message,
        );
      },
    });
  }
}
