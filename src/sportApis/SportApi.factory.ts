import { AbstractSportApiClient } from "./AbstractSportApiClient";
import { MLBSportApi } from "./MLBSportApi";
import { NHLSportApi } from "./NHLSportApi";

export class SportApiFactory {
  public static create(sport: string): AbstractSportApiClient {
    switch (sport) {
      case "mlb":
        return new MLBSportApi();
      case "nhl":
        return new NHLSportApi();
      default:
        throw new Error(`Unsupported sport: ${sport}`);
    }
  }
}
