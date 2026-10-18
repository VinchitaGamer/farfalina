import { z } from 'zod';

export const ActionResponseSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.string().optional(),
  code: z.string().optional(),
});

export type ActionResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
};
