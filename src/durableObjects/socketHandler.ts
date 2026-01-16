import { DurableObject } from "cloudflare:workers";
import { Result } from "better-result";
import {
  AttachmentDeserializationError,
  WebSocketUpgradeError,
  InvalidMessageError,
  MessageSendError,
  BroadcastError,
  SessionNotFoundError,
  type AppError,
} from "../errors";

interface SessionData {
  id: string;
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
        return { id: attachment.id } as SessionData;
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
    const result = this.handleWebSocketUpgrade(request);

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
   * Create WebSocket connection with Result type
   */
  private handleWebSocketUpgrade(
    request: Request,
  ): Result<Response, WebSocketUpgradeError> {
    return Result.try({
      try: () => {
        const webSocketPair = new WebSocketPair();
        const [client, server] = Object.values(webSocketPair);

        // Accept WebSocket in Durable Object
        this.ctx.acceptWebSocket(server);

        // Generate session ID and attach to WebSocket
        const id = crypto.randomUUID();
        server.serializeAttachment({ id });

        this.sessions.set(server, { id });

        console.log(`[SOCKET HANDLER] New connection established: ${id}`);

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
   * Validate incoming message
   */
  private validateMessage(
    message: string | ArrayBuffer,
  ): Result<string, InvalidMessageError> {
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

        // Optional: Add JSON validation if you expect JSON messages
        // JSON.parse(messageStr);

        return messageStr;
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

    console.log(
      `[SOCKET HANDLER] Received message from ${sessionId}:`,
      message,
    );

    // Validate message using Result
    const validationResult = this.validateMessage(message);

    const processResult = validationResult.andThen((validMessage) => {
      // Echo back to sender
      const sendResult = this.sendMessage(ws, `Echo: ${validMessage}`);

      // Broadcast to other clients
      const broadcastResult = this.broadcastMessage(
        `${sessionId} said: ${validMessage}`,
        ws, // exclude sender
      );

      // Combine results
      return sendResult.andThen(() => broadcastResult);
    });

    // Handle final result
    processResult.match({
      ok: (stats) => {
        console.log(
          `[SOCKET HANDLER] Message processed successfully. Broadcast: ${stats.successCount} success, ${stats.failedCount} failed`,
        );
      },
      err: (error) => {
        console.error(`[SOCKET HANDLER] Error processing message:`, error);
        // Attempt to send error message back to client
        this.sendMessage(
          ws,
          JSON.stringify({ error: error._tag, message: error.message }),
        );
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
