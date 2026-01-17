import z from "zod";

export const MLBGameSchema = z.object({
  sport: z.literal("mlb"),
  gameId: z.string(),
  status: z.enum(["LIVE", "FINAL", "SCHEDULED"]),
  teams: z.object({
    away: z.object({
      id: z.number(),
      abbr: z.string(),
      name: z.string(),
      score: z.number(),
      colors: z.object({
        primary: z.number(),
        secondary: z.number(),
      }),
    }),
    home: z.object({
      id: z.number(),
      abbr: z.string(),
      name: z.string(),
      score: z.number(),
      colors: z.object({
        primary: z.number(),
        secondary: z.number(),
      }),
    }),
  }),
  period: z.object({
    current: z.number(),
    isTop: z.boolean(),
  }),
  meta: z.object({
    count: z.object({
      balls: z.number(),
      strikes: z.number(),
      outs: z.number(),
    }),
    bases: z.object({
      first: z.boolean(),
      second: z.boolean(),
      third: z.boolean(),
    }),
  }),
});

export const NHLGameSchema = z.object({
  sport: z.literal("nhl"),
  gameId: z.string(),
  status: z.enum(["LIVE", "FINAL", "SCHEDULED"]),
  teams: z.object({
    away: z.object({
      id: z.number(),
      abbr: z.string(),
      name: z.string(),
      score: z.number(),
      colors: z.object({
        primary: z.number(),
        secondary: z.number(),
      }),
    }),
    home: z.object({
      id: z.number(),
      abbr: z.string(),
      name: z.string(),
      score: z.number(),
      colors: z.object({
        primary: z.number(),
        secondary: z.number(),
      }),
    }),
  }),
  period: z.object({
    current: z.number(),
    isOvertime: z.boolean(),
    isShootout: z.boolean(),
    timeRemaining: z.string(),
  }),
  meta: z.object({}),
});

export const GameSchema = z.discriminatedUnion("sport", [
  MLBGameSchema,
  NHLGameSchema,
]);

export type Game = z.infer<typeof GameSchema>;
