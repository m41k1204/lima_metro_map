import { publicProcedure, router } from "@lima-metro-map/api";
import { connectDB } from "@/lib/mongodb";
import { LineModel } from "@/server/models/Line";

export const linesRouter = router({
  getAll: publicProcedure.query(async () => {
    await connectDB();
    return LineModel.find({}).lean();
  }),
});
