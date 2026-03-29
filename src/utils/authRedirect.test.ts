import { describe, expect, it } from 'vitest'
import { ROUTES } from '@/config/constants'
import { resolvePostAuthRedirect, sanitizeRedirectTarget } from '@/utils/authRedirect'

describe('auth redirect helpers', () => {
  it('accepts internal app paths only', () => {
    expect(sanitizeRedirectTarget('/projects/abc')).toBe('/projects/abc')
    expect(sanitizeRedirectTarget('projects/abc')).toBeNull()
    expect(sanitizeRedirectTarget('https://example.com')).toBeNull()
    expect(sanitizeRedirectTarget('//example.com')).toBeNull()
  })

  it('prefers router state over query redirect', () => {
    expect(resolvePostAuthRedirect('/teams/123/board', '?redirect=%2Fprojects%2F42')).toBe('/teams/123/board')
  })

  it('falls back to dashboard for invalid redirect values', () => {
    expect(resolvePostAuthRedirect(undefined, '?redirect=https%3A%2F%2Fevil.example')).toBe(ROUTES.DASHBOARD)
    expect(resolvePostAuthRedirect(undefined, '')).toBe(ROUTES.DASHBOARD)
  })
})
