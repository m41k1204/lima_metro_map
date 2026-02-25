import { publicProcedure, router } from "@lima-metro-map/api";
import { linesRouter } from "./lines";
import { stationsRouter } from "./stations";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => {
    return "OK";
  }),
  lines: linesRouter,
  stations: stationsRouter,
});

export type AppRouter = typeof appRouter;
