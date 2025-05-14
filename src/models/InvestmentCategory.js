const pool = require("../config/db");

const InvestmentCategory = {
  async getAll() {
    const [rows] = await pool.query("SELECT id, name, description, is_foreign FROM investment_categories ORDER BY id ASC");
    return rows;
  },

  async findById(id) {
    const [rows] = await pool.query("SELECT id, name, description, is_foreign FROM investment_categories WHERE id = ?", [id]);
    return rows[0];
  }
  // Add other methods if needed, e.g., create, update, delete, though not explicitly requested for now.
};

module.exports = InvestmentCategory;

