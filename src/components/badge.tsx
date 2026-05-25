type CategoryBadgeType =
  | 'BREAKING'
  | 'SECURITY'
  | 'FEATURE'
  | 'PERF'
  | 'BUGFIX'
  | 'DEPRECATION'
  | 'DOCS'
  | 'INTERNAL'
  | 'UPDATE'
  | 'ARTICLE'

const categoryStyles: Record<CategoryBadgeType, { className: string; dot: string }> = {
  BREAKING:    { className: 'bg-red-50 text-red-700 border border-red-200',          dot: 'bg-red-500' },
  SECURITY:    { className: 'bg-orange-50 text-orange-700 border border-orange-200', dot: 'bg-orange-500' },
  FEATURE:     { className: 'bg-blue-50 text-blue-700 border border-blue-200',       dot: 'bg-blue-500' },
  PERF:        { className: 'bg-violet-50 text-violet-700 border border-violet-200', dot: 'bg-violet-500' },
  BUGFIX:      { className: 'bg-yellow-50 text-yellow-700 border border-yellow-200', dot: 'bg-yellow-500' },
  DEPRECATION: { className: 'bg-orange-50 text-orange-600 border border-orange-200', dot: 'bg-orange-400' },
  DOCS:        { className: 'bg-gray-50 text-gray-600 border border-gray-200',       dot: 'bg-gray-400' },
  INTERNAL:    { className: 'bg-gray-50 text-gray-500 border border-gray-200',       dot: 'bg-gray-300' },
  UPDATE:      { className: 'bg-emerald-50 text-emerald-700 border border-emerald-200', dot: 'bg-emerald-500' },
  ARTICLE:     { className: 'bg-blue-50 text-blue-600 border border-blue-200',       dot: 'bg-blue-400' },
}

export function CategoryBadge({ type }: { type: string }) {
  const normalized = type.toUpperCase() as CategoryBadgeType
  const style = categoryStyles[normalized] ?? { className: 'bg-gray-50 text-gray-600 border border-gray-200', dot: 'bg-gray-400' }
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full tracking-wide ${style.className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot} shrink-0`} />
      {normalized}
    </span>
  )
}

export function SeverityBadge({ severity }: { severity: number }) {
  const { className } = getSeverityStyle(severity)
  const label = severity >= 5 ? 'CRITICAL' : severity === 4 ? 'HIGH' : severity === 3 ? 'MEDIUM' : severity === 2 ? 'LOW' : 'MINIMAL'
  return (
    <span className={`inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-full tracking-wide ${className}`}>
      {label}
    </span>
  )
}

function getSeverityStyle(severity: number): { className: string } {
  if (severity >= 5) return { className: 'bg-red-600 text-white' }
  if (severity === 4) return { className: 'bg-red-100 text-red-700 border border-red-300' }
  if (severity === 3) return { className: 'bg-orange-100 text-orange-700 border border-orange-300' }
  if (severity === 2) return { className: 'bg-yellow-100 text-yellow-700 border border-yellow-300' }
  return { className: 'bg-gray-100 text-gray-500 border border-gray-200' }
}

export function getSeverityColor(severity: number): string {
  return getSeverityStyle(severity).className
}
