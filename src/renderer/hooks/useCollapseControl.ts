import { createContext, useContext, useState, useCallback } from 'react'

interface CollapseControl {
  /** Increment to force all collapsibles to expand */
  expandSignal: number
  /** Increment to force all collapsibles to collapse */
  collapseSignal: number
  expandAll: () => void
  collapseAll: () => void
}

export const CollapseContext = createContext<CollapseControl>({
  expandSignal: 0,
  collapseSignal: 0,
  expandAll: () => {},
  collapseAll: () => {}
})

export function useCollapseControl() {
  return useContext(CollapseContext)
}

export function useCollapseProvider() {
  const [expandSignal, setExpandSignal] = useState(0)
  const [collapseSignal, setCollapseSignal] = useState(0)

  const expandAll = useCallback(() => setExpandSignal((n) => n + 1), [])
  const collapseAll = useCallback(() => setCollapseSignal((n) => n + 1), [])

  return { expandSignal, collapseSignal, expandAll, collapseAll }
}
