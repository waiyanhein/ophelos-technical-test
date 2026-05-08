import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string({ error: 'Email is required' })
    .trim()
    .min(1, 'Email is required')
    .max(320, 'Email is too long')
    .toLowerCase()
    .pipe(z.email('Email is invalid')),
  password: z
    .string({ error: 'Password is required' })
    .min(1, 'Password is required')
    .max(128, 'Password is too long'),
});

export type LoginInput = z.infer<typeof loginSchema>;
