import { Router } from 'express';
import { getPrices } from '../controllers/price.controller';
import { authenticateToken } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', authenticateToken, getPrices);

export default router;

