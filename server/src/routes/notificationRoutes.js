import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as ctrl from '../controllers/notificationController.js';

const router = Router();

router.use(requireAuth);

router.get('/', ctrl.list);
router.post('/:id/read', ctrl.markRead);
router.post('/read-all', ctrl.markAllRead);
router.post('/:id/dismiss', ctrl.dismiss);

export default router;
