import { OpenAPIRoute, OpenAPIRouteSchema } from "chanfana";
import { Result } from "better-result";
import { AppContext } from "../types";

export class DevicesList extends OpenAPIRoute {
  schema = {
    tags: ["Devices"],
    summary: "List active devices",
    description: "Returns an array of all currently active device IDs",
    responses: {
      200: {
        description: "Successfully retrieved active devices",
        content: {
          "application/json": {
            schema: {
              type: "array",
              items: {
                type: "string",
              },
              example: ["device1", "device2", "device3"],
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
    // Get the Durable Object stub
    const result = await Result.tryPromise({
      try: async () => {
        const stub = c.env.SOCKET_HANDLER.getByName("socketHandler");
        // Call the RPC method directly
        return await stub.getDevices();
      },
      catch: (cause) => ({
        _tag: "RPC_ERROR",
        message: "Failed to retrieve devices from Durable Object",
        cause,
      }),
    });

    // Handle the result
    return result.match({
      ok: (devices) => {
        return Response.json(devices, {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
      err: (error) => {
        console.error("[DEVICES ENDPOINT] Error:", error);
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
