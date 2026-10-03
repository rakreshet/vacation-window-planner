import { annualSnapshotSchema, type AnnualSnapshot } from './savedAnnualPlans'

export type YearCardOptions = { title: string; includeLeaveDetails: boolean }
export const yearCardPalette = {
  paper: '#fbfaf8',
  ink: '#30243a',
  muted: '#62586c',
  plum: '#643b72',
  lavender: '#e9dff0',
  line: '#d7cddd',
}
function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}
function text(x: number, y: number, value: string, size = 18, color = yearCardPalette.ink): string {
  return `<text x="${x}" y="${y}" font-size="${size}" fill="${color}">${escapeXml(value)}</text>`
}

export function yearCardSvg(snapshot: AnnualSnapshot, options: YearCardOptions): string {
  if (
    !options.title.trim() ||
    Array.from(options.title).length > 80 ||
    Array.from(options.title).some(
      (character) => character.codePointAt(0)! < 32 || character.codePointAt(0) === 127,
    )
  )
    throw new Error('Choose a card title of 1–80 characters')
  const titleLines: string[] = []
  let remainingTitle = Array.from(options.title.trim())
  while (remainingTitle.length) {
    let end = Math.min(34, remainingTitle.length)
    if (end < remainingTitle.length) {
      const space = remainingTitle.slice(0, end).lastIndexOf(' ')
      if (space > 16) end = space
    }
    titleLines.push(remainingTitle.slice(0, end).join(''))
    remainingTitle = remainingTitle.slice(end)
    if (remainingTitle[0] === ' ') remainingTitle.shift()
  }
  const { result } = annualSnapshotSchema.parse(snapshot)
  const plan = result.plans[0]
  const selected = new Map(
    plan.breaks.flatMap((item) => item.day_details.map((day) => [day.date, item.locked] as const)),
  )
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1800" viewBox="0 0 1200 1800" role="img" aria-label="Year of time away" font-family="Arial, sans-serif">`,
    `<rect width="1200" height="1800" rx="32" fill="${yearCardPalette.paper}"/>`,
    text(72, 88, String(result.input.year), 44, yearCardPalette.plum),
    ...titleLines.map((line, index) =>
      text(72, 132 + index * 29, line, 30).replace('<text ', '<text data-title="true" '),
    ),
    text(72, 262, `${plan.accounting.total_days_away} days away`, 52, yearCardPalette.plum),
    text(750, 262, `${plan.breaks.length} breaks`, 38),
    text(72, 322, 'Time away · outlined dates are locked', 18, yearCardPalette.muted),
  ]
  if (options.includeLeaveDetails)
    parts.push(
      text(
        72,
        296,
        `${plan.accounting.available_days} available leave · ${plan.accounting.total_leave_used} leave used · ${plan.accounting.remaining_days} remaining leave · ${plan.accounting.reserve_days} protected reserve`,
        18,
        yearCardPalette.muted,
      ),
    )
  for (let month = 1; month <= 12; month++) {
    const days = result.year_calendar.filter((day) => Number(day.date.slice(5, 7)) === month)
    const x = 72 + ((month - 1) % 3) * 355
    const y = 365 + Math.floor((month - 1) / 3) * 232
    parts.push(
      `<g data-month="${month}">`,
      text(
        x,
        y,
        new Intl.DateTimeFormat('en', { month: 'long', timeZone: 'UTC' }).format(
          new Date(days[0].date),
        ),
        23,
      ),
    )
    const offset = (new Date(days[0].date).getUTCDay() + 6) % 7
    for (const [index, label] of ['M', 'T', 'W', 'T', 'F', 'S', 'S'].entries())
      parts.push(text(x + index * 40 + 10, y + 29, label, 13, yearCardPalette.muted))
    days.forEach((day, index) => {
      const dx = x + ((offset + index) % 7) * 40
      const dy = y + 42 + Math.floor((offset + index) / 7) * 28
      const chosen = selected.has(day.date)
      const locked = selected.get(day.date) === true
      parts.push(
        `<g data-date="${day.date}" data-selected="${chosen}" data-locked="${locked}"><rect x="${dx}" y="${dy}" width="36" height="26" rx="7" fill="${chosen ? yearCardPalette.lavender : yearCardPalette.paper}" stroke="${locked ? yearCardPalette.plum : 'none'}" stroke-width="2"/>`,
        text(
          dx + 7,
          dy + 19,
          String(Number(day.date.slice(8))),
          17,
          chosen ? yearCardPalette.plum : yearCardPalette.muted,
        ),
        '</g>',
      )
    })
    parts.push('</g>')
  }
  parts.push(text(72, 1310, 'Your time away', 27, yearCardPalette.plum))
  plan.breaks.forEach((item, index) => {
    const number = result.input.slots.findIndex((slot) => slot.slot_id === item.slot_id) + 1
    const y = 1360 + index * 44
    parts.push(
      text(72, y, `Break ${number}${item.locked ? ' · locked dates' : ''}`, 18),
      text(380, y, `${item.window.start_date} – ${item.window.end_date}`, 21),
      text(955, y, `${item.window.total_days} days`, 18),
    )
  })
  if (plan.fulfillment === 'reduced')
    parts.push(
      text(
        72,
        1650,
        `Reduced mix: ${plan.breaks.length} of ${result.input.slots.length} breaks · omitted: ${plan.omitted_slot_ids.map((id) => `Break ${result.input.slots.findIndex((slot) => slot.slot_id === id) + 1}`).join(', ')}`,
        19,
        yearCardPalette.plum,
      ),
    )
  parts.push(
    text(
      72,
      1730,
      `Calculated ${result.calculation_context.local_today} · ${result.calculation_context.planning.time_zone}`,
      17,
      yearCardPalette.muted,
    ),
    text(72, 1764, 'Proposed plan · leave approval is separate', 17, yearCardPalette.muted),
    '</svg>',
  )
  return parts.join('')
}
