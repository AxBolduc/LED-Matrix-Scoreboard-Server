import { OpenAPIRoute } from "chanfana";
import { AppContext } from "../types";

export class WebsocketConnect extends OpenAPIRoute {
  schema = {
    tags: ["Websocket"],
    summary: "Connect to the Websocket",
  };

  async handle(c: AppContext) {
    const stub = c.env.SOCKET_HANDLER.getByName("socketHandler");

    return stub.fetch(c.req.raw);
  }
}
