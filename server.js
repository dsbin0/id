// Arquivo principal para o backend do Invest Dashboard
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const axios = require("axios"); // Mantido para chamadas ao Yahoo Finance
const path = require("path");
const cookieParser = require("cookie-parser"); // Adicionado para manipulação de cookies
require("dotenv").config();

// Configuração do app Express
const app = express();

// Configuração do CORS - DEVE permitir a origem do seu frontend e credentials
const allowedOrigins = [
    "https://diegosabino.com.br", 
    "https://www.diegosabino.com.br",
    // Adicione aqui a URL do seu ambiente de desenvolvimento frontend, se diferente
    // Ex: "http://localhost:xxxx" ou a URL fornecida pelo CodeSandbox/Gitpod, etc.
];

app.use(cors({
  origin: function (origin, callback) {
    // Permitir requisições sem origin (ex: mobile apps, curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = "A política de CORS para este site não permite acesso da origem especificada.";
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true
}));

app.use(bodyParser.json());
app.use(cookieParser()); // Adicionado middleware de cookie-parser

// Servir arquivos estáticos do frontend (ajuste o caminho se necessário)
// Em produção, é comum o frontend ser servido por um web server dedicado (Nginx, Apache) ou CDN.
// Se o backend e frontend estão no mesmo domínio/servidor, isso pode ser útil.
// app.use(express.static(path.join(__dirname, "../frontend/V6_Corrigida"))); // Exemplo de caminho

// Configuração do banco de dados
const dbConfig = {
  host: process.env.DB_HOST || "108.179.253.27",
  user: process.env.DB_USER || "mar11704_diegosabino",
  password: process.env.DB_PASSWORD || "wM96jpk6JsKpFMh",
  database: process.env.DB_NAME || "mar11704_id",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : null // Adicionar suporte SSL se necessário
};

// Pool de conexões com o banco de dados
const pool = mysql.createPool(dbConfig);

const JWT_SECRET = process.env.JWT_SECRET || "invest_dashboard_secret";
const NODE_ENV = process.env.NODE_ENV || "development";

// Middleware para verificar o token JWT a partir do cookie
const authenticateToken = (req, res, next) => {
  const token = req.cookies.jwtToken; // Ler o token do cookie chamado "jwtToken"
  
  if (!token) return res.status(401).json({ message: "Token não fornecido. Acesso não autorizado." });
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
        if (err.name === "TokenExpiredError") {
            return res.status(401).json({ message: "Token expirado. Por favor, faça login novamente." });
        }
        return res.status(403).json({ message: "Token inválido." });
    }
    req.user = user; // Adiciona os dados do usuário decodificados à requisição
    next();
  });
};

// Rotas de autenticação
app.post("/api/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Todos os campos são obrigatórios" });
    }
    if (password.length < 8 || !/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/.test(password)) {
        return res.status(400).json({ message: "A senha deve ter pelo menos 8 caracteres, incluindo letras e números." });
    }

    const [existingUsers] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);
    if (existingUsers.length > 0) {
      return res.status(409).json({ message: "Este email já está em uso" }); // 409 Conflict
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
      [name, email, hashedPassword]
    );
    
    // Não enviar token nem dados do usuário na resposta de registro para segurança.
    // O usuário deve fazer login após o registro.
    res.status(201).json({
      message: "Usuário registrado com sucesso! Por favor, faça login."
      // Não retornar token ou user aqui, forçar login
    });
  } catch (error) {
    console.error("Erro ao registrar usuário:", error);
    res.status(500).json({ message: "Erro interno ao registrar usuário" });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email e senha são obrigatórios" });
    }
    
    const [users] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);
    if (users.length === 0) {
      return res.status(401).json({ message: "Credenciais inválidas" });
    }
    
    const user = users[0];
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Credenciais inválidas" });
    }
    
    const tokenPayload = { id: user.id, name: user.name, email: user.email };
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: "24h" });
    
    // Configurar cookie HTTP-only
    res.cookie("jwtToken", token, {
      httpOnly: true,
      secure: NODE_ENV === "production", // Usar true em produção (HTTPS)
      sameSite: "Strict", // Ou "Lax" dependendo da necessidade e de fluxos OAuth/SAML
      maxAge: 24 * 60 * 60 * 1000 // 24 horas em milissegundos
    });
    
    res.json({
      message: "Login realizado com sucesso",
      user: tokenPayload // Enviar dados do usuário para o frontend popular o estado
    });
  } catch (error) {
    console.error("Erro ao fazer login:", error);
    res.status(500).json({ message: "Erro interno ao fazer login" });
  }
});

app.post("/api/logout", (req, res) => {
  res.cookie("jwtToken", "", {
    httpOnly: true,
    secure: NODE_ENV === "production",
    sameSite: "Strict",
    expires: new Date(0) // Expira o cookie imediatamente
  });
  res.status(200).json({ message: "Logout realizado com sucesso" });
});

