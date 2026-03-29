import { describe, expect, it } from 'vitest'
import { parseWorklogInput } from '@/utils/formatters'

describe('parseWorklogInput', () => {
  it('parses hour-minute format', () => {
    expect(parseWorklogInput('1:30h')).toBe(90)
  })

  it('parses minute suffix variants', () => {
    expect(parseWorklogInput('90p')).toBe(90)
    expect(parseWorklogInput('45m')).toBe(45)
  })

  it('parses day and decimal hour values', () => {
    expect(parseWorklogInput('1d', 8)).toBe(480)
    expect(parseWorklogInput('1.5h')).toBe(90)
  })
})
