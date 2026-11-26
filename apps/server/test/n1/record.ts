import { ZodType, type ZodTypeDef } from 'zod';

/** One payload a test parsed with a client schema: which module, which export, what came in. */
export interface Recorded { module: string; name: string; value: unknown }

/** Only what could have come over the wire: a Date or a Map built inside a test is not a server answer. */
function isJson(value: unknown): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJson);
  if (typeof value !== 'object') return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return (prototype === Object.prototype || prototype === null) && Object.values(value).every(isJson);
}

type Schema = ZodType<unknown, ZodTypeDef, unknown>;
export const isSchema = (value: unknown): value is Schema => value instanceof ZodType;

/**
 * The client schema module as the tests see it, each schema writing what it accepted to `sink`.
 * A child of the schema rather than a copy, so `.extend`, `.array` and `instanceof` behave as before.
 */
export function recordSchemas<T extends Record<string, unknown>>(module: string, exports: T, sink: (line: Recorded) => void): T {
  return Object.fromEntries(Object.entries(exports).map(([name, value]) => {
    if (!isSchema(value)) return [name, value];
    const schema = value;
    const child: Schema = Object.create(schema) as Schema;
    child.safeParse = (data, params) => {
      const result = schema.safeParse.call(child, data, params);
      if (result.success && isJson(data)) sink({ module, name, value: data });
      return result;
    };
    child.parse = (data, params) => {
      const result = child.safeParse(data, params);
      if (result.success) return result.data;
      throw result.error;
    };
    return [name, child];
  })) as T;
}
