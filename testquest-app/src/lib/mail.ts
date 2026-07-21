import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendPasswordResetEmail(
  email: string,
  token: string
): Promise<void> {
  const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`;

  await transporter.sendMail({
    from: process.env.SMTP_FROM || "noreply@testquest.in",
    to: email,
    subject: "Reset your TestQuest password",
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;">
        <img src="${process.env.NEXT_PUBLIC_APP_URL}/brand/logo-email.png" alt="TestQuest" width="180" style="display:block;border:0;margin:24px 0 16px;" />
        <h2 style="color:#140C3D;margin:0 0 12px;">Password Reset</h2>
        <p style="color:#140C3D;">Click the link below to reset your password. This link expires in 1 hour.</p>
        <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#6134EB;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;">Reset Password</a>
        <p style="margin-top:16px;color:#666666;">If you didn't request this, ignore this email.</p>
      </div>
    `,
  });
}
