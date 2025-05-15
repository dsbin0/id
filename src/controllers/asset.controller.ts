import { PrismaClient, Currency, CategoryName } from '@prisma/client';
import { Request, Response } from 'express';

const prisma = new PrismaClient();

interface AuthRequest extends Request {
  user?: { userId: string; email: string };
}

// Helper to get or create categoryId
async function getCategoryIdByName(categoryName: CategoryName): Promise<string> {
  let category = await prisma.category.findUnique({
    where: { name: categoryName },
  });
  if (!category) {
    category = await prisma.category.create({
      data: { name: categoryName },
    });
  }
  return category.id;
}

export const getAssets = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const assets = await prisma.asset.findMany({
      where: { userId },
      include: { category: true },
    });
    res.status(200).json(assets);
  } catch (error) {
    console.error('Error fetching assets:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const createAsset = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { categoryName, ticker, quantity, currency } = req.body;

  if (!categoryName || !ticker || quantity === undefined || !currency) {
    return res.status(400).json({ message: 'Category, ticker, quantity, and currency are required' });
  }

  if (!Object.values(CategoryName).includes(categoryName as CategoryName)) {
    return res.status(400).json({ message: 'Invalid category name' });
  }

  if (!Object.values(Currency).includes(currency as Currency)) {
    return res.status(400).json({ message: 'Invalid currency' });
  }

  try {
    const categoryId = await getCategoryIdByName(categoryName as CategoryName);

    const asset = await prisma.asset.create({
      data: {
        userId,
        categoryId,
        ticker,
        quantity: parseFloat(quantity),
        currency: currency as Currency,
      },
    });
    res.status(201).json(asset);
  } catch (error) {
    console.error('Error creating asset:', error);
    if ((error as any).code === 'P2002' && (error as any).meta?.target?.includes('ticker') && (error as any).meta?.target?.includes('userId')) {
        return res.status(400).json({ message: 'This ticker already exists for this user.' });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const updateAsset = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { id } = req.params;
  const { categoryName, ticker, quantity, currency } = req.body;

  if (!id) {
    return res.status(400).json({ message: 'Asset ID is required' });
  }

  try {
    const existingAsset = await prisma.asset.findUnique({ where: { id } });
    if (!existingAsset || existingAsset.userId !== userId) {
      return res.status(404).json({ message: 'Asset not found or unauthorized' });
    }

    let categoryId = existingAsset.categoryId;
    if (categoryName && Object.values(CategoryName).includes(categoryName as CategoryName)) {
      categoryId = await getCategoryIdByName(categoryName as CategoryName);
    } else if (categoryName) {
      return res.status(400).json({ message: 'Invalid category name' });
    }

    if (currency && !Object.values(Currency).includes(currency as Currency)){
        return res.status(400).json({ message: 'Invalid currency' });
    }

    const updatedAsset = await prisma.asset.update({
      where: { id },
      data: {
        categoryId,
        ticker: ticker || existingAsset.ticker,
        quantity: quantity !== undefined ? parseFloat(quantity) : existingAsset.quantity,
        currency: (currency as Currency) || existingAsset.currency,
      },
    });
    res.status(200).json(updatedAsset);
  } catch (error) {
    console.error('Error updating asset:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const deleteAsset = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ message: 'Asset ID is required' });
  }

  try {
    const asset = await prisma.asset.findUnique({ where: { id } });
    if (!asset || asset.userId !== userId) {
      return res.status(404).json({ message: 'Asset not found or unauthorized' });
    }

    await prisma.asset.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting asset:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

