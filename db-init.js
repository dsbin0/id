// Arquivo para inicialização do banco de dados
const mysql = require("mysql2/promise");
require("dotenv").config();

// Configuração do banco de dados (usar as mesmas variáveis de ambiente do server.js)
const dbConfig = {
  host: process.env.DB_HOST || "108.179.253.27", // Alinhado com server.js
  user: process.env.DB_USER || "mar11704_diegosabino", // Alinhado com server.js
  password: process.env.DB_PASSWORD || "wM96jpk6JsKpFMh", // Alinhado com server.js
  multipleStatements: true // Permitir múltiplas queries em uma única execução
};

const DB_NAME_INIT = process.env.DB_NAME || "mar11704_id"; // Alinhado com server.js

// SQL para criar o banco de dados e tabelas
const setupSQL = `
CREATE DATABASE IF NOT EXISTS ${DB_NAME_INIT};
USE ${DB_NAME_INIT};

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
    is_foreign BOOLEAN DEFAULT FALSE, -- Indica se a categoria é tipicamente em moeda estrangeira (ex: USD)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Inserção das categorias padrão (apenas se a tabela estiver vazia)
INSERT INTO investment_categories (id, name, description, is_foreign)
SELECT * FROM (
    SELECT 1 as id, 'Ações BR' as name, 'Ações de empresas brasileiras' as description, FALSE as is_foreign
    UNION SELECT 2, 'Ações US', 'Ações de empresas americanas', TRUE
    UNION SELECT 3, 'FIIs', 'Fundos de Investimento Imobiliário', FALSE
    UNION SELECT 4, 'Renda Fixa', 'Investimentos de renda fixa como CDBs, Tesouro Direto, etc', FALSE
    UNION SELECT 5, 'Cripto', 'Criptomoedas', TRUE -- Criptos são consideradas em USD para conversão
) AS tmp
WHERE NOT EXISTS (
    SELECT 1 FROM investment_categories WHERE id IN (1,2,3,4,5)
);

-- Tabela de Investimentos
CREATE TABLE IF NOT EXISTS investments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    category_id INT NOT NULL,
    ticker VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    quantity DECIMAL(20,8) NOT NULL, -- Aumentada precisão para cripto
    purchase_price DECIMAL(20,8) NOT NULL, -- Aumentada precisão para cripto
    purchase_date DATE NOT NULL,
    exchange_rate DECIMAL(15,6) NULL, -- Taxa de câmbio no momento da compra (para ativos em moeda estrangeira)
    current_price DECIMAL(20,8) NULL, -- Preço atual do ativo (na moeda original)
    last_update TIMESTAMP NULL, -- Última atualização do current_price
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES investment_categories(id)
);

-- Tabela de Histórico de Preços (Opcional, não implementada nas rotas atuais)
CREATE TABLE IF NOT EXISTS price_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    investment_id INT NOT NULL,
    price DECIMAL(20,8) NOT NULL,
    date TIMESTAMP NOT NULL,
    FOREIGN KEY (investment_id) REFERENCES investments(id) ON DELETE CASCADE
);

-- Tabela de Taxas de Câmbio (Opcional, Yahoo Finance é usado diretamente por enquanto)
CREATE TABLE IF NOT EXISTS exchange_rates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    from_currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    to_currency VARCHAR(3) NOT NULL DEFAULT 'BRL',
    rate DECIMAL(15,6) NOT NULL,
    date TIMESTAMP NOT NULL,
    UNIQUE KEY (from_currency, to_currency, date)
);
`;

// Função para inicializar o banco de dados
async function initializeDatabase() {
  let connection;
  
  try {
    console.log(`Conectando ao MySQL em ${dbConfig.host} para inicialização...`);
    connection = await mysql.createConnection(dbConfig);
    
    console.log(`Executando script de inicialização no banco de dados ${DB_NAME_INIT}...`);
    await connection.query(setupSQL);
    
    console.log("Banco de dados inicializado com sucesso!");
  } catch (error) {
    console.error("Erro ao inicializar o banco de dados:", error);
    // Não lançar erro aqui para permitir que o servidor inicie mesmo se o DB já existir / falhar a init
    // O servidor tentará se conectar com o pool de qualquer maneira.
  } finally {
    if (connection) {
      await connection.end();
      console.log("Conexão de inicialização encerrada.");
    }
  }
}

// Executar a inicialização se este arquivo for executado diretamente
// E apenas se uma variável de ambiente específica for definida, para evitar execuções acidentais
if (require.main === module && process.env.RUN_DB_INIT === "true") {
  initializeDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("Falha crítica na inicialização do DB:", err);
        process.exit(1);
    });
} else if (require.main === module) {
    console.log("Para executar a inicialização do banco de dados, defina a variável de ambiente RUN_DB_INIT=true");
    process.exit(0);
}

module.exports = { initializeDatabase };

