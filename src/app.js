const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

// Import routes
const authRoutes = require("./routes/authRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
// const investmentRoutes = require("./routes/investmentRoutes"); // Placeholder
// const quoteRoutes = require("./routes/quoteRoutes"); // Placeholder

// Import DB connection to initialize (and potentially test)
const pool = require("./config/db"); 

const app = express();

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:3000", // Frontend URL
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// API Routes
const API_BASE_URL = process.env.API_BASE_URL || "/api";

app.use(`${API_BASE_URL}`, authRoutes); // All auth routes will be prefixed with /api (e.g. /api/register)
app.use(`${API_BASE_URL}/categories`, categoryRoutes);
// app.use(`${API_BASE_URL}/investments`, investmentRoutes); // Placeholder
// app.use(`${API_BASE_URL}/quotes`, quoteRoutes); // Placeholder

// Test Route at root
app.get("/", (req, res) => {
  res.send("Invest Dashboard Backend is running!");
});

// Global error handler (optional, can be more specific)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});

const PORT = process.env.PORT || 3001;

// Test DB connection before starting server (optional but good practice)
async function startServer() {
  try {
    const connection = await pool.getConnection();
    console.log("Successfully connected to the database.");
    connection.release();
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`API available at http://localhost:${PORT}${API_BASE_URL}`);
    });
  } catch (error) {
    console.error("Failed to connect to the database. Server not started.", error);
    process.exit(1); // Exit if DB connection fails
  }
}

startServer();

module.exports = app;

