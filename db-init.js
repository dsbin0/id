// Arquivo para inicialização do banco de dados
const mysql = require('mysql2/promise');
require('dotenv').config();

// Configuração do banco de dados
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  multipleStatements: true // Permitir múltiplas queries em uma única execução
};

// SQL para criar o banco de dados e tabelas
const setupSQL = `
CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME || 'invest_dashboard'};
USE ${process.env.DB_NAME || 'invest_dashboard'};

-- Tabela de Usuários
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tabela de Categorias de Investimento
CREATE TABLE IF NOT EXISTS investment_categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    description VARCHAR(255),
    is_foreign BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Inserção das categorias padrão (apenas se a tabela estiver vazia)
INSERT INTO investment_categories (name, description, is_foreign)
SELECT * FROM (
    SELECT 'Ações BR' as name, 'Ações de empresas brasileiras' as description, FALSE as is_foreign
    UNION SELECT 'Ações US', 'Ações de empresas americanas', TRUE
    UNION SELECT 'FIIs', 'Fundos de Investimento Imobiliário', FALSE
    UNION SELECT 'Renda Fixa', 'Investimentos de renda fixa como CDBs, Tesouro Direto, etc', FALSE
    UNION SELECT 'Cripto', 'Criptomoedas', FALSE
) AS tmp
WHERE NOT EXISTS (
    SELECT name FROM investment_categories
) LIMIT 1;

-- Tabela de Investimentos
CREATE TABLE IF NOT EXISTS investments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    category_id INT NOT NULL,
    ticker VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    quantity DECIMAL(15,6) NOT NULL,
    purchase_price DECIMAL(15,2) NOT NULL,
    purchase_date DATE NOT NULL,
    current_price DECIMAL(15,2),
    last_update TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES investment_categories(id)
);

-- Tabela de Histórico de Preços
CREATE TABLE IF NOT EXISTS price_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    investment_id INT NOT NULL,
    price DECIMAL(15,2) NOT NULL,
    date TIMESTAMP NOT NULL,
    FOREIGN KEY (investment_id) REFERENCES investments(id) ON DELETE CASCADE
);

-- Tabela de Taxas de Câmbio
CREATE TABLE IF NOT EXISTS exchange_rates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    from_currency VARCHAR(3) NOT NULL,
    to_currency VARCHAR(3) NOT NULL,
    rate DECIMAL(15,6) NOT NULL,
    date TIMESTAMP NOT NULL,
    INDEX (from_currency, to_currency, date)
);
`;

// Função para inicializar o banco de dados
async function initializeDatabase() {
  let connection;
  
  try {
    console.log('Conectando ao MySQL...');
    connection = await mysql.createConnection(dbConfig);
    
    console.log('Executando script de inicialização...');
    await connection.query(setupSQL);
    
    console.log('Banco de dados inicializado com sucesso!');
  } catch (error) {
    console.error('Erro ao inicializar o banco de dados:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('Conexão encerrada.');
    }
  }
}

// Executar a inicialização se este arquivo for executado diretamente
if (require.main === module) {
  initializeDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { initializeDatabase };
