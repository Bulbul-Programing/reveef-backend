import { Router } from "express";
import { sendContactEmailController } from "./sendContactEmailController.ts";
import { contactValidationSchema } from "./sendContactEmailValidation.ts";
import { validateRequest } from "../../middleware/validateRequest.ts";

const router = Router();

router.post(
    "/contact",
    validateRequest(contactValidationSchema),
    sendContactEmailController
);

export const sendEmailRouter = router