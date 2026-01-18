import { format } from "date-fns";
import { Game } from "../domian/game.schema";
import { AbstractSportApiClient } from "./AbstractSportApiClient";
import { Result } from "better-result";
import z from "zod";
import {
  ApiResponseNetworkError,
  ApiResponseParsingError,
  NoGamesFoundError,
} from "../domian/errors/schedule.errors";
import { NHL_PRIMARY_COLORS, NHL_SECONDARY_COLORS } from "../domian/nhl/colors";

const NhlApiTeamSchema = z.object({
  commonName: z.object({
    default: z.string(),
  }),
  id: z.number(),
  abbrev: z.string(),
  score: z.number().optional(),
});

const NhlApiPeriodDescriptorSchema = z.object({
  number: z.number(),
  periodType: z.string(),
  maxRegulationPeriods: z.number(),
});

const NhlApiScoreboardGameSchema = z.object({
  id: z.number(),
  gameState: z.string(),
  awayTeam: NhlApiTeamSchema,
  homeTeam: NhlApiTeamSchema,
  periodDescriptor: NhlApiPeriodDescriptorSchema,
});

const NhlApiScoreboardSchema = z.object({
  gameWeek: z.array(
    z.object({
      date: z.string(),
      games: z.array(NhlApiScoreboardGameSchema),
    }),
  ),
});

export class NHLSportApi extends AbstractSportApiClient {
  private readonly baseUrl = "http://api-web.nhle.com/v1";

  private async getCurrentScoreboard() {
    const url = `${this.baseUrl}/schedule/now`;

    console.log("[NHL API] Fetching game data from:", url);
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
      try: () => NhlApiScoreboardSchema.parse(data),
      catch: (cause) =>
        new ApiResponseParsingError({
          cause,
          message: "Failed to parse scoreboard data",
        }),
    });
  }

  async getTeamCurrentGame(
    teamAbr: string,
  ): Promise<
    Result<
      Game,
      NoGamesFoundError | ApiResponseParsingError | ApiResponseNetworkError
    >
  > {
    const todayString = format(new Date(), "yyyy-MM-dd");

    return (await this.getCurrentScoreboard()).andThen((parsedData) => {
      const todayGames = parsedData.gameWeek[0]?.games;

      if (!todayGames || todayGames.length === 0) {
        return Result.err(
          new NoGamesFoundError({ message: "No games found today" }),
        );
      }

      const gameForTeam = this.findGameForTeam(todayGames, teamAbr);

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
    games: z.infer<typeof NhlApiScoreboardSchema>["gameWeek"][0]["games"],
    teamAbr: string,
  ) {
    return games.find(
      (g) =>
        g.awayTeam.abbrev.toLowerCase() === teamAbr.toLowerCase() ||
        g.homeTeam.abbrev.toLowerCase() === teamAbr.toLowerCase(),
    );
  }

  private getTeamColors(teamAbr: string) {
    return {
      primary: NHL_PRIMARY_COLORS[teamAbr as keyof typeof NHL_PRIMARY_COLORS],
      secondary:
        NHL_SECONDARY_COLORS[teamAbr as keyof typeof NHL_SECONDARY_COLORS],
    };
  }

  private mapApiResponseToGame(
    game: z.infer<typeof NhlApiScoreboardSchema>["gameWeek"][0]["games"][0],
  ): Game {
    return {
      sport: "nhl",
      gameId: game.id.toString(),
      status: game.gameState === "FIN" ? "FINAL" : "LIVE",
      teams: {
        away: {
          id: game.awayTeam.id,
          abbr: game.awayTeam.abbrev,
          name: game.awayTeam.commonName.default,
          score: game.awayTeam.score ?? 0,
          colors: {
            primary: this.getTeamColors(game.awayTeam.abbrev).primary,
            secondary: this.getTeamColors(game.awayTeam.abbrev).secondary,
          },
        },
        home: {
          id: game.homeTeam.id,
          abbr: game.homeTeam.abbrev,
          name: game.homeTeam.commonName.default,
          score: game.homeTeam.score ?? 0,
          colors: {
            primary: this.getTeamColors(game.homeTeam.abbrev).primary,
            secondary: this.getTeamColors(game.homeTeam.abbrev).secondary,
          },
        },
      },
      period: {
        current: game.periodDescriptor.number,
        isOvertime: game.periodDescriptor.periodType === "OT",
        isShootout: game.periodDescriptor.periodType === "SO",
        timeRemaining: "0:00",
      },
      meta: {},
    };
  }
}
