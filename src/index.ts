import { fromHono } from "chanfana";
import { Hono } from "hono";
import { WebsocketConnect } from "./endpoints/websocket";
import { DevicesList } from "./endpoints/devices";
import { SocketHandlerDO } from "./durableObjects/socketHandler";

// Start a Hono app
const app = new Hono<{ Bindings: Env }>();

// Setup OpenAPI registry
const openapi = fromHono(app, {
  docs_url: "/",
});

// Register OpenAPI endpoints
openapi.get("/ws", WebsocketConnect);
openapi.get("/devices", DevicesList);

// Export the Hono app
export default app;

export { SocketHandlerDO };
