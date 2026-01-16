import { OpenAPIRoute, OpenAPIRouteSchema } from "chanfana";
import { Result } from "better-result";
import { AppContext } from "../types";
import { WebSocketUpgradeError } from "../errors";

export class WebsocketConnect extends OpenAPIRoute {
  schema = {
    tags: ["Websocket"],
    summary: "Connect to the Websocket",
    responses: {
      101: {
        description: "WebSocket connection upgraded successfully",
      },
      400: {
        description: "Bad request - WebSocket upgrade failed",
        content: {
          "text/plain": {
            schema: {
              type: "string",
              example: "Failed to upgrade WebSocket connection",
            },
          },
        },
      },
      500: {
        description: "Internal server error",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                error: { type: "string" },
                message: { type: "string" },
              },
            },
          },
        },
      },
    },
  } satisfies OpenAPIRouteSchema;

  async handle(c: AppContext) {
    // Wrap Durable Object call in Result.tryPromise to handle any exceptions
    const result = await Result.tryPromise({
      try: async () => {
        const stub = c.env.SOCKET_HANDLER.getByName("socketHandler");
        return await stub.fetch(c.req.raw);
      },
      catch: (cause) =>
        new WebSocketUpgradeError({
          message: "Failed to upgrade WebSocket connection",
          cause,
        }),
    });

    // Handle the result
    return result.match({
      ok: (response) => response,
      err: (error) => {
        console.error("[WEBSOCKET ENDPOINT] Error:", error);
        return new Response(
          JSON.stringify({
            error: error._tag,
            message: error.message,
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          },
        );
      },
    });
  }
}
