import { describe, expect, it } from 'vitest'
import { getAuthErrorMessage } from '@/utils/authErrorMessage'

describe('getAuthErrorMessage', () => {
  it('maps unauthorized domain errors to a clear Firebase setup message', () => {
    expect(getAuthErrorMessage(
      { code: 'auth/unauthorized-domain' },
      'fallback',
    )).toContain('domain')
  })

  it('maps popup blocked errors to a popup-specific message', () => {
    expect(getAuthErrorMessage(
      { code: 'auth/popup-blocked' },
      'fallback',
    )).toContain('popup')
  })

  it('falls back for unknown errors', () => {
    expect(getAuthErrorMessage({ code: 'auth/something-else' }, 'fallback')).toBe('fallback')
  })
})
