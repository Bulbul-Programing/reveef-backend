import express from 'express';
import { validateRequest } from '../../middleware/validateRequest.ts';
import { loginValidation } from './auth.validation.ts';
import { loginController } from './auth.controller.ts';

const router = express.Router()

router.post('/login', validateRequest(loginValidation.loginValidationSchema), loginController.loginUser)
router.get('/userData/:email', loginController.getUserData)
router.post("/forgot-password", loginController.forgotPassword);
router.get("/accessToken", loginController.getAccessTokenByRefreshToken);
router.post("/resetPassword", loginController.resetPassword);

export const loginRoute = router