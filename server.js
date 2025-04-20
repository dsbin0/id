// Arquivo principal para o backend do Invest Dashboard
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

// Configuração do app Express
const app = express();
app.use(cors({
  origin: ['https://diegosabino.com.br', 'https://www.diegosabino.com.br'],
  credentials: true
}));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Configuração do banco de dados
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'invest_dashboard',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Pool de conexões com o banco de dados
const pool = mysql.createPool(dbConfig);

// Middleware para verificar o token JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ message: 'Token não fornecido' });
  
  jwt.verify(token, process.env.JWT_SECRET || 'invest_dashboard_secret', (err, user) => {
    if (err) return res.status(403).json({ message: 'Token inválido' });
    req.user = user;
    next();
  });
};

// Rotas de autenticação
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    // Validação básica
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Todos os campos são obrigatórios' });
    }
    
    // Verificar se o email já está em uso
    const [existingUsers] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (existingUsers.length > 0) {
      return res.status(400).json({ message: 'Este email já está em uso' });
    }
    
    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Inserir novo usuário
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
      [name, email, hashedPassword]
    );
    
    // Gerar token JWT
    const token = jwt.sign(
      { id: result.insertId, name, email },
      process.env.JWT_SECRET || 'invest_dashboard_secret',
      { expiresIn: '24h' }
    );
    
    res.status(201).json({
      message: 'Usuário registrado com sucesso',
      token,
      user: { id: result.insertId, name, email }
    });
  } catch (error) {
    console.error('Erro ao registrar usuário:', error);
    res.status(500).json({ message: 'Erro ao registrar usuário' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validação básica
    if (!email || !password) {
      return res.status(400).json({ message: 'Email e senha são obrigatórios' });
    }
    
    // Buscar usuário pelo email
    const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(401).json({ message: 'Credenciais inválidas' });
    }
    
    const user = users[0];
    
    // Verificar senha
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Credenciais inválidas' });
    }
    
    // Gerar token JWT
    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email },
      process.env.JWT_SECRET || 'invest_dashboard_secret',
      { expiresIn: '24h' }
    );
    
    res.json({
      message: 'Login realizado com sucesso',
      token,
      user: { id: user.id, name: user.name, email: user.email }
    });
  } catch (error) {
    console.error('Erro ao fazer login:', error);
    res.status(500).json({ message: 'Erro ao fazer login' });
  }
});

// Rotas para investimentos
app.get('/api/investments', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const [investments] = await pool.query(
      `SELECT i.*, c.name as category_name, c.is_foreign 
       FROM investments i 
       JOIN investment_categories c ON i.category_id = c.id 
       WHERE i.user_id = ?`,
      [userId]
    );
    
    res.json(investments);
  } catch (error) {
    console.error('Erro ao buscar investimentos:', error);
    res.status(500).json({ message: 'Erro ao buscar investimentos' });
  }
});

app.get('/api/investments/category/:categoryId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const categoryId = req.params.categoryId;
    
    const [investments] = await pool.query(
      `SELECT i.*, c.name as category_name, c.is_foreign 
       FROM investments i 
       JOIN investment_categories c ON i.category_id = c.id 
       WHERE i.user_id = ? AND i.category_id = ?`,
      [userId, categoryId]
    );
    
    res.json(investments);
  } catch (error) {
    console.error('Erro ao buscar investimentos por categoria:', error);
    res.status(500).json({ message: 'Erro ao buscar investimentos por categoria' });
  }
});

