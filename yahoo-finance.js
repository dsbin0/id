// Arquivo para gerenciar as requisições à API do Yahoo Finance
const axios = require('axios');

// Função para buscar cotação de um ativo
async function getQuote(ticker) {
  try {
    // Adicionar sufixo .SA para ações brasileiras se não estiver presente
    if (ticker.includes('BR:') && !ticker.includes('.SA')) {
      ticker = ticker.replace('BR:', '') + '.SA';
    }
    
    // Remover prefixo BR: ou US: se presente
    ticker = ticker.replace('BR:', '').replace('US:', '');
    
    const response = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d`);
    
    if (response.data && response.data.chart && response.data.chart.result) {
      const result = response.data.chart.result[0];
      return {
        ticker: ticker,
        price: result.meta.regularMarketPrice,
        previousClose: result.meta.previousClose,
        change: result.meta.regularMarketPrice - result.meta.previousClose,
        changePercent: ((result.meta.regularMarketPrice - result.meta.previousClose) / result.meta.previousClose) * 100,
        currency: result.meta.currency,
        timestamp: result.meta.regularMarketTime * 1000 // Converter para milissegundos
      };
    } else {
      throw new Error('Cotação não encontrada');
    }
  } catch (error) {
    console.error(`Erro ao buscar cotação para ${ticker}:`, error.message);
    throw error;
  }
}

// Função para buscar taxa de câmbio USD/BRL
async function getExchangeRate() {
  try {
    const response = await axios.get('https://query1.finance.yahoo.com/v8/finance/chart/USDBRL=X?interval=1d');
    
    if (response.data && response.data.chart && response.data.chart.result) {
      const result = response.data.chart.result[0];
      return {
        rate: result.meta.regularMarketPrice,
        timestamp: result.meta.regularMarketTime * 1000 // Converter para milissegundos
      };
    } else {
      throw new Error('Taxa de câmbio não encontrada');
    }
  } catch (error) {
    console.error('Erro ao buscar taxa de câmbio:', error.message);
    throw error;
  }
}

// Função para buscar histórico de preços
async function getPriceHistory(ticker, period = '1mo') {
  try {
    // Adicionar sufixo .SA para ações brasileiras se não estiver presente
    if (ticker.includes('BR:') && !ticker.includes('.SA')) {
      ticker = ticker.replace('BR:', '') + '.SA';
    }
    
    // Remover prefixo BR: ou US: se presente
    ticker = ticker.replace('BR:', '').replace('US:', '');
    
    const response = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=${period}`);
    
    if (response.data && response.data.chart && response.data.chart.result) {
      const result = response.data.chart.result[0];
      const timestamps = result.timestamp;
      const quotes = result.indicators.quote[0];
      
      // Mapear timestamps e preços de fechamento
      const history = timestamps.map((timestamp, index) => {
        return {
          date: timestamp * 1000, // Converter para milissegundos
          price: quotes.close[index]
        };
      }).filter(item => item.price !== null); // Remover entradas sem preço
      
      return {
        ticker: ticker,
        currency: result.meta.currency,
        history: history
      };
    } else {
      throw new Error('Histórico de preços não encontrado');
    }
  } catch (error) {
    console.error(`Erro ao buscar histórico de preços para ${ticker}:`, error.message);
    throw error;
  }
}

// Função para buscar informações de múltiplos ativos de uma vez
async function getMultipleQuotes(tickers) {
  try {
    const promises = tickers.map(ticker => getQuote(ticker).catch(error => {
      console.error(`Erro ao buscar ${ticker}:`, error.message);
      return null; // Retornar null para não interromper o Promise.all
    }));
    
    const results = await Promise.all(promises);
    return results.filter(result => result !== null); // Filtrar resultados nulos
  } catch (error) {
    console.error('Erro ao buscar múltiplas cotações:', error.message);
    throw error;
  }
}

module.exports = {
  getQuote,
  getExchangeRate,
  getPriceHistory,
  getMultipleQuotes
};
