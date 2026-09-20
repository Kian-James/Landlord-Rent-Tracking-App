import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as controller from '../controllers/dashboardController.js';

const router = Router();

router.use(requireAuth);
router.get('/', controller.summary);

export default router;
