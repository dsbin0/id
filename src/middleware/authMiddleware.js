const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const User = require("../models/User");

dotenv.config();
const JWT_SECRET = process.env.JWT_SECRET;

const authMiddleware = async (req, res, next) => {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ message: "Acesso não autorizado. Nenhum token fornecido." });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // Attach user information to the request object
    // Optionally, fetch fresh user data from DB to ensure it's up-to-date
    const user = await User.findById(decoded.id);
    if (!user) {
        return res.status(401).json({ message: "Acesso não autorizado. Usuário não encontrado." });
    }
    // Remove password from user object before attaching to request
    const { password, ...userWithoutPassword } = user;
    req.user = userWithoutPassword; 
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token expirado. Faça login novamente." });
    }
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ message: "Token inválido." });
    }
    console.error("Erro na autenticação do token:", error);
    return res.status(500).json({ message: "Erro interno ao verificar token." });
  }
};

module.exports = authMiddleware;

