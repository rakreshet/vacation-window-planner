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

test('personal ranges require Apply and country changes require a keep or clear choice', () => {
  render(<Harness />)
  fireEvent.click(screen.getByRole('button', { name: 'Add calendar rule' }))
  fireEvent.change(screen.getByLabelText('Rule start date'), { target: { value: '2027-01-07' } })
  fireEvent.change(screen.getByLabelText('Rule end date'), { target: { value: '2027-01-07' } })
  fireEvent.click(screen.getByRole('button', { name: 'Apply rule' }))
  expect(screen.getByText(/2027-01-07.*Personal day off/)).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Country calendar'), { target: { value: 'US' } })
  expect(screen.getByText(/Keep or clear your date overrides/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Clear date overrides' }))
  expect(screen.queryByText(/2027-01-07.*Personal day off/)).not.toBeInTheDocument()
  expect(screen.getByLabelText('Country calendar')).toHaveValue('US')
})

test('the editor rejects opposing overlapping rules before Apply', () => {
  render(<Harness />)
  function fillRule(kind: string) {
    fireEvent.click(screen.getByRole('button', { name: 'Add calendar rule' }))
    fireEvent.change(screen.getByLabelText('Rule type'), { target: { value: kind } })
    fireEvent.change(screen.getByLabelText('Rule start date'), { target: { value: '2027-01-07' } })
    fireEvent.change(screen.getByLabelText('Rule end date'), { target: { value: '2027-01-08' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply rule' }))
  }
  fillRule('personal_day_off')
  fillRule('extra_working_day')
  expect(screen.getByRole('alert')).toHaveTextContent(
    'An opposing date override overlaps this rule',
  )
  expect(screen.getByRole('button', { name: 'Cancel rule' })).toBeInTheDocument()
})

test('a calendar rule cannot exceed 366 dates', () => {
  render(<Harness />)
  fireEvent.click(screen.getByRole('button', { name: 'Add calendar rule' }))
  fireEvent.change(screen.getByLabelText('Rule start date'), { target: { value: '2027-01-01' } })
  fireEvent.change(screen.getByLabelText('Rule end date'), { target: { value: '2028-01-02' } })
  fireEvent.click(screen.getByRole('button', { name: 'Apply rule' }))
  expect(screen.getByRole('alert')).toHaveTextContent('A rule may contain at most 366 dates')
})

test('editing a saved rule can be cancelled without losing its original dates', () => {
  render(<Harness />)
  fireEvent.click(screen.getByRole('button', { name: 'Add calendar rule' }))
  fireEvent.change(screen.getByLabelText('Rule start date'), { target: { value: '2027-01-07' } })
  fireEvent.change(screen.getByLabelText('Rule end date'), { target: { value: '2027-01-07' } })
  fireEvent.click(screen.getByRole('button', { name: 'Apply rule' }))
  fireEvent.click(screen.getByRole('button', { name: 'Edit Personal day off 2027-01-07' }))
  fireEvent.change(screen.getByLabelText('Rule end date'), { target: { value: '2027-01-08' } })
  fireEvent.click(screen.getByRole('button', { name: 'Cancel rule' }))
  expect(screen.getByText(/2027-01-07 – 2027-01-07/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Edit Personal day off 2027-01-07' }))
  fireEvent.change(screen.getByLabelText('Rule type'), { target: { value: 'extra_working_day' } })
  fireEvent.click(screen.getByRole('button', { name: 'Apply rule' }))
  expect(
    screen.queryByRole('button', { name: 'Edit Personal day off 2027-01-07' }),
  ).not.toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'Edit Extra working day 2027-01-07' }),
  ).toBeInTheDocument()
})
