const User = require("../models/User");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = "1h"; // Token expiration time
const COOKIE_EXPIRES_IN = 1 * 60 * 60 * 1000; // 1 hour in milliseconds for cookie

const authController = {
  async register(req, res) {
    try {
      const { name, email, password } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({ message: "Nome, email e senha são obrigatórios." });
      }

      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        return res.status(409).json({ message: "Email já cadastrado." });
      }

      const newUser = await User.create(name, email, password);

      // Generate JWT
      const token = jwt.sign({ id: newUser.id, email: newUser.email }, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
      });

      // Send JWT in an HTTP-only cookie
      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production", // Use secure cookies in production
        sameSite: "Strict", // Or 'Lax'
        maxAge: COOKIE_EXPIRES_IN,
      });

      res.status(201).json({
        message: "Usuário registrado com sucesso!",
        user: { id: newUser.id, name: newUser.name, email: newUser.email },
        token: token, // Also sending token in response as per frontend api.js (can be removed if frontend only relies on cookie)
      });
    } catch (error) {
      console.error("Erro no registro:", error);
      res.status(500).json({ message: "Erro interno do servidor ao registrar usuário." });
    }
  },

  async login(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email e senha são obrigatórios." });
      }

      const user = await User.findByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Credenciais inválidas." }); // Generic message
      }

      const isMatch = await User.comparePassword(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ message: "Credenciais inválidas." }); // Generic message
      }

      // Generate JWT
      const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
      });

      // Send JWT in an HTTP-only cookie
      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "Strict",
        maxAge: COOKIE_EXPIRES_IN,
      });

      // Return user info and token (frontend might use this to set state immediately)
      res.status(200).json({
        message: "Login bem-sucedido!",
        user: { id: user.id, name: user.name, email: user.email },
        token: token, // Also sending token in response as per frontend api.js
      });
    } catch (error) {
      console.error("Erro no login:", error);
      res.status(500).json({ message: "Erro interno do servidor ao fazer login." });
    }
  },

  async logout(req, res) {
    try {
      // Clear the cookie by setting it to an empty value and expiring it immediately
      res.cookie("token", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "Strict",
        expires: new Date(0), // Expire immediately
      });
      res.status(200).json({ message: "Logout bem-sucedido." });
    } catch (error) {
      console.error("Erro no logout:", error);
      res.status(500).json({ message: "Erro interno do servidor ao fazer logout." });
    }
  },

  async getProfile(req, res) {
    // req.user is populated by the authMiddleware
    if (!req.user) {
        return res.status(401).json({ message: "Não autorizado. Token inválido ou ausente." });
    }
    try {
        // Fetch fresh user data if needed, or just return what's in req.user
        // For simplicity, we return the data from the token (which is set in authMiddleware)
        // If more data is needed, User.findById(req.user.id) can be called.
        const userProfile = await User.findById(req.user.id);
        if (!userProfile) {
            return res.status(404).json({ message: "Usuário não encontrado." });
        }
        res.status(200).json(userProfile);
    } catch (error) {
        console.error("Erro ao buscar perfil do usuário:", error);
        res.status(500).json({ message: "Erro interno do servidor ao buscar perfil." });
    }
  }
};

module.exports = authController;

