
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const app = express();
app.use(cors());
app.use(express.json());

const SECRET = 'segredo123';

const dbConfig = {
  host: '108.179.253.27',
  user: 'mar11704_diegosabino',
  password: 'wM96jpk6JsKpFMh',
  database: 'mar11704_id',
};

// Middleware de autenticação
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Registro
app.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const hashed = await bcrypt.hash(password, 10);
    const conn = await mysql.createConnection(dbConfig);
    await conn.execute('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', [name, email, hashed]);
    conn.end();
    res.sendStatus(201);
  } catch (err) {
    res.status(500).json({ message: 'Erro ao registrar usuário' });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const conn = await mysql.createConnection(dbConfig);
    const [users] = await conn.execute('SELECT * FROM users WHERE email = ?', [email]);
    conn.end();
    if (users.length === 0) return res.status(400).json({ message: 'Usuário não encontrado' });

    const user = users[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: 'Senha incorreta' });

    const token = jwt.sign({ id: user.id, name: user.name }, SECRET);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch {
    res.status(500).json({ message: 'Erro no login' });
  }
});

// Categorias
app.get('/api/categories', authenticateToken, async (req, res) => {
  try {
    const conn = await mysql.createConnection(dbConfig);
    const [categories] = await conn.execute('SELECT * FROM investment_categories');
    conn.end();
    res.json(categories);
  } catch {
    res.status(500).json({ message: 'Erro ao buscar categorias' });
  }
});

// Adicionar investimento
app.post('/api/investments', authenticateToken, async (req, res) => {
  const { ticker, name, quantity, price, categoryId } = req.body;
  try {
    const conn = await mysql.createConnection(dbConfig);
    await conn.execute(
      'INSERT INTO investments (user_id, category_id, ticker, name, quantity, price) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, categoryId, ticker, name, quantity, price]
    );
    conn.end();
    res.sendStatus(201);
  } catch (err) {
    res.status(500).json({ message: 'Erro ao adicionar investimento' });
  }
});

// Listar investimentos
app.get('/api/investments', authenticateToken, async (req, res) => {
  const categoryId = req.query.categoryId;
  try {
    const conn = await mysql.createConnection(dbConfig);
    const [investments] = await conn.execute(
      `SELECT i.*, c.name AS category_name FROM investments i
       JOIN investment_categories c ON i.category_id = c.id
       WHERE i.user_id = ? AND i.category_id = ?`,
      [req.user.id, categoryId]
    );
    conn.end();
    res.json(investments);
  } catch {
    res.status(500).json({ message: 'Erro ao buscar investimentos por categoria' });
  }
});

// Dashboard - total por categoria
app.get('/api/dashboard', authenticateToken, async (req, res) => {
  try {
    const conn = await mysql.createConnection(dbConfig);
    const [result] = await conn.execute(
      `SELECT c.name AS category, SUM(i.quantity * i.price) AS total
       FROM investments i
       JOIN investment_categories c ON i.category_id = c.id
       WHERE i.user_id = ?
       GROUP BY c.name`, [req.user.id]
    );
    conn.end();
    res.json(result);
  } catch {
    res.status(500).json({ message: 'Erro ao carregar dashboard' });
  }
});

// Iniciar servidor
app.listen(3000, () => {
  console.log('Servidor rodando na porta 3000');
});
