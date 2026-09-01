import nodemailer from "nodemailer";
import { envVars } from "../envConfig/index.ts";

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: envVars.EMAIL_USER,
        pass: envVars.EMAIL_PASSWORD,
    },
});

export const sendEmail = async (
    to: string,
    subject: string,
    html: string
) => {
    await transporter.sendMail({
        from: `"Reveef" <${envVars.EMAIL_USER}>`,
        to,
        subject,
        html,
    });
};