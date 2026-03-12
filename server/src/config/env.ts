import { z } from 'zod';

const envSchema = z.object({
  // Required
  PORT: z
    .string()
    .default('3001')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive()),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  CORS_ORIGIN: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  ENCRYPTION_KEY: z
    .string()
    .min(32, 'ENCRYPTION_KEY must be at least 32 characters'),

  // Optional
  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_FILE_SIZE_MB: z
    .string()
    .default('50')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive()),
  LOG_LEVEL: z
    .enum(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'])
    .default('info'),
  DEFAULT_AI_PROVIDER: z
    .enum(['anthropic', 'openai', 'ollama'])
    .default('anthropic'),
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OLLAMA_BASE_URL: z.string().url().optional(),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.format();
    const messages = Object.entries(formatted)
      .filter(([key]) => key !== '_errors')
      .map(([key, val]) => {
        const errors = (val as { _errors?: string[] })?._errors ?? [];
        return `  ${key}: ${errors.join(', ')}`;
      })
      .join('\n');

    console.error('Environment validation failed:\n' + messages);
    process.exit(1);
  }

  return result.data;
}

export const env = validateEnv();
