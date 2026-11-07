import type { ImageRule, PointDefinition } from '../types'
import { isBooleanPoint, isOn, isStringPoint, toNumber, uid } from './graph'

function makeRule(partial: Partial<ImageRule> & { label: string; url?: string }): ImageRule {
  return {
    id: partial.id ?? uid('img'),
    label: partial.label,
    url: partial.url ?? '',
    matchValue: partial.matchValue,
    min: partial.min,
    max: partial.max,
  }
}

function existingRule(
  previous: ImageRule[],
  match: (rule: ImageRule) => boolean,
  urlFallback = '',
) {
  const found = previous.find(match)
  return {
    url: found?.url ?? urlFallback,
  }
}

function firstImage(previous: ImageRule[]) {
  return previous.find((rule) => rule.url)?.url ?? ''
}

function rangesFor(point: PointDefinition): Array<{ min: number; max: number }> {
  const min = Number(point.min)
  const max = Number(point.max)
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    return [{ min: 0, max: 100 }]
  }
  const step = (max - min) / 3
  return [
    { min, max: Number((min + step).toFixed(2)) },
    { min: Number((min + step).toFixed(2)), max: Number((min + step * 2).toFixed(2)) },
    { min: Number((min + step * 2).toFixed(2)), max },
  ]
}

export function createImageStatesForPoint(
  point?: PointDefinition | null,
  previous: ImageRule[] = [],
): ImageRule[] {
  if (!point) {
    const first = previous[0]
    return [
      makeRule({
        id: first?.id,
        label: '默认图片',
        url: first?.url ?? '',
      }),
    ]
  }

  if (isBooleanPoint(point)) {
    return [true, false].map((value, index) => {
      const existing = existingRule(previous, (rule) => rule.matchValue === value)
      return makeRule({
        label:
          value
            ? point.boolLabels?.[0] ?? 'TRUE'
            : point.boolLabels?.[1] ?? 'FALSE',
        matchValue: value,
        url: existing.url || (index === 0 ? firstImage(previous) : ''),
      })
    })
  }

  if (isStringPoint(point)) {
    const options = point.options?.length
      ? point.options
      : [{ label: String(point.value), value: String(point.value) }]
    const fallback = firstImage(previous)
    return options.map((option, index) => {
      const existing = existingRule(
        previous,
        (rule) => String(rule.matchValue) === String(option.value),
      )
      return makeRule({
        label: option.label,
        matchValue: option.value,
        url: existing.url || (index === 0 ? fallback : ''),
      })
    })
  }

  const existingRanges = previous.filter(
    (rule) => Number.isFinite(rule.min) && Number.isFinite(rule.max),
  )
  if (existingRanges.length) {
    return existingRanges.map((rule) => ({ ...rule }))
  }
  const fallback = firstImage(previous)
  return rangesFor(point).map((range, index) =>
    makeRule({
      label: `${range.min} – ${range.max}`,
      min: range.min,
      max: range.max,
      url: index === 0 ? fallback : '',
    }),
  )
}

export function resolveImageState(
  point: PointDefinition | undefined,
  states: ImageRule[] | undefined,
): ImageRule | undefined {
  const rules = states ?? []
  if (!rules.length) return undefined
  if (!point) return rules[0]
  if (isBooleanPoint(point)) {
    const active = isOn(point)
    return rules.find((rule) => rule.matchValue === active) ?? rules[0]
  }
  if (isStringPoint(point)) {
    return (
      rules.find((rule) => String(rule.matchValue) === String(point.value)) ??
      rules[0]
    )
  }
  const value = toNumber(point.value)
  const ranges = rules.filter(
    (rule) => Number.isFinite(rule.min) && Number.isFinite(rule.max),
  )
  if (!ranges.length) return rules[0]
  const halfOpen = ranges.find(
    (rule) => value >= Number(rule.min) && value < Number(rule.max),
  )
  if (halfOpen) return halfOpen
  return ranges.find(
    (rule) => value >= Number(rule.min) && value <= Number(rule.max),
  )
}

export function imageStateLabel(
  rule: ImageRule | undefined,
  point?: PointDefinition,
): string {
  if (!rule) return point ? '无匹配图片' : '未配置图片'
  return rule.label
}

export function makeEmptyImageRule(label: string): ImageRule {
  return makeRule({ label, url: '' })
}
