import express from 'express';
import { validateRequest } from '../../middleware/validateRequest.ts';
import { loginValidation } from './auth.validation.ts';
import { loginController } from './auth.controller.ts';


const router = express.Router()

router.post('/login', validateRequest(loginValidation.loginValidationSchema), loginController.loginUser)
router.get('/userData/:email', loginController.getUserData)

export const loginRoute = router