// Rota para verificar o status da autenticação (opcional, mas útil para o frontend)
app.get("/api/user/profile", authenticateToken, (req, res) => {
    // O middleware authenticateToken já validou o token e adicionou req.user
    // Retornar os dados do usuário que estavam no token
    res.json(req.user);
});

// Rotas para investimentos (protegidas)
app.get("/api/investments", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const [investments] = await pool.query(
      `SELECT i.*, c.name as category_name, c.is_foreign 
       FROM investments i 
       JOIN investment_categories c ON i.category_id = c.id 
       WHERE i.user_id = ? ORDER BY i.purchase_date DESC, i.name ASC`,
      [userId]
    );
    res.json(investments);
  } catch (error) {
    console.error("Erro ao buscar investimentos:", error);
    res.status(500).json({ message: "Erro interno ao buscar investimentos" });
  }
});

app.get("/api/investments/category/:categoryId", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const categoryId = req.params.categoryId;
    const [investments] = await pool.query(
      `SELECT i.*, c.name as category_name, c.is_foreign 
       FROM investments i 
       JOIN investment_categories c ON i.category_id = c.id 
       WHERE i.user_id = ? AND i.category_id = ? ORDER BY i.purchase_date DESC, i.name ASC`,
      [userId, categoryId]
    );
    res.json(investments);
  } catch (error) {
    console.error("Erro ao buscar investimentos por categoria:", error);
    res.status(500).json({ message: "Erro interno ao buscar investimentos por categoria" });
  }
});

app.post("/api/investments", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { category_id, ticker, name, quantity, purchase_price, purchase_date, notes, exchange_rate } = req.body;
    if (!category_id || !ticker || !name || !quantity || !purchase_price || !purchase_date) {
      return res.status(400).json({ message: "Todos os campos obrigatórios devem ser preenchidos" });
    }
    
    // Adicionar exchange_rate ao insert se fornecido (para Ações US e Cripto)
    const [result] = await pool.query(
      `INSERT INTO investments 
       (user_id, category_id, ticker, name, quantity, purchase_price, purchase_date, notes, exchange_rate) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, category_id, ticker, name, quantity, purchase_price, purchase_date, notes || null, exchange_rate || null]
    );
    
    const [newInvestment] = await pool.query(
      `SELECT i.*, c.name as category_name, c.is_foreign 
       FROM investments i 
       JOIN investment_categories c ON i.category_id = c.id 
       WHERE i.id = ?`,
      [result.insertId]
    );
    res.status(201).json({ message: "Investimento adicionado com sucesso", investment: newInvestment[0] });
  } catch (error) {
    console.error("Erro ao adicionar investimento:", error);
    res.status(500).json({ message: "Erro interno ao adicionar investimento" });
  }
});

app.put("/api/investments/:id", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const investmentId = req.params.id;
    const { category_id, ticker, name, quantity, purchase_price, purchase_date, notes, exchange_rate } = req.body;
    if (!category_id || !ticker || !name || !quantity || !purchase_price || !purchase_date) {
      return res.status(400).json({ message: "Todos os campos obrigatórios devem ser preenchidos" });
    }
    
    const [existing] = await pool.query("SELECT * FROM investments WHERE id = ? AND user_id = ?", [investmentId, userId]);
    if (existing.length === 0) {
      return res.status(404).json({ message: "Investimento não encontrado ou não pertence ao usuário" });
    }
    
    await pool.query(
      `UPDATE investments 
       SET category_id = ?, ticker = ?, name = ?, quantity = ?, 
           purchase_price = ?, purchase_date = ?, notes = ?, exchange_rate = ? 
       WHERE id = ? AND user_id = ?`,
      [category_id, ticker, name, quantity, purchase_price, purchase_date, notes || null, exchange_rate || null, investmentId, userId]
    );
    
    const [updatedInvestment] = await pool.query(
      `SELECT i.*, c.name as category_name, c.is_foreign 
       FROM investments i 
       JOIN investment_categories c ON i.category_id = c.id 
       WHERE i.id = ?`,
      [investmentId]
    );
    res.json({ message: "Investimento atualizado com sucesso", investment: updatedInvestment[0] });
  } catch (error) {
    console.error("Erro ao atualizar investimento:", error);
    res.status(500).json({ message: "Erro interno ao atualizar investimento" });
  }
});

app.delete("/api/investments/:id", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const investmentId = req.params.id;
    const [existing] = await pool.query("SELECT * FROM investments WHERE id = ? AND user_id = ?", [investmentId, userId]);
    if (existing.length === 0) {
      return res.status(404).json({ message: "Investimento não encontrado ou não pertence ao usuário" });
    }
    
    await pool.query("DELETE FROM investments WHERE id = ? AND user_id = ?", [investmentId, userId]);
    res.status(200).json({ message: "Investimento excluído com sucesso" }); // 200 OK ou 204 No Content
  } catch (error) {
    console.error("Erro ao excluir investimento:", error);
    res.status(500).json({ message: "Erro interno ao excluir investimento" });
  }
});

// Rota para buscar categorias de investimento
app.get("/api/categories", authenticateToken, async (req, res) => {
  try {
    const [categories] = await pool.query("SELECT * FROM investment_categories ORDER BY id ASC");
    res.json(categories);
  } catch (error) {
    console.error("Erro ao buscar categorias:", error);
    res.status(500).json({ message: "Erro interno ao buscar categorias" });
  }
});

// Funções auxiliares do Yahoo Finance (movidas para cá ou importadas de yahoo-finance.js)
// Para simplificar, vou replicar a lógica aqui, mas idealmente seria importada.
async function getYahooQuote(ticker) {
    // Adicionar sufixo .SA para ações brasileiras se não estiver presente e não for FII (que já tem .SA)
    // Criptos são X-USD
    let effectiveTicker = ticker;
    if (!ticker.endsWith(".SA") && !ticker.includes("-USD") && ticker.length <= 5) { // Heurística para Ações BR
        effectiveTicker = `${ticker}.SA`;
    }

    try {
        const response = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${effectiveTicker}?interval=1d`);
        if (response.data && response.data.chart && response.data.chart.result && response.data.chart.result.length > 0) {
            const result = response.data.chart.result[0];
            return {
                ticker: ticker, // Retornar o ticker original solicitado pelo frontend
                price: result.meta.regularMarketPrice,
                previousClose: result.meta.chartPreviousClose || result.meta.previousClose, // Usar chartPreviousClose se disponível
                change: result.meta.regularMarketPrice - (result.meta.chartPreviousClose || result.meta.previousClose),
                changePercent: ((result.meta.regularMarketPrice - (result.meta.chartPreviousClose || result.meta.previousClose)) / (result.meta.chartPreviousClose || result.meta.previousClose)) * 100,
                currency: result.meta.currency,
                timestamp: result.meta.regularMarketTime * 1000
            };
        } else {
            console.warn(`Cotação não encontrada no Yahoo para ${effectiveTicker} (solicitado como ${ticker})`);
            return null; // Retornar null para que o batch possa continuar
        }
    } catch (error) {
        console.error(`Erro ao buscar cotação no Yahoo para ${effectiveTicker} (solicitado como ${ticker}):`, error.message);
        return null; // Retornar null em caso de erro
    }
}

