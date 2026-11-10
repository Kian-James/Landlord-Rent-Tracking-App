import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { contractConvertLimiter, contractPreviewLimiter } from '../middleware/rateLimit.js';
import * as controller from '../controllers/contractTemplateController.js';

const router = Router();

router.use(requireAuth);

router.get('/', controller.get);
router.get('/review', controller.review);
router.post('/extract', contractConvertLimiter, controller.uploadPdf, controller.extract);
router.post('/preview-pdf', contractPreviewLimiter, controller.uploadPdf, controller.previewPdf);
router.put('/', contractPreviewLimiter, controller.uploadPdf, controller.save);
router.delete('/', controller.reset);

export default router;
