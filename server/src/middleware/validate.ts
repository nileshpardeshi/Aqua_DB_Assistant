import type { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

type RequestField = 'body' | 'params' | 'query';

/**
 * Returns Express middleware that validates the specified request field
 * against a Zod schema. On success the parsed (and potentially transformed)
 * value replaces the original on the request object.
 *
 * @example
 *   router.post('/projects', validate(createProjectSchema, 'body'), controller.create);
 */
export function validate(schema: ZodSchema, field: RequestField = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[field]);

    if (!result.success) {
      next(result.error);
      return;
    }

    // Replace with the parsed/transformed data
    (req as unknown as Record<string, unknown>)[field] = result.data;
    next();
  };
}

/**
 * Validate multiple request fields at once.
 *
 * @example
 *   router.patch(
 *     '/projects/:projectId',
 *     validateMultiple({ params: projectIdParamSchema, body: updateProjectSchema }),
 *     controller.update,
 *   );
 */
export function validateMultiple(
  schemas: Partial<Record<RequestField, ZodSchema>>,
) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const errors: ZodError[] = [];

    for (const [field, schema] of Object.entries(schemas) as [
      RequestField,
      ZodSchema,
    ][]) {
      const result = schema.safeParse(req[field]);
      if (!result.success) {
        errors.push(result.error);
      } else {
        (req as unknown as Record<string, unknown>)[field] = result.data;
      }
    }

    if (errors.length > 0) {
      // Merge all ZodErrors into one
      const merged = new ZodError(errors.flatMap((e) => e.errors));
      next(merged);
      return;
    }

    next();
  };
}