app.post('/api/investments', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      category_id, ticker, name, quantity, 
      purchase_price, purchase_date, notes 
    } = req.body;
    
    // Validação básica
    if (!category_id || !ticker || !name || !quantity || !purchase_price || !purchase_date) {
      return res.status(400).json({ message: 'Todos os campos obrigatórios devem ser preenchidos' });
    }
    
    // Inserir novo investimento
    const [result] = await pool.query(
      `INSERT INTO investments 
       (user_id, category_id, ticker, name, quantity, purchase_price, purchase_date, notes) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, category_id, ticker, name, quantity, purchase_price, purchase_date, notes || null]
    );
    
    // Buscar o investimento recém-criado
    const [investments] = await pool.query(
      `SELECT i.*, c.name as category_name, c.is_foreign 
       FROM investments i 
       JOIN investment_categories c ON i.category_id = c.id 
       WHERE i.id = ?`,
      [result.insertId]
    );
    
    res.status(201).json({
      message: 'Investimento adicionado com sucesso',
      investment: investments[0]
    });
  } catch (error) {
    console.error('Erro ao adicionar investimento:', error);
    res.status(500).json({ message: 'Erro ao adicionar investimento' });
  }
});

app.put('/api/investments/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const investmentId = req.params.id;
    const { 
      category_id, ticker, name, quantity, 
      purchase_price, purchase_date, notes 
    } = req.body;
    
    // Validação básica
    if (!category_id || !ticker || !name || !quantity || !purchase_price || !purchase_date) {
      return res.status(400).json({ message: 'Todos os campos obrigatórios devem ser preenchidos' });
    }
    
    // Verificar se o investimento pertence ao usuário
    const [existingInvestments] = await pool.query(
      'SELECT * FROM investments WHERE id = ? AND user_id = ?',
      [investmentId, userId]
    );
    
    if (existingInvestments.length === 0) {
      return res.status(404).json({ message: 'Investimento não encontrado' });
    }
    
    // Atualizar investimento
    await pool.query(
      `UPDATE investments 
       SET category_id = ?, ticker = ?, name = ?, quantity = ?, 
           purchase_price = ?, purchase_date = ?, notes = ? 
       WHERE id = ? AND user_id = ?`,
      [category_id, ticker, name, quantity, purchase_price, purchase_date, notes || null, investmentId, userId]
    );
    
    // Buscar o investimento atualizado
    const [investments] = await pool.query(
      `SELECT i.*, c.name as category_name, c.is_foreign 
       FROM investments i 
       JOIN investment_categories c ON i.category_id = c.id 
       WHERE i.id = ?`,
      [investmentId]
    );
    
    res.json({
      message: 'Investimento atualizado com sucesso',
      investment: investments[0]
    });
  } catch (error) {
    console.error('Erro ao atualizar investimento:', error);
    res.status(500).json({ message: 'Erro ao atualizar investimento' });
  }
});

app.delete('/api/investments/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const investmentId = req.params.id;
    
    // Verificar se o investimento pertence ao usuário
    const [existingInvestments] = await pool.query(
      'SELECT * FROM investments WHERE id = ? AND user_id = ?',
      [investmentId, userId]
    );
    
    if (existingInvestments.length === 0) {
      return res.status(404).json({ message: 'Investimento não encontrado' });
    }
    
    // Excluir investimento
    await pool.query(
      'DELETE FROM investments WHERE id = ? AND user_id = ?',
      [investmentId, userId]
    );
    
    res.json({ message: 'Investimento excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir investimento:', error);
    res.status(500).json({ message: 'Erro ao excluir investimento' });
  }
});

// Rota para buscar categorias de investimento
app.get('/api/categories', authenticateToken, async (req, res) => {
  try {
    const [categories] = await pool.query('SELECT * FROM investment_categories');
    res.json(categories);
  } catch (error) {
    console.error('Erro ao buscar categorias:', error);
    res.status(500).json({ message: 'Erro ao buscar categorias' });
  }
});

// Rota para buscar cotações via Yahoo Finance API
app.get('/api/quotes/:ticker', authenticateToken, async (req, res) => {
  try {
    const ticker = req.params.ticker;
    
    // Fazer requisição para a API do Yahoo Finance
    const response = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d`);
    
    if (response.data && response.data.chart && response.data.chart.result) {
      const result = response.data.chart.result[0];
      const quote = {
        ticker: ticker,
        price: result.meta.regularMarketPrice,
        previousClose: result.meta.previousClose,
        change: result.meta.regularMarketPrice - result.meta.previousClose,
        changePercent: ((result.meta.regularMarketPrice - result.meta.previousClose) / result.meta.previousClose) * 100,
        currency: result.meta.currency,
        timestamp: result.meta.regularMarketTime * 1000 // Converter para milissegundos
      };
      
      res.json(quote);
    } else {
      res.status(404).json({ message: 'Cotação não encontrada' });
    }
  } catch (error) {
    console.error('Erro ao buscar cotação:', error);
    res.status(500).json({ message: 'Erro ao buscar cotação' });
  }
});

// Rota para buscar taxa de câmbio USD/BRL
app.get('/api/exchange-rate/usd-brl', authenticateToken, async (req, res) => {
  try {
    // Fazer requisição para a API do Yahoo Finance
    const response = await axios.get('https://query1.finance.yahoo.com/v8/finance/chart/USDBRL=X?interval=1d');
    
    if (response.data && response.data.chart && response.data.chart.result) {
      const result = response.data.chart.result[0];
      const exchangeRate = {
        rate: result.meta.regularMarketPrice,
        timestamp: result.meta.regularMarketTime * 1000 // Converter para milissegundos
      };
      
      res.json(exchangeRate);
    } else {
      res.status(404).json({ message: 'Taxa de câmbio não encontrada' });
    }
  } catch (error) {
    console.error('Erro ao buscar taxa de câmbio:', error);
    res.status(500).json({ message: 'Erro ao buscar taxa de câmbio' });
  }
});

// Rota para o frontend (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Iniciar o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

module.exports = app;
