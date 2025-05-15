import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import authRoutes from './routes/auth.routes';
import assetRoutes from './routes/asset.routes';
import priceRoutes from './routes/price.routes';
import { PrismaClient } from '@prisma/client';

const app = express();
const prisma = new PrismaClient();

// Middlewares
app.use(helmet()); // Basic security headers
app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Parse JSON bodies

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/prices', priceRoutes);

// Root route
app.get('/', (req: Request, res: Response) => {
  res.send('Invest Dashboard Backend is running!');
});

// Global Error Handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  // Check if the error is a Zod validation error or a generic one
  // For now, a simple error response
  if ((err as any).isZodError) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: (err as any).errors,
    });
  }
  res.status(500).send('Something broke!');
});

// Function to create initial categories if they don't exist
async function seedCategories() {
  const categories = ['ACOES_BR', 'FIIS', 'RENDA_FIXA', 'ACOES_US', 'CRYPTO'];
  for (const categoryName of categories) {
    const existingCategory = await prisma.category.findUnique({
      where: { name: categoryName as any }, // Cast to any to satisfy enum type
    });
    if (!existingCategory) {
      await prisma.category.create({
        data: { name: categoryName as any }, // Cast to any
      });
      console.log(`Category '${categoryName}' created.`);
    }
  }
}

const PORT = process.env.PORT || 10000;

app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  try {
    await seedCategories();
    console.log('Categories seeded successfully (if they did not exist).');
  } catch (error) {
    console.error('Error seeding categories:', error);
  }
});

export default app;

