import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as ctrl from '../controllers/dashboardController.js';

const router = Router();

router.use(requireAuth);
router.get('/', ctrl.summary);

export default router;
