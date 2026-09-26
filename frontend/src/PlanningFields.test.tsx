import { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import PlanningFields from './PlanningFields'
import { emptyPlanning } from './planning'

function Harness() {
  const [planning, setPlanning] = useState(emptyPlanning)
  return <PlanningFields value={planning} onChange={setPlanning} />
}

afterEach(cleanup)

test('switching calendars offers explicit scopes and follows their usual weekends', () => {
  render(<Harness />)
  const calendar = screen.getByRole('combobox', { name: 'Country calendar' })
  expect(
    screen.getByRole('option', { name: 'United States — federal holidays' }),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('option', { name: 'England & Wales — bank holidays' }),
  ).toBeInTheDocument()
  for (const country of ['US', 'GB', 'IL']) {
    fireEvent.change(calendar, { target: { value: country } })
    expect(calendar).toHaveValue(country)
    expect(screen.getByLabelText('Saturday')).toBeChecked()
    expect(screen.getByLabelText('Friday').matches(':checked')).toBe(country === 'IL')
    expect(screen.getByLabelText('Sunday').matches(':checked')).toBe(country !== 'IL')
  }
})

test('changing holiday calendar preserves a custom weekend, including no weekend days', () => {
  render(<Harness />)
  const calendar = screen.getByRole('combobox', { name: 'Country calendar' })
  fireEvent.click(screen.getByLabelText('Monday'))
  fireEvent.change(calendar, { target: { value: 'US' } })
  expect(screen.getByLabelText('Monday')).toBeChecked()
  expect(screen.getByLabelText('Friday')).toBeChecked()
  expect(screen.getByLabelText('Saturday')).toBeChecked()
  expect(screen.getByLabelText('Sunday')).not.toBeChecked()
  for (const day of ['Monday', 'Friday', 'Saturday']) fireEvent.click(screen.getByLabelText(day))
  fireEvent.change(calendar, { target: { value: 'GB' } })
  expect(screen.getAllByRole('checkbox').every((field) => !field.matches(':checked'))).toBe(true)
})
