import { OpenAPIRoute, OpenAPIRouteSchema } from "chanfana";
import z from "zod";
import { GameSchema } from "../../../domian/game.schema";
import { AppContext } from "../../../types";
import { SportApiFactory } from "../../../sportApis/SportApi.factory";

export class GetGameRoute extends OpenAPIRoute {
  schema = {
    tags: ["Sports"],
    summary: "Get game",
    description: "Get game details",
    request: {
      params: z.object({
        sport: z.enum(["mlb", "nhl"]),
      }),
      query: z.object({
        teamAbr: z.string(),
      }),
    },
    responses: {
      200: {
        description: "Game details",
        content: {
          "application/json": {
            schema: GameSchema,
          },
        },
      },
      404: {
        description: "Game not found",
        content: {
          "application/json": {
            schema: z.object({
              error: z.string(),
              message: z.string(),
            }),
          },
        },
      },
    },
  } satisfies OpenAPIRouteSchema;

  async handle(c: AppContext) {
    const {
      params: { sport },
      query: { teamAbr },
    } = await this.getValidatedData<typeof this.schema>();

    const gameResult =
      await SportApiFactory.create(sport).getTeamCurrentGame(teamAbr);

    return gameResult.match({
      ok: (game) =>
        new Response(JSON.stringify(game), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      err: (error) => {
        switch (error._tag) {
          case "NoGamesFoundError":
            return new Response(
              JSON.stringify({
                error: "NoGamesFoundError",
                message: error.message,
              }),
              {
                status: 404,
                headers: { "Content-Type": "application/json" },
              },
            );
          case "ApiResponseParsingError":
            return new Response(
              JSON.stringify({
                error: "ApiResponseParsingError",
                message: error.message,
              }),
              {
                status: 500,
                headers: { "Content-Type": "application/json" },
              },
            );
          case "ApiResponseNetworkError":
            return new Response(
              JSON.stringify({
                error: "ApiResponseNetworkError",
                message: error.message,
              }),
              {
                status: 500,
                headers: { "Content-Type": "application/json" },
              },
            );
          default:
            return new Response(
              JSON.stringify({
                error: "UnknownError",
                message: "unknown error",
              }),
              {
                status: 500,
                headers: { "Content-Type": "application/json" },
              },
            );
        }
      },
    });
  }
}
