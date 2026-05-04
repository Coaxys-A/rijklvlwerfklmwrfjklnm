import { randomBytes } from 'node:crypto';

interface CaptchaData {
  text: string;
  expiresAt: number;
}

// In-memory captcha store
const captchaStore = new Map<string, CaptchaData>();

// Cleanup expired captchas every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [id, data] of captchaStore.entries()) {
    if (data.expiresAt < now) {
      captchaStore.delete(id);
    }
  }
}, 60_000);

function generateCaptchaText(length: number = 5): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars like O, 0, I, 1
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateCaptchaSVG(text: string): string {
  const width = 200;
  const height = 80;
  const colors = ['#0F6B73', '#D49A2A', '#C76D4A', '#2F8F6B', '#5F6B6D'];
  
  // Random background color (light)
  const bgColor = '#f0f0f0';
  
  // Generate noise lines
  let noiseSVG = '';
  for (let i = 0; i < 5; i++) {
    const x1 = Math.random() * width;
    const y1 = Math.random() * height;
    const x2 = Math.random() * width;
    const y2 = Math.random() * height;
    const color = colors[Math.floor(Math.random() * colors.length)];
    noiseSVG += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="1.5" opacity="0.3"/>`;
  }
  
  // Generate text with random positioning and rotation
  let textSVG = '';
  const charSpacing = width / (text.length + 1);
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const x = charSpacing * (i + 1) + (Math.random() - 0.5) * 10;
    const y = height / 2 + (Math.random() - 0.5) * 15;
    const rotation = (Math.random() - 0.5) * 30;
    const color = colors[Math.floor(Math.random() * colors.length)];
    const fontSize = 32 + Math.random() * 8;
    
    textSVG += `<text x="${x}" y="${y}" font-size="${fontSize}" font-weight="bold" fill="${color}" transform="rotate(${rotation} ${x} ${y})" font-family="Arial, sans-serif">${char}</text>`;
  }
  
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="${bgColor}"/>
  ${noiseSVG}
  ${textSVG}
</svg>`;
}

export function createCaptcha() {
  const id = randomBytes(16).toString('hex');
  const text = generateCaptchaText(5);
  const svg = generateCaptchaSVG(text);
  
  // Store with 2-minute expiration
  captchaStore.set(id, {
    text: text.toLowerCase(),
    expiresAt: Date.now() + 120_000, // 2 minutes
  });
  
  return { id, data: svg };
}

export function verifyCaptcha(captchaId: string, userSolution: string): boolean {
  const stored = captchaStore.get(captchaId);
  
  if (!stored) {
    return false;
  }
  
  // Check expiration
  if (stored.expiresAt < Date.now()) {
    captchaStore.delete(captchaId);
    return false;
  }
  
  // One-time use: delete immediately
  captchaStore.delete(captchaId);
  
  // Case-insensitive comparison
  return stored.text === userSolution.toLowerCase().trim();
}
