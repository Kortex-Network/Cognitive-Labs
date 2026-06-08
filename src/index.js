const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const StellarSDK = require("stellar-sdk");
const { errorHandler, sendError } = require("./middleware/errorHandler");

// Load environment variables
dotenv.config();

// Import routes
const LABSRoutes = require("./routes/LABS");
const credentialRoutes = require("./routes/credentials");
const batchRoutes = require("./routes/batch");
const sharingRoutes = require("./routes/credentialSharing");
const healthRoutes = require("./routes/health");

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Stellar server
const server = new StellarSDK.Horizon.Server(
  process.env.STELLAR_HORIZON_URL || "https://horizon-testnet.stellar.org",
);

// Set network passphrase
StellarSDK.Network.useTestNetwork();
if (process.env.STELLAR_NETWORK === "PUBLIC") {
  StellarSDK.Network.usePublicNetwork();
}
const redisClient = require("./config/redis"); 
app.set("redisClient", redisClient);

// Routes
app.use("/api/LABS", LABSRoutes);
app.use("/api/credentials", credentialRoutes);
app.use("/api/batch", batchRoutes);
app.use("/api/sharing", sharingRoutes);
app.use("/api/health", healthRoutes);

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    name: "Stellar LABS Platform",
    version: "1.0.0",
    description: "Cognitive Lab platform on Stellar network",
    endpoints: {
      LABS: "/api/LABS",
      credentials: "/api/credentials",
      batch: "/api/batch",
      sharing: "/api/sharing",
      health: "/health",
    },
  });
});

// 404 handler
app.use((req, res) => {
  return sendError(
    res,
    404,
    "The requested endpoint was not found",
    "NOT_FOUND",
  );
});

// Global error handler
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Stellar LABS Platform running on port ${PORT}`);
  console.log(`📡 Network: ${process.env.STELLAR_NETWORK || "TESTNET"}`);
  console.log(`🌐 Horizon: ${process.env.STELLAR_HORIZON_URL}`);
  console.log(`🔗 API: http://localhost:${PORT}/api`);
});

module.exports = app;
