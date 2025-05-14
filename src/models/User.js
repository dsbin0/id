const pool = require("../config/db");
const bcrypt = require("bcryptjs");

const User = {
  async create(name, email, password) {
    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
      [name, email, hashedPassword]
    );
    return { id: result.insertId, name, email };
  },

  async findByEmail(email) {
    const [rows] = await pool.query("SELECT * FROM users WHERE email = ?", [
      email,
    ]);
    return rows[0];
  },

  async findById(id) {
    const [rows] = await pool.query("SELECT id, name, email, created_at, updated_at FROM users WHERE id = ?", [
      id,
    ]);
    return rows[0];
  },

  async comparePassword(candidatePassword, hashedPassword) {
    return bcrypt.compare(candidatePassword, hashedPassword);
  },
};

module.exports = User;

