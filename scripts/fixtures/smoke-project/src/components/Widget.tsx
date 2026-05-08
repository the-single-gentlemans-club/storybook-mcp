import React from 'react'

export interface WidgetProps {
  label: string
}

export function Widget({ label }: WidgetProps) {
  return <span data-testid="widget">{label}</span>
}
