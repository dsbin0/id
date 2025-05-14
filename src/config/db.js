const mysql = require("mysql2/promise");
const dotenv = require("dotenv");

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Test the connection
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log("Successfully connected to the database.");
    connection.release();
  } catch (error) {
    console.error("Error connecting to the database:", error);
    // Exit process if DB connection fails during startup in a real scenario
    // process.exit(1);
  }
}

// Call testConnection only if this file is run directly (e.g., for testing setup)
// or call it once when the application starts in app.js
// For now, we can call it here to see the log during development setup.
// In a production app, you might want to integrate this check more formally.
if (require.main === module) {
  testConnection();
}

module.exports = pool;

