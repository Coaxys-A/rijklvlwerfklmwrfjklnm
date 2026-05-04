import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { createCaptcha, verifyCaptcha } from '../lib/captcha.js';
import { redis } from '../redis.js';

const verifySchema = z.object({
  captchaId: z.string().trim().min(1).max(64),
  userSolution: z.string().trim().min(1).max(20),
});

function badInput(reply: FastifyReply) {
  return reply.code(400).send({ success: false, message: 'Invalid input' });
}

export default async function captchaRoutes(app: FastifyInstance) {
  // Generate captcha
  app.get('/api/teknav-cap/generate', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            data: { type: 'string' },
          },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    // Rate limit: 20 captcha generations per IP per minute
    const key = `captcha:gen:${req.ip}`;
    const hits = await redis.incr(key);
    if (hits === 1) await redis.expire(key, 60);
    if (hits > 20) {
      return reply.code(429).send({ error: 'too_many_requests' });
    }
    return createCaptcha();
  });

  // Verify captcha
  app.post('/api/teknav-cap/verify', {
    schema: {
      body: {
        type: 'object',
        required: ['captchaId', 'userSolution'],
        properties: {
          captchaId: { type: 'string' },
          userSolution: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
          },
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    // Rate limit: 10 verify attempts per IP per minute
    const key = `captcha:verify:${req.ip}`;
    const hits = await redis.incr(key);
    if (hits === 1) await redis.expire(key, 60);
    if (hits > 10) {
      return reply.code(429).send({ success: false, message: 'Too many attempts' });
    }

    const parsed = verifySchema.safeParse(req.body);
    if (!parsed.success) return badInput(reply);

    const { captchaId, userSolution } = parsed.data;
    const isValid = verifyCaptcha(captchaId, userSolution);

    if (isValid) {
      return { success: true, message: 'TeknavCAP Verified' };
    } else {
      return reply.code(400).send({ success: false, message: 'Invalid Captcha' });
    }
  });
}
