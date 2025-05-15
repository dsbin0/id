import { Router } from 'express';
import { getAssets, createAsset, updateAsset, deleteAsset } from '../controllers/asset.controller';
import { authenticateToken } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticateToken); // Protect all asset routes

router.get('/', getAssets);
router.post('/', createAsset);
router.put('/:id', updateAsset);
router.delete('/:id', deleteAsset);

export default router;

