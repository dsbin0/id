import { Request, Response } from 'express';
import yahooFinance from 'yahoo-finance2';
import { PrismaClient, Currency } from '@prisma/client';

const prisma = new PrismaClient();

interface PriceCache {
  [key: string]: { data: any; timestamp: number };
}

const priceCache: PriceCache = {};
const CACHE_DURATION_MS = 30 * 1000; // 30 seconds

async function getUSDToBRLRate(): Promise<number> {
  const cacheKey = 'USDBRL=X';
  const now = Date.now();

  if (priceCache[cacheKey] && (now - priceCache[cacheKey].timestamp < CACHE_DURATION_MS)) {
    return priceCache[cacheKey].data.regularMarketPrice;
  }

  try {
    const quote = await yahooFinance.quote(cacheKey);
    if (quote && quote.regularMarketPrice) {
      priceCache[cacheKey] = { data: quote, timestamp: now };
      return quote.regularMarketPrice;
    }
    // Fallback or error if Yahoo Finance doesn't return the rate
    // For now, returning a default or throwing an error
    console.warn('Could not fetch USD/BRL rate from Yahoo Finance, using fallback or last known if available');
    if (priceCache[cacheKey]) return priceCache[cacheKey].data.regularMarketPrice; // return stale if available
    return 5.0; // Default fallback, consider a more robust solution
  } catch (error) {
    console.error('Error fetching USD/BRL rate:', error);
    if (priceCache[cacheKey]) return priceCache[cacheKey].data.regularMarketPrice; // return stale if available
    throw new Error('Failed to fetch USD/BRL exchange rate');
  }
}

export const getPrices = async (req: Request, res: Response) => {
  const tickersQuery = req.query.tickers as string;
  if (!tickersQuery) {
    return res.status(400).json({ message: 'Tickers query parameter is required (comma-separated)' });
  }

  const tickers = tickersQuery.split(',');
  const results: any[] = [];
  const now = Date.now();
  let usdToBrlRate: number | null = null;

  try {
    // Attempt to fetch USD/BRL rate once if any USD asset is present or for general conversion
    // This could be optimized to only fetch if a USD ticker is in the list
    usdToBrlRate = await getUSDToBRLRate();
  } catch (error) {
    console.error('Failed to get USD/BRL rate for price conversion:', error);
    // Proceed without USD/BRL rate if it fails, USD prices won't have BRL equivalent
  }

  for (const ticker of tickers) {
    const cacheKey = ticker.toUpperCase();
    if (priceCache[cacheKey] && (now - priceCache[cacheKey].timestamp < CACHE_DURATION_MS)) {
      const cachedData = priceCache[cacheKey].data;
      let priceInBRL = cachedData.regularMarketPrice;
      if (cachedData.currency === 'USD' && usdToBrlRate) {
        priceInBRL = cachedData.regularMarketPrice * usdToBrlRate;
      }
      results.push({ 
        ticker: cachedData.symbol,
        price: cachedData.regularMarketPrice,
        currency: cachedData.currency,
        priceInBRL: cachedData.currency === 'BRL' ? cachedData.regularMarketPrice : (usdToBrlRate ? priceInBRL : null),
        source: 'cache',
        fetchedAt: new Date(priceCache[cacheKey].timestamp).toISOString(),
        usdToBrlRate: usdToBrlRate
      });
      // Update Prisma Price table (fire and forget, or queue for batch update)
      updatePrismaPrice(cachedData.symbol, cachedData.currency, cachedData.regularMarketPrice);
      continue;
    }

    try {
      const quote = await yahooFinance.quote(ticker);
      if (quote && quote.regularMarketPrice && quote.currency) {
        priceCache[cacheKey] = { data: quote, timestamp: now };
        let priceInBRL = quote.regularMarketPrice;
        if (quote.currency === 'USD' && usdToBrlRate) {
          priceInBRL = quote.regularMarketPrice * usdToBrlRate;
        }
        results.push({
          ticker: quote.symbol,
          price: quote.regularMarketPrice,
          currency: quote.currency,
          priceInBRL: quote.currency === 'BRL' ? quote.regularMarketPrice : (usdToBrlRate ? priceInBRL : null),
          source: 'api',
          fetchedAt: new Date(now).toISOString(),
          usdToBrlRate: usdToBrlRate
        });
        // Update Prisma Price table
        updatePrismaPrice(quote.symbol, quote.currency, quote.regularMarketPrice);
      } else {
        // Try to get from DB if API fails or data is incomplete
        const dbPrice = await getPrismaPrice(ticker);
        if(dbPrice) {
            let priceInBRL = dbPrice.last_price;
            if (dbPrice.currency === 'USD' && usdToBrlRate) {
                priceInBRL = dbPrice.last_price * usdToBrlRate;
            }
            results.push({
                ticker: dbPrice.ticker,
                price: dbPrice.last_price,
                currency: dbPrice.currency,
                priceInBRL: dbPrice.currency === 'BRL' ? dbPrice.last_price : (usdToBrlRate ? priceInBRL : null),
                source: 'database_fallback',
                fetchedAt: dbPrice.fetched_at.toISOString(),
                usdToBrlRate: usdToBrlRate
            });
        } else {
            results.push({ ticker, error: 'Data not found or incomplete from Yahoo Finance and not in DB' });
        }
      }
    } catch (error) {
      console.error(`Error fetching price for ${ticker}:`, error);
       const dbPrice = await getPrismaPrice(ticker);
        if(dbPrice) {
            let priceInBRL = dbPrice.last_price;
            if (dbPrice.currency === 'USD' && usdToBrlRate) {
                priceInBRL = dbPrice.last_price * usdToBrlRate;
            }
            results.push({
                ticker: dbPrice.ticker,
                price: dbPrice.last_price,
                currency: dbPrice.currency,
                priceInBRL: dbPrice.currency === 'BRL' ? dbPrice.last_price : (usdToBrlRate ? priceInBRL : null),
                source: 'database_fallback_on_error',
                fetchedAt: dbPrice.fetched_at.toISOString(),
                usdToBrlRate: usdToBrlRate
            });
        } else {
            results.push({ ticker, error: `Failed to fetch price: ${(error as Error).message}` });
        }
    }
  }
  res.status(200).json(results);
};

async function updatePrismaPrice(ticker: string, currency: string, lastPrice: number) {
  try {
    await prisma.price.upsert({
      where: { ticker: ticker.toUpperCase() },
      update: {
        last_price: lastPrice,
        currency: currency.toUpperCase() as Currency,
        fetched_at: new Date(),
      },
      create: {
        ticker: ticker.toUpperCase(),
        last_price: lastPrice,
        currency: currency.toUpperCase()as Currency,
      },
    });
  } catch (dbError) {
    console.error(`Error updating price in DB for ${ticker}:`, dbError);
  }
}

async function getPrismaPrice(ticker: string) {
    try {
        return await prisma.price.findUnique({ where: { ticker: ticker.toUpperCase() } });
    } catch (dbError) {
        console.error(`Error fetching price from DB for ${ticker}:`, dbError);
        return null;
    }
}

