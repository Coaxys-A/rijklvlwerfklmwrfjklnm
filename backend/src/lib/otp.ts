// OTP helpers — 6-digit codes stored in Redis with 5-min TTL.
// SMS sending is a stub until a provider (Kavenegar, SMS.ir, etc.) is configured.

import { redis } from '../redis.js';

const OTP_TTL_SECONDS = 5 * 60;
const OTP_MAX_ATTEMPTS = 3;

const otpKey = (phone: string) => `otp:${phone}`;
const otpAttemptsKey = (phone: string) => `otp:attempts:${phone}`;

function generate6(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

type OtpSendResult = { sent: true; provider: string } | { sent: false; reason: 'sms_not_configured' | 'unsupported_provider' | 'provider_error'; provider?: string };

async function sendOtpSms(phone: string, code: string): Promise<OtpSendResult> {
  const provider = process.env.SMS_PROVIDER;
  if (!provider || !process.env.SMS_API_KEY) {
    return { sent: false, reason: 'sms_not_configured' };
  }
  if (provider !== 'kavenegar') return { sent: false, reason: 'unsupported_provider', provider };

  const sender = process.env.SMS_SENDER;
  const params = new URLSearchParams({
    receptor: phone,
    message: `کد تایید تکناو: ${code}`,
  });
  if (sender) params.set('sender', sender);

  try {
    const res = await fetch(`https://api.kavenegar.com/v1/${process.env.SMS_API_KEY}/sms/send.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });
    if (!res.ok) return { sent: false, reason: 'provider_error', provider };
    return { sent: true, provider };
  } catch {
    return { sent: false, reason: 'provider_error', provider };
  }
}

export async function issueOtp(phone: string): Promise<OtpSendResult> {
  const code = generate6();
  const result = await sendOtpSms(phone, code);
  if (result.sent) {
    await redis.set(otpKey(phone), code, 'EX', OTP_TTL_SECONDS);
    await redis.del(otpAttemptsKey(phone));
  }
  return result;
}

export async function verifyOtp(phone: string, code: string): Promise<boolean> {
  const stored = await redis.get(otpKey(phone));
  if (!stored) return false;

  const attempts = Number(await redis.incr(otpAttemptsKey(phone)));
  if (attempts === 1) await redis.expire(otpAttemptsKey(phone), OTP_TTL_SECONDS);
  if (attempts > OTP_MAX_ATTEMPTS) {
    await redis.del(otpKey(phone));
    return false;
  }

  if (stored !== code) return false;
  await redis.del(otpKey(phone));
  await redis.del(otpAttemptsKey(phone));
  return true;
}
