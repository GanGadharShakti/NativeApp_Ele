import express from "express";
import cors from "cors";
import categoryRoutes from "./routes/categoryRoutes.js";
import auth from './routes/auth.js'
import managerAuthRoutes from "./routes/managerAuthRoutes.js";

const app = express();
app.use(cors());
app.use(express.json());

// Use Routes
app.use("/api", categoryRoutes);
app.use("/api", auth);
app.use("/api", managerAuthRoutes);

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
