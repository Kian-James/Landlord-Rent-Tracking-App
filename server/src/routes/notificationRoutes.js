import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as controller from '../controllers/notificationController.js';

const router = Router();

router.use(requireAuth);

router.get('/', controller.list);
router.post('/:id/read', controller.markRead);
router.post('/read-all', controller.markAllRead);
router.post('/:id/dismiss', controller.dismiss);

export default router;
