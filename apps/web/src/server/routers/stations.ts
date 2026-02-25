import { publicProcedure, router } from "@lima-metro-map/api";
import { connectDB } from "@/lib/mongodb";
import { StationModel } from "@/server/models/Station";

export const stationsRouter = router({
  getAll: publicProcedure.query(async () => {
    await connectDB();
    return StationModel.find({}).lean();
  }),
});
