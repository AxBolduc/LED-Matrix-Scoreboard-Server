import { AbstractSportApiClient } from "./AbstractSportApiClient";
import { MLBSportApi } from "./MLBSportApi";

export class SportApiFactory {
  public static create(sport: string): AbstractSportApiClient {
    switch (sport) {
      case "mlb":
        return new MLBSportApi();
      case "nhl":
      // TODO: Implement
      // return new NHLSportApi();
      default:
        throw new Error(`Unsupported sport: ${sport}`);
    }
  }
}
