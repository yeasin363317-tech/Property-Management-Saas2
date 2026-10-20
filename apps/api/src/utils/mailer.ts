import nodemailer from 'nodemailer';
import { env } from '../config/env';

export const isMailConfigured = Boolean(env.SMTP_HOST && env.SMTP_FROM);

const transport = isMailConfigured
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    })
  : null;

/** Returns true only if the provider accepted the message. */
export async function sendMail(to: string, subject: string, text: string): Promise<boolean> {
  if (!transport) return false;
  try {
    await transport.sendMail({ from: env.SMTP_FROM, to, subject, text });
    return true;
  } catch (err) {
    console.error('Email delivery failed:', (err as Error).message);
    return false;
  }
}