// Rota para buscar cotação única (mantida por compatibilidade, mas desencorajada)
app.get("/api/quotes/:ticker", authenticateToken, async (req, res) => {
  try {
    const ticker = req.params.ticker;
    const quote = await getYahooQuote(ticker);
    if (quote) {
      res.json(quote);
    } else {
      res.status(404).json({ message: `Cotação não encontrada para ${ticker}` });
    }
  } catch (error) {
    // getYahooQuote já loga o erro
    res.status(500).json({ message: `Erro interno ao buscar cotação para ${ticker}` });
  }
});

// ROTA OTIMIZADA PARA BATCH QUOTES
app.post("/api/quotes/batch", authenticateToken, async (req, res) => {
    const { tickers } = req.body;
    if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
        return res.status(400).json({ message: "A lista de tickers é obrigatória." });
    }

    try {
        const quotePromises = tickers.map(ticker => getYahooQuote(ticker));
        const results = await Promise.all(quotePromises);
        
        const quotesMap = {};
        results.forEach((quote, index) => {
            if (quote) {
                quotesMap[quote.ticker] = quote; // Usar o ticker original como chave
            }
            // Se quote for null, o ticker correspondente não será incluído no mapa
        });

        res.json(quotesMap);
    } catch (error) {
        console.error("Erro ao buscar cotações em lote:", error);
        res.status(500).json({ message: "Erro interno ao buscar cotações em lote" });
    }
});

// Rota para buscar taxa de câmbio USD/BRL
app.get("/api/exchange-rate/usd-brl", authenticateToken, async (req, res) => {
  try {
    const response = await axios.get("https://query1.finance.yahoo.com/v8/finance/chart/USDBRL=X?interval=1d");
    if (response.data && response.data.chart && response.data.chart.result && response.data.chart.result.length > 0) {
      const result = response.data.chart.result[0];
      res.json({
        rate: result.meta.regularMarketPrice,
        timestamp: result.meta.regularMarketTime * 1000
      });
    } else {
      res.status(404).json({ message: "Taxa de câmbio não encontrada" });
    }
  } catch (error) {
    console.error("Erro ao buscar taxa de câmbio:", error);
    res.status(500).json({ message: "Erro interno ao buscar taxa de câmbio" });
  }
});

// Rota genérica para servir o index.html do frontend (SPA)
// Deve ser a última rota para não interceptar as rotas da API
// app.get("*", (req, res) => {
//   res.sendFile(path.join(__dirname, "../frontend/V6_Corrigida/index.html"));
// });

// Iniciar o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT} em modo ${NODE_ENV}`);
  console.log(`CORS habilitado para origens: ${allowedOrigins.join(", ")}`);
  console.log(`JWT Secret: ${JWT_SECRET ? "Configurado" : "NÃO CONFIGURADO (usando padrão)"}`);
  console.log(`DB Host: ${dbConfig.host}`);
});

module.exports = app; // Para possíveis testes

