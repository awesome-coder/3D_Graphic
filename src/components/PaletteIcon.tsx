import type { ComponentType } from '../types'

export function PaletteIcon({ type }: { type: ComponentType }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.4,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  switch (type) {
    case 'rect':
      return (
        <svg viewBox="0 0 32 32" {...common}>
          <rect x="5" y="8" width="22" height="16" rx="2" />
        </svg>
      )
    case 'ellipse':
      return (
        <svg viewBox="0 0 32 32" {...common}>
          <circle cx="16" cy="16" r="10" />
        </svg>
      )
    case 'line':
      return (
        <svg viewBox="0 0 32 32" {...common}>
          <path d="M5 16h22M5 12v8M27 12v8" opacity=".9" />
        </svg>
      )
    case 'panel':
      return (
        <svg viewBox="0 0 32 32" {...common}>
          <rect x="4" y="6" width="24" height="20" rx="3" />
          <path d="M4 12h24M9 16h8M9 20h14" opacity=".65" />
          <circle cx="8" cy="9" r="1" fill="currentColor" />
        </svg>
      )
    case 'image':
      return (
        <svg viewBox="0 0 32 32" {...common}>
          <rect x="4" y="7" width="24" height="18" rx="2" />
          <circle cx="11" cy="13" r="2.2" />
          <path d="M5 23l7-6 5 4 4-3 6 5" />
        </svg>
      )
    case 'text':
      return (
        <svg viewBox="0 0 32 32" {...common}>
          <path d="M6 8V5h20v3M16 5v22M11 27h10" />
          <path d="M9 13h9M9 18h6" opacity=".45" />
        </svg>
      )
    case 'value':
      return (
        <svg viewBox="0 0 32 32" {...common}>
          <rect x="4" y="6" width="24" height="20" rx="3" />
          <path d="M8 11h7M8 17h10M8 23h5" opacity=".55" />
          <path d="M21 20l2-5 1 3 2-7" strokeWidth="1.6" />
        </svg>
      )
    case 'clock':
      return (
        <svg viewBox="0 0 32 32" {...common}>
          <circle cx="16" cy="16" r="11" />
          <path d="M16 9v7l5 3" />
          <path d="M16 4v2M28 16h-2M16 28v-2M4 16h2" opacity=".5" />
        </svg>
      )
    case 'status':
      return (
        <svg viewBox="0 0 32 32" {...common}>
          <circle cx="16" cy="16" r="10" />
          <circle cx="16" cy="16" r="5" fill="currentColor" fillOpacity=".2" />
          <path d="M16 3v4M16 25v4M3 16h4M25 16h4" opacity=".55" />
        </svg>
      )
    case 'gauge':
      return (
        <svg viewBox="0 0 32 32" {...common}>
          <path d="M5 23a11 11 0 1 1 22 0" />
          <path d="M16 23l6-8M10 8l-2-2M22 8l2-2M5 15H2M27 15h3" />
          <circle cx="16" cy="23" r="1.6" />
        </svg>
      )
    case 'progress':
      return (
        <svg viewBox="0 0 32 32" {...common}>
          <rect x="4" y="13" width="24" height="6" rx="3" />
          <path d="M4 16h13" strokeWidth="4" opacity=".55" />
          <path d="M8 7h10M8 24h7" opacity=".45" />
        </svg>
      )
    case 'trend':
      return (
        <svg viewBox="0 0 32 32" {...common}>
          <path d="M4 6v22h24" />
          <path d="M7 21l6-7 5 4 8-10" />
          <path d="M7 25l6-4 5 2 8-5" opacity=".35" />
        </svg>
      )
    case 'fan':
      return (
        <svg viewBox="0 0 32 32" {...common}>
          <circle cx="16" cy="16" r="11" />
          <path d="M16 16c-2-7 3-9 5-5 2 4-2 6-5 5Zm0 0c6-2 8 3 4 5-4 2-6-2-4-5Zm0 0c1 6-4 8-6 4-2-4 2-6 6-4Z" />
          <circle cx="16" cy="16" r="1.5" fill="currentColor" />
        </svg>
      )
    case 'tank':
      return (
        <svg viewBox="0 0 32 32" {...common}>
          <rect x="8" y="6" width="16" height="21" rx="5" />
          <path d="M8 18c3-2 5 2 8 0s5 2 8 0v5a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4v-5Z" fill="currentColor" fillOpacity=".13" />
          <path d="M11 4h10M8 11h3M21 11h3" opacity=".5" />
        </svg>
      )
    case 'button':
      return (
        <svg viewBox="0 0 32 32" {...common}>
          <rect x="4" y="10" width="24" height="12" rx="5" />
          <path d="M12 16h8M16 13l4 3-4 3" />
        </svg>
      )
    case 'switch':
      return (
        <svg viewBox="0 0 32 32" {...common}>
          <rect x="3" y="11" width="26" height="11" rx="5.5" />
          <circle cx="22" cy="16.5" r="3.6" fill="currentColor" fillOpacity=".2" />
          <path d="M8 16.5h5" opacity=".55" />
        </svg>
      )
    case 'slider':
      return (
        <svg viewBox="0 0 32 32" {...common}>
          <path d="M4 20h24" />
          <circle cx="20" cy="20" r="3.5" fill="currentColor" fillOpacity=".2" />
          <path d="M4 20h12" strokeWidth="3" opacity=".45" />
          <path d="M4 9h9M4 13h5" opacity=".5" />
        </svg>
      )
    case 'select':
      return (
        <svg viewBox="0 0 32 32" {...common}>
          <rect x="4" y="9" width="24" height="14" rx="3" />
          <path d="M8 16h9M21 14l2 2 2-2" />
        </svg>
      )
    case 'number':
      return (
        <svg viewBox="0 0 32 32" {...common}>
          <rect x="4" y="10" width="24" height="12" rx="3" />
          <path d="M9 13v6M8 16h2M20 13v6M18 16h4M23 16h3" opacity=".7" />
        </svg>
      )
    default:
      return null
  }
}
