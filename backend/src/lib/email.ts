// Email stub — sends via SMTP when SMTP_HOST is configured; otherwise logs to console.
// Drop-in for production: set SMTP_HOST/PORT/USER/PASS/FROM in .env.prod.

interface MailOptions {
  to: string;
  subject: string;
  html: string;
}

async function sendEmail(opts: MailOptions): Promise<void> {
  const host = process.env.SMTP_HOST;
  if (!host) {
    // SMTP not configured — log so the operator can see what would have been sent.
    console.info('[email:stub] Would send to', opts.to, '|', opts.subject);
    return;
  }

  // Lazy-load nodemailer only when SMTP is configured to keep the cold-start fast.
  const nodemailer = await import('nodemailer').catch(() => null);
  if (!nodemailer) {
    console.warn('[email] nodemailer not installed — install with: cd backend && npm install nodemailer @types/nodemailer');
    return;
  }

  const transport = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transport.sendMail({
    from: process.env.SMTP_FROM ?? 'no-reply@teknav.ir',
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  });
}

export { sendEmail };
