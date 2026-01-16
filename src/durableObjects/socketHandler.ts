import { DurableObject } from "cloudflare:workers";
import { Result } from "better-result";
import {
  WebSocketUpgradeError,
  MessageSendError,
  SessionNotFoundError,
  DeviceIdRequiredError,
  InvalidDeviceIdError,
} from "../errors";
import { SessionManager } from "./session";
import { CommandHandler, type ErrorResponse } from "./commands";
import { isValidDeviceId } from "./validation";

export class SocketHandlerDO extends DurableObject<Env> {
  private sessionManager: SessionManager;
  private commandHandler: CommandHandler;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);

    // Initialize session manager
    this.sessionManager = new SessionManager();

    // Initialize command handler with session manager
    this.commandHandler = new CommandHandler(this.sessionManager);

    // Restore sessions from hibernated WebSockets
    this.sessionManager.restoreFromHibernation(this.ctx.getWebSockets());
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

  /**
   * Parse and validate deviceId from request
   */
  private parseDeviceId(
    request: Request,
  ): Result<string, DeviceIdRequiredError | InvalidDeviceIdError> {
    const url = new URL(request.url);
    const deviceId = url.searchParams.get("deviceId");

    if (!deviceId) {
      return Result.err(
        new DeviceIdRequiredError({
          message: "deviceId parameter is required",
        }),
      );
    }

    if (!isValidDeviceId(deviceId)) {
      return Result.err(
        new InvalidDeviceIdError({
          message:
            "deviceId must be 1-255 alphanumeric characters, dashes, or underscores",
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

        this.sessionManager.addSession(server, { id, deviceId });

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
   * Send message to specific WebSocket with error handling
   */
  private sendMessage(
    ws: WebSocket,
    message: string,
  ): Result<void, MessageSendError | SessionNotFoundError> {
    const session = this.sessionManager.getSession(ws);
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
   * Handle incoming WebSocket message
   */
  async webSocketMessage(
    ws: WebSocket,
    message: string | ArrayBuffer,
  ): Promise<void> {
    const session = this.sessionManager.getSession(ws);
    const sessionId = session?.id || "unknown";
    const deviceId = session?.deviceId || "unknown";

    console.log(
      `[SOCKET HANDLER] Received message from ${sessionId} (device: ${deviceId}):`,
      message,
    );

    const processResult = this.commandHandler
      .validateMessage(message)
      .andThen((command) => this.commandHandler.routeCommand(command))
      .andThen((response) => this.sendMessage(ws, JSON.stringify(response)));

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
        const errorResponse = this.commandHandler.createErrorResponse(error);

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
    const session = this.sessionManager.getSession(ws);
    const sessionId = session?.id || "unknown";

    console.log(
      `[SOCKET HANDLER] Connection closed: ${sessionId} (code: ${code}, clean: ${wasClean})`,
    );

    this.sessionManager.removeSession(ws);

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

  /**
   * Get all active device IDs (RPC method)
   * Can be called directly from worker via RPC
   */
  getDevices(): string[] {
    return this.sessionManager.getAllDeviceIds();
  }
}
