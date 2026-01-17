import { fromHono } from "chanfana";
import { Hono } from "hono";
import { WebsocketConnect } from "./endpoints/websocket";
import { DevicesList } from "./endpoints/devices";
import { SendMessage } from "./endpoints/sendMessage";
import { SocketHandlerDO } from "./durableObjects/socketHandler";
import { GetGameRoute } from "./endpoints/sports/[sport]/game";

// Start a Hono app
const app = new Hono<{ Bindings: Env }>();

// Setup OpenAPI registry
const openapi = fromHono(app, {
  docs_url: "/",
});

// Register OpenAPI endpoints
openapi.get("/ws", WebsocketConnect);
openapi.get("/devices", DevicesList);
openapi.post("/devices/:deviceId/message", SendMessage);
openapi.get("/sports/:sport/game", GetGameRoute);

// Export the Hono app
export default app;

export { SocketHandlerDO };
