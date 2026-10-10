import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "@/lib/config";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

/**
 * Sends transactional email (password resets). With SMTP_URL configured it
 * goes out over SMTP via nodemailer; without it -- local development, or a
 * deployment that hasn't set up email yet -- the message is logged and
 * written to data/outbox/ so the link is still retrievable by an operator.
 */
export async function sendMail(message: MailMessage): Promise<void> {
  if (config.smtpUrl) {
    const nodemailer = await import("nodemailer");
    const transport = nodemailer.createTransport(config.smtpUrl);
    await transport.sendMail({ from: config.mailFrom, to: message.to, subject: message.subject, text: message.text });
    return;
  }

  const outbox = path.resolve(process.cwd(), "data", "outbox");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safeTo = message.to.replace(/[^a-z0-9@._-]/gi, "_");
  await mkdir(outbox, { recursive: true });
  await writeFile(
    path.join(outbox, `${stamp}-${safeTo}.txt`),
    `To: ${message.to}\nSubject: ${message.subject}\n\n${message.text}\n`,
    "utf8"
  );
  console.log(`[mail] SMTP_URL not set -- wrote "${message.subject}" for ${message.to} to data/outbox/`);
}
