// services/mailService.ts
import nodemailer from 'nodemailer';

interface SendMailOptions {
    to: string;
    subject: string;
    text: string;
    html?: string;
}

// Configure the transporter
const transporter = nodemailer.createTransport({
    service: 'gmail', // Use a popular service or custom SMTP (like smtp.mailtrap.io for testing)
    auth: {
        user: 'fiberitinstitute24@gmail.com', // Replace with your email
        pass: 'gjzl ivfh ykjb vohh', // Replace with your email password or an app password
    },
});

// Function to send email
export const sendMail = async (options: SendMailOptions) => {
    const { to, subject, text, html } = options;

    const mailOptions = {
        from: 'fiberitinstitute24@gmail.com', // Sender's email
        to,
        subject,
        text,
        html, // Optional HTML content
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        return info;
    } catch (error) {
        console.error('Error sending email:', error);
        throw error;
    }
};
