import nodemailer from "nodemailer";

export const sendMail = async ({ to, subject, html }) => {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST, // e.g., "smtp.gmail.com"
      port: process.env.SMTP_PORT || 587,
      secure: false, // true if using 465
      auth: {
        user: process.env.SMTP_USER, // your email
        pass: process.env.SMTP_PASS  // your password / app password
      }
    });

    await transporter.sendMail({
      from: `"Accommodation Team" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html
    });
  } catch (err) {
    console.error("Error sending email:", err);
  }
};
