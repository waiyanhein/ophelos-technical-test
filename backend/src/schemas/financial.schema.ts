import { z } from 'zod';

export const dashboardQuerySchema = z.object({
  month: z
    .string({ error: 'month must be a string' })
    .regex(/^(0[1-9]|1[0-2])$/, 'month must be a 2-digit string between 01 and 12')
    .optional(),
  year: z
    .string({ error: 'year must be a string' })
    .regex(/^\d{4}$/, 'year must be a 4-digit string')
    .optional(),
});

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;
