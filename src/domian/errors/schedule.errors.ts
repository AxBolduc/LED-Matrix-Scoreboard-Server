import { TaggedError } from "better-result";

export class NoGamesFoundError extends TaggedError("NoGamesFoundError")<{
  message: string;
  cause?: unknown;
}>() {}

export class ApiResponseParsingError extends TaggedError(
  "ApiResponseParsingError",
)<{
  message: string;
  cause?: unknown;
}>() {}

export class ApiResponseNetworkError extends TaggedError(
  "ApiResponseNetworkError",
)<{
  message: string;
  cause?: unknown;
}>() {}
