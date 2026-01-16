import { OpenAPIRoute, OpenAPIRouteSchema } from "chanfana";
import { Result } from "better-result";
import { z } from "zod";
import { AppContext } from "../types";
import { isValidDeviceId } from "../durableObjects/validation";

// Request body schema
const MessageBodySchema = z.object({
  command: z.string().min(1, "command is required"),
  data: z.string(),
});

export class SendMessage extends OpenAPIRoute {
  schema = {
    tags: ["Devices"],
    summary: "Send message to device",
    description:
      "Sends a message to a specific device through its WebSocket connection",
    request: {
      params: z.object({
        deviceId: z.string(),
      }),
      body: {
        content: {
          "application/json": {
            schema: MessageBodySchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Message sent successfully",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: true },
                message: { type: "string", example: "Message sent" },
              },
            },
          },
        },
      },
      400: {
        description: "Bad request - invalid deviceId format or request body",
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
      404: {
        description: "Device not found - no active connection",
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
    // Extract deviceId from path params
    const deviceId = c.req.param("deviceId");

    // Validate deviceId format
    if (!isValidDeviceId(deviceId)) {
      return new Response(
        JSON.stringify({
          error: "InvalidDeviceIdError",
          message:
            "deviceId must be 1-255 alphanumeric characters, dashes, or underscores",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Parse and validate request body
    const bodyResult = await Result.tryPromise({
      try: async () => {
        const body = await c.req.json();
        return MessageBodySchema.parse(body);
      },
      catch: (cause) => ({
        _tag: "ValidationError",
        message: "Invalid request body",
        cause,
      }),
    });

    // Handle body validation errors
    if (Result.isError(bodyResult)) {
      const error = bodyResult.error;
      console.error("[SEND MESSAGE] Body validation error:", error);
      return new Response(
        JSON.stringify({
          error: error._tag,
          message: error.message,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const { command, data } = bodyResult.value;

    // Serialize message as JSON
    const messageJson = JSON.stringify({ command, data });

    // Call Durable Object RPC method
    const result = await Result.tryPromise({
      try: async () => {
        const stub = c.env.SOCKET_HANDLER.getByName("socketHandler");
        return await stub.sendMessageToDevice(deviceId, messageJson);
      },
      catch: (cause) => ({
        _tag: "RPC_ERROR",
        message: "Failed to send message to device",
        cause,
      }),
    });

    // Handle the result
    return result.match({
      ok: (wasMessageSent) => {
        return Response.json(
          {
            success: wasMessageSent,
            message: "Message sent",
          },
          {
            status: 200,
          },
        );
      },
      err: (error) => {
        console.error("[SEND MESSAGE] RPC Error:", error);
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
