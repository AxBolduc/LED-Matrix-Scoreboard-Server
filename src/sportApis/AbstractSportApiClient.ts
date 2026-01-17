import { Result } from "better-result";
import { Game } from "../domian/game.schema";
import {
  ApiResponseNetworkError,
  ApiResponseParsingError,
  NoGamesFoundError,
} from "../domian/errors/schedule.errors";

export abstract class AbstractSportApiClient {
  abstract getTeamCurrentGame(
    teamAbr: string,
  ): Promise<
    Result<
      Game,
      NoGamesFoundError | ApiResponseParsingError | ApiResponseNetworkError
    >
  >;
}
