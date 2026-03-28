import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing'

export { generateKeyBetween, generateNKeysBetween }

/** Első elem elé */
export function keyBefore(key: string): string {
  return generateKeyBetween(null, key)
}

/** Utolsó elem után */
export function keyAfter(key: string): string {
  return generateKeyBetween(key, null)
}

/** Két elem közé */
export function keyBetween(a: string | null, b: string | null): string {
  return generateKeyBetween(a, b)
}

/** Kezdő kulcs üres listához */
export function initialKey(): string {
  return generateKeyBetween(null, null)
}

/** N kulcs egy tartományba */
export function nKeysBetween(a: string | null, b: string | null, n: number): string[] {
  return generateNKeysBetween(a, b, n)
}
