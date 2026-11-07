import { useMemo, useRef, useState } from 'react'
import { AlertTriangle, ImagePlus, Trash2, Upload } from 'lucide-react'
import type { ImageRule, PointDefinition } from '../types'
import {
  createImageStatesForPoint,
  makeEmptyImageRule,
} from '../lib/imageRules'
import { IMAGE_ACCEPT, IMAGE_TIP, imageFileToDataUrl } from '../lib/imageUpload'
import { isBooleanPoint, isStringPoint } from '../lib/graph'

interface ImageStateEditorProps {
  point?: PointDefinition
  states: ImageRule[]
  objectFit?: 'cover' | 'contain'
  onChange: (states: ImageRule[]) => void
  onObjectFitChange: (value: 'cover' | 'contain') => void
}

function ruleForType(point: PointDefinition | undefined) {
  if (!point) return 'none'
  if (isBooleanPoint(point)) return 'boolean'
  if (isStringPoint(point)) return 'enum'
  return 'number'
}

export function ImageStateEditor({
  point,
  states,
  objectFit = 'contain',
  onChange,
  onObjectFitChange,
}: ImageStateEditorProps) {
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const type = ruleForType(point)
  const editableEnum = type === 'enum' && !point?.options?.length

  const overlapping = useMemo(() => {
    if (type !== 'number') return false
    const ranges = states.filter(
      (rule) => Number.isFinite(rule.min) && Number.isFinite(rule.max),
    )
    return ranges.some((rule, index) =>
      ranges.slice(index + 1).some((next) => {
        const aMin = Number(rule.min)
        const aMax = Number(rule.max)
        const bMin = Number(next.min)
        const bMax = Number(next.max)
        return aMin < bMax && bMin < aMax
      }),
    )
  }, [states, type])

  const updateRule = (id: string, patch: Partial<ImageRule>) => {
    onChange(states.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)))
  }

  const chooseFile = async (rule: ImageRule, file: File | undefined) => {
    if (!file) return
    setError('')
    setBusyId(rule.id)
    try {
      const url = await imageFileToDataUrl(file)
      updateRule(rule.id, { url })
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : '图片上传失败')
    } finally {
      setBusyId(null)
      const input = inputRefs.current[rule.id]
      if (input) input.value = ''
    }
  }

  const addRange = () => {
    if (!point) return
    const ranges = states.filter(
      (rule) => Number.isFinite(rule.min) && Number.isFinite(rule.max),
    )
    const last = ranges[ranges.length - 1]
    const nextMin = last ? Number(last.max) : Number(point.min)
    const pointMax = Number(point.max)
    const nextMax = pointMax > nextMin ? pointMax : nextMin + 10
    onChange([
      ...states,
      { ...makeEmptyImageRule(`${nextMin} – ${nextMax}`), min: nextMin, max: nextMax },
    ])
  }

  const addEnumValue = () => {
    onChange([
      ...states,
      {
        ...makeEmptyImageRule(`值 ${states.length + 1}`),
        matchValue: `value${states.length + 1}`,
      },
    ])
  }

  const removeRule = (id: string) => {
    onChange(states.filter((rule) => rule.id !== id))
  }

  const rebuild = () => {
    setError('')
    onChange(createImageStatesForPoint(point, states))
  }

  return (
    <div className="image-state-editor">
      <div className="image-editor-head">
        <span className="image-editor-caption">
          {type === 'none'
            ? '未绑定点位 · 单张图片'
            : type === 'boolean'
              ? '布尔点位 · TRUE / FALSE 两张图'
              : type === 'number'
                ? '数字点位 · 按区间匹配图片'
                : '枚举点位 · 每个值对应一张图'}
        </span>
        <label className="image-fit-control">
          <span>填充</span>
          <select
            value={objectFit}
            onChange={(event) => onObjectFitChange(event.target.value as 'cover' | 'contain')}
          >
            <option value="cover">覆盖</option>
            <option value="contain">包含</option>
          </select>
        </label>
      </div>

      {states.length === 0 && (
        <button className="image-rebuild" onClick={rebuild}>
          <ImagePlus size={13} />
          生成图片状态
        </button>
      )}

      <div className={`image-rule-list ${type === 'boolean' ? 'is-pair' : ''}`}>
        {states.map((rule, index) => {
          const label =
            type === 'boolean'
              ? rule.matchValue
                ? point?.boolLabels?.[0] ?? 'TRUE'
                : point?.boolLabels?.[1] ?? 'FALSE'
              : type === 'number'
                ? `区间 ${index + 1}`
                : type === 'enum'
                  ? point?.options?.find(
                      (option) => String(option.value) === String(rule.matchValue),
                    )?.label ?? rule.label
                  : '默认图片'
          return (
            <div className="image-rule" data-image-rule={rule.id} key={rule.id}>
              <div className="image-rule-head">
                <span className="image-rule-label">{label}</span>
                {type === 'enum' && (
                  <code className="image-rule-value">
                    {String(rule.matchValue ?? '')}
                  </code>
                )}
                {type === 'number' && states.length > 1 && (
                  <button
                    className="image-rule-delete"
                    onClick={() => removeRule(rule.id)}
                    title="删除区间"
                    aria-label="删除区间"
                  >
                    <Trash2 size={10} />
                  </button>
                )}
                {editableEnum && (
                  <button
                    className="image-rule-delete"
                    onClick={() => removeRule(rule.id)}
                    title="删除枚举值"
                    aria-label="删除枚举值"
                  >
                    <Trash2 size={10} />
                  </button>
                )}
              </div>

              {type === 'number' && (
                <div className="image-range-inputs">
                  <input
                    className="text-input mono"
                    type="number"
                    value={rule.min ?? 0}
                    aria-label={`${label}下限`}
                    onChange={(event) => {
                      const min = Number(event.target.value)
                      updateRule(rule.id, {
                        min,
                        max: rule.max,
                        label: `${min} – ${rule.max ?? 0}`,
                      })
                    }}
                  />
                  <span>–</span>
                  <input
                    className="text-input mono"
                    type="number"
                    value={rule.max ?? 100}
                    aria-label={`${label}上限`}
                    onChange={(event) => {
                      const max = Number(event.target.value)
                      updateRule(rule.id, {
                        min: rule.min,
                        max,
                        label: `${rule.min ?? 0} – ${max}`,
                      })
                    }}
                  />
                  <small>{point?.unit}</small>
                </div>
              )}

              {editableEnum && (
                <input
                  className="text-input mono image-value-input"
                  value={String(rule.matchValue ?? '')}
                  aria-label={`${label}枚举值`}
                  onChange={(event) =>
                    updateRule(rule.id, {
                      matchValue: event.target.value,
                      label: event.target.value,
                    })
                  }
                />
              )}

              <button
                className={`image-upload-tile ${rule.url ? 'has-image' : ''}`}
                onClick={() => inputRefs.current[rule.id]?.click()}
                disabled={busyId === rule.id}
                title={rule.url ? '更换图片' : '上传图片'}
              >
                {rule.url ? (
                  <img src={rule.url} alt={label} draggable={false} />
                ) : (
                  <span className="image-upload-empty">
                    {busyId === rule.id ? <Upload size={17} /> : <ImagePlus size={17} />}
                    <strong>{busyId === rule.id ? '处理中…' : '上传图片'}</strong>
                    <small>PNG / JPG / WebP</small>
                  </span>
                )}
                {rule.url && (
                  <span className="image-replace-hint">
                    <Upload size={11} />
                    更换
                  </span>
                )}
                <input
                  ref={(element) => {
                    inputRefs.current[rule.id] = element
                  }}
                  type="file"
                  accept={IMAGE_ACCEPT}
                  hidden
                  data-image-upload={rule.id}
                  onChange={(event) => void chooseFile(rule, event.target.files?.[0])}
                />
              </button>

              {rule.url && (
                <button
                  className="image-clear"
                  onClick={() => updateRule(rule.id, { url: '' })}
                >
                  移除图片
                </button>
              )}
            </div>
          )
        })}
      </div>

      {type === 'number' && (
        <button className="image-add-rule" onClick={addRange}>
          <ImagePlus size={12} />
          添加区间
        </button>
      )}
      {editableEnum && (
        <button className="image-add-rule" onClick={addEnumValue}>
          <ImagePlus size={12} />
          添加枚举值
        </button>
      )}

      {type === 'number' && overlapping && (
        <div className="image-mapping-warning">
          <AlertTriangle size={12} />
          区间存在重叠，将按列表顺序匹配。
        </div>
      )}
      {error && (
        <div className="image-mapping-warning is-error">
          <AlertTriangle size={12} />
          {error}
        </div>
      )}
      <p className="image-mapping-tip">
        {type === 'number'
          ? '数值区间采用左闭右开匹配：0–20、20–50 时，20 归入第二个区间。'
          : type === 'boolean'
            ? '点位为 TRUE 时显示上图，为 FALSE 时显示下图。'
            : type === 'enum'
              ? '每个枚举值使用各自的图片，未匹配时显示第一张。'
              : '未绑定点位时仅使用一张图片。'}
      </p>
      <span className="image-storage-tip">{IMAGE_TIP}</span>
    </div>
  )
}
