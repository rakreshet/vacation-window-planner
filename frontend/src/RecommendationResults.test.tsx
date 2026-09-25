import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'

import type { Recommendation, RecommendationResponse } from './api'
import RecommendationResults from './RecommendationResults'

afterEach(cleanup)

function recommendation(overrides: Partial<Recommendation> = {}): Recommendation {
  return {
    window: {
      start_date: '2027-01-29',
      end_date: '2027-02-04',
      total_days: 7,
      vacation_days_used: 3,
      holiday_dates: [],
    },
    rank: 1,
    score: 88,
    explanation: '7 days off use 3 vacation days, with 57% of the window uncharged.',
    remaining_balance: 5,
    warnings: [],
    ...overrides,
  }
}

function result(
  recommendations: Recommendation[],
  notice: string | null = null,
): RecommendationResponse {
  return { search_id: 'search-id', recommendations, notice }
}

test('renders ranked cross-month recommendation facts', () => {
  render(<RecommendationResults result={result([recommendation()])} />)

  expect(screen.getByRole('heading', { name: '1. Jan 29 – Feb 4, 2027' })).toBeInTheDocument()
  expect(screen.getByText('7 total days off')).toBeInTheDocument()
  expect(screen.getByText('3 vacation days used')).toBeInTheDocument()
  expect(screen.getByText('5 vacation days remaining')).toBeInTheDocument()
  expect(screen.getByText('Score 88')).toBeInTheDocument()
})

test('renders close tradeoff explanation and clipped-date notice', () => {
  const close = recommendation({
    rank: 2,
    score: 87,
    explanation: 'This is a close trade-off with the option above.',
  })
  render(
    <RecommendationResults
      result={result([close], 'Past start dates were excluded; search begins on 2026-09-25.')}
    />,
  )

  expect(screen.getByText(/Past start dates were excluded/)).toBeInTheDocument()
  expect(screen.getByText('This is a close trade-off with the option above.')).toBeInTheDocument()
})

test('renders zero-PTO, full-balance, and negative-balance facts', () => {
  const zeroPto = recommendation({
    rank: 1,
    window: {
      start_date: '2027-01-01',
      end_date: '2027-01-02',
      total_days: 2,
      vacation_days_used: 0,
      holiday_dates: [],
    },
    remaining_balance: 5,
  })
  const full = recommendation({
    rank: 2,
    remaining_balance: 0,
    warnings: ['full_balance'],
  })
  const negative = recommendation({
    rank: 3,
    remaining_balance: -1,
    warnings: ['negative_balance'],
  })
  render(<RecommendationResults result={result([zeroPto, full, negative])} />)

  expect(screen.getByText('0 vacation days used')).toBeInTheDocument()
  expect(screen.getByText('Uses your full vacation balance')).toBeInTheDocument()
  expect(screen.getByText('Uses 1 day beyond your current balance')).toBeInTheDocument()
})

test('renders a clear zero-result state', () => {
  render(<RecommendationResults result={result([])} />)

  expect(screen.getByText('No feasible vacation windows found.')).toBeInTheDocument()
})
