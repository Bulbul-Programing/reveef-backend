import { envVars } from "../../envConfig/index.ts";
import { sendEmail } from "../../utils/sendEmail.ts";

export interface ContactEmailPayload {
    name: string;
    email: string;
    phone?: string;
    topic: string;
    message: string;
}

const escapeHtml = (value: string) =>
    value.replace(/[&<>"']/g, (char) => {
        const entities: Record<string, string> = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
        };

        return entities[char];
    });

export const sendContactEmail = async (
    data: ContactEmailPayload
) => {
    const name = escapeHtml(data.name);
    const email = escapeHtml(data.email);
    const phone = escapeHtml(data.phone || "Not provided");
    const topic = escapeHtml(data.topic);
    const message = escapeHtml(data.message).replace(/\n/g, "<br>");

    const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>New Contact Enquiry</title>
        </head>

        <body style="
            margin: 0;
            padding: 0;
            background-color: #f5f7fb;
            font-family: Arial, Helvetica, sans-serif;
            color: #263238;
        ">
            <table
                role="presentation"
                width="100%"
                cellpadding="0"
                cellspacing="0"
                style="background-color: #f5f7fb;"
            >
                <tr>
                    <td align="center" style="padding: 40px 16px;">
                        <table
                            role="presentation"
                            width="600"
                            cellpadding="0"
                            cellspacing="0"
                            style="
                                width: 100%;
                                max-width: 600px;
                                background-color: #ffffff;
                                border-radius: 12px;
                                overflow: hidden;
                            "
                        >
                            <tr>
                                <td
                                    align="center"
                                    style="padding: 28px; border-bottom: 1px solid #edf0f5;"
                                >
                                    <a href="${envVars.FRONTEND_URL}">
                                        <img
                                            src="https://res.cloudinary.com/fsynam2f/image/upload/v1788198058/New_Project_15.jpg"
                                            alt="Reveef"
                                            width="100"
                                            style="display: block; height: auto;"
                                        />
                                    </a>
                                </td>
                            </tr>

                            <tr>
                                <td style="padding: 40px 32px;">
                                    <p style="
                                        margin: 0 0 12px;
                                        color: #6b7280;
                                        font-size: 12px;
                                        font-weight: bold;
                                        letter-spacing: 1px;
                                        text-transform: uppercase;
                                    ">
                                        Contact Form Enquiry
                                    </p>

                                    <h1 style="
                                        margin: 0 0 24px;
                                        color: #102a72;
                                        font-size: 28px;
                                    ">
                                        New customer message
                                    </h1>

                                    <p style="font-size: 15px; line-height: 25px;">
                                        You have received a new enquiry through the Reveef website.
                                    </p>

                                    <table
                                        role="presentation"
                                        width="100%"
                                        cellpadding="0"
                                        cellspacing="0"
                                        style="margin-top: 24px;"
                                    >
                                        <tr>
                                            <td style="padding: 12px; background: #f7f8fc; width: 120px;">
                                                <strong>Name</strong>
                                            </td>
                                            <td style="padding: 12px; background: #f7f8fc;">
                                                ${name}
                                            </td>
                                        </tr>

                                        <tr>
                                            <td style="padding: 12px; border-bottom: 1px solid #edf0f5;">
                                                <strong>Email</strong>
                                            </td>
                                            <td style="padding: 12px; border-bottom: 1px solid #edf0f5;">
                                                ${email}
                                            </td>
                                        </tr>

                                        <tr>
                                            <td style="padding: 12px; border-bottom: 1px solid #edf0f5;">
                                                <strong>Phone</strong>
                                            </td>
                                            <td style="padding: 12px; border-bottom: 1px solid #edf0f5;">
                                                ${phone}
                                            </td>
                                        </tr>

                                        <tr>
                                            <td style="padding: 12px; border-bottom: 1px solid #edf0f5;">
                                                <strong>Topic</strong>
                                            </td>
                                            <td style="padding: 12px; border-bottom: 1px solid #edf0f5;">
                                                ${topic}
                                            </td>
                                        </tr>
                                    </table>

                                    <h2 style="
                                        margin: 32px 0 12px;
                                        color: #102a72;
                                        font-size: 18px;
                                    ">
                                        Customer message
                                    </h2>

                                    <div style="
                                        padding: 20px;
                                        background: #f7f8fc;
                                        border-left: 4px solid #102a72;
                                        font-size: 15px;
                                        line-height: 26px;
                                        overflow-wrap: anywhere;
                                    ">
                                        ${message}
                                    </div>

                                    <p style="
                                        margin-top: 32px;
                                        color: #6b7280;
                                        font-size: 12px;
                                        line-height: 20px;
                                    ">
                                        This email was generated by the Reveef website contact form.
                                    </p>
                                </td>
                            </tr>

                            <tr>
                                <td style="
                                    padding: 24px;
                                    text-align: center;
                                    background: #fafbfc;
                                    border-top: 1px solid #edf0f5;
                                    color: #9ca3af;
                                    font-size: 12px;
                                ">
                                    &copy; 2026 Reveef. All rights reserved.
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
    `;

    await sendEmail(
        envVars.EMAIL_USER as string,
        `New Enquiry: ${data.topic}`,
        html
    );

    return {
        success: true,
        message: "Contact enquiry email sent successfully",
    };
};
