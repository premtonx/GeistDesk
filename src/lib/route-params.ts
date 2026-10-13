/** Normalize Express route params that may be typed as string | string[]. */
export function routeParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}
