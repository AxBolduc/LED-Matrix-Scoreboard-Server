import { format } from "date-fns";
import { Game } from "../domian/game.schema";
import { AbstractSportApiClient } from "./AbstractSportApiClient";
import { Result } from "better-result";
import z from "zod";
import { MLB_PRIMARY_COLORS, MLB_SECONDARY_COLORS } from "../domian/mlb/colors";
import {
  ApiResponseNetworkError,
  ApiResponseParsingError,
  NoGamesFoundError,
} from "../domian/errors/schedule.errors";

const MlbApiTeamSchema = z.object({
  team: z.object({
    id: z.number(),
    name: z.string(),
    abbreviation: z.string(),
  }),
});

const MlbApiScheduleSchema = z.object({
  dates: z.array(
    z.object({
      games: z.array(
        z.object({
          status: z.object({
            statusCode: z.string(),
          }),
          teams: z.object({
            away: MlbApiTeamSchema,
            home: MlbApiTeamSchema,
          }),
          linescore: z.object({
            currentInning: z.number(),
            isTopInning: z.boolean(),
            offense: z.object({
              first: z.object({ id: z.number() }).optional(),
              second: z.object({ id: z.number() }).optional(),
              third: z.object({ id: z.number() }).optional(),
            }),
            teams: z.object({
              away: z.object({
                runs: z.number(),
              }),
              home: z.object({
                runs: z.number(),
              }),
            }),
            balls: z.number(),
            strikes: z.number(),
            outs: z.number(),
          }),
        }),
      ),
    }),
  ),
});

export class MLBSportApi extends AbstractSportApiClient {
  private readonly baseUrl = "http://statsapi.mlb.com/api";

  async getTeamCurrentGame(
    teamAbr: string,
  ): Promise<
    Result<
      Game,
      NoGamesFoundError | ApiResponseParsingError | ApiResponseNetworkError
    >
  > {
    // const todayString = format(new Date(), "yyyy-MM-dd");
    const todayString = "2025-07-22";
    const fields = [
      "dates",
      "games",
      "teams",
      "team",
      "id",
      "name",
      "abbreviation",
      "linescore",
      "home",
      "away",
      "runs",
      "currentInning",
      "isTopInning",
      "offense",
      "first",
      "second",
      "third",
      "balls",
      "strikes",
      "outs",
      "status",
      "statusCode",
    ];

    const hydrations = ["team", "linescore"];

    const url = `${this.baseUrl}/v1/schedule?sportId=1&fields=${fields.join(",")}&hydrate=${hydrations.join(",")}&startDate=${todayString}&endDate=${todayString}`;

    console.log("[MLB API] Fetching game data from:", url);
    const response = await fetch(url);

    if (!response.ok) {
      return Result.err(
        new ApiResponseNetworkError({
          message: "Failed to fetch game data",
          cause: new Error("Network error"),
        }),
      );
    }

    const data = await response.json();

    return Result.try({
      try: () => MlbApiScheduleSchema.parse(data),
      catch: (cause) =>
        new ApiResponseParsingError({
          cause,
          message: "Failed to parse game data",
        }),
    }).andThen((parsedData) => {
      const gameForTeam = this.findGameForTeam(
        parsedData.dates[0].games,
        teamAbr,
      );

      if (!gameForTeam) {
        console.error("[MLB API] Error finding game for team:", gameForTeam);

        return Result.err(
          new NoGamesFoundError({ message: "No games for team" }),
        );
      }

      return Result.ok(this.mapApiResponseToGame(gameForTeam));
    });
  }

  private findGameForTeam(
    games: z.infer<typeof MlbApiScheduleSchema>["dates"][0]["games"],
    teamAbr: string,
  ) {
    return games.find(
      (g) =>
        g.teams.away.team.abbreviation.toLowerCase() ===
          teamAbr.toLowerCase() ||
        g.teams.home.team.abbreviation.toLowerCase() === teamAbr.toLowerCase(),
    );
  }

  private getTeamColors(teamAbr: string) {
    return {
      primary: MLB_PRIMARY_COLORS[teamAbr as keyof typeof MLB_PRIMARY_COLORS],
      secondary:
        MLB_SECONDARY_COLORS[teamAbr as keyof typeof MLB_SECONDARY_COLORS],
    };
  }

  private mapApiResponseToGame(
    game: z.infer<typeof MlbApiScheduleSchema>["dates"][0]["games"][0],
  ): Game {
    return {
      sport: "mlb",
      status: game.status.statusCode === "F" ? "FINAL" : "LIVE",
      teams: {
        away: {
          id: game.teams.away.team.id,
          abbr: game.teams.away.team.abbreviation,
          name: game.teams.away.team.name,
          score: game.linescore.teams.away.runs,
          colors: {
            primary: this.getTeamColors(game.teams.away.team.abbreviation)
              .primary,
            secondary: this.getTeamColors(game.teams.away.team.abbreviation)
              .secondary,
          },
        },
        home: {
          id: game.teams.home.team.id,
          abbr: game.teams.home.team.abbreviation,
          name: game.teams.home.team.name,
          score: game.linescore.teams.home.runs,
          colors: {
            primary: this.getTeamColors(game.teams.home.team.abbreviation)
              .primary,
            secondary: this.getTeamColors(game.teams.home.team.abbreviation)
              .secondary,
          },
        },
      },
      period: {
        current: game.linescore.currentInning,
        isTop: game.linescore.isTopInning,
      },
      meta: {
        count: {
          balls: game.linescore.balls,
          strikes: game.linescore.strikes,
          outs: game.linescore.outs,
        },
        bases: {
          first: game.linescore.offense.first !== undefined,
          second: game.linescore.offense.second !== undefined,
          third: game.linescore.offense.third !== undefined,
        },
      },
    };
  }
}
