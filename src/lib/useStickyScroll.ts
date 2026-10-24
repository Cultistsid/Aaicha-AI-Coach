import { useCallback, useEffect, useRef, useState } from "react"

const PIN_THRESHOLD_PX = 48

// Keeps a scroll pane following its bottom edge only while the user is
// already there. Scrolling up unpins; `jumpToLatest` re-pins. `dep` is any
// value that changes when content grows (combined text length works).
// Callback-ref so remounts (overlay flip) re-attach the scroll listener.
export function useStickyScroll<T extends HTMLElement>(dep: unknown) {
  const [el, setEl] = useState<T | null>(null)
  const [pinned, setPinned] = useState(true)
  const pinnedRef = useRef(true)

  const ref = useCallback((node: T | null) => setEl(node), [])

  useEffect(() => {
    if (!el) return
    const onScroll = () => {
      const atBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight <= PIN_THRESHOLD_PX
      pinnedRef.current = atBottom
      setPinned(atBottom)
    }
    el.addEventListener("scroll", onScroll, { passive: true })
    // Fresh mount starts pinned at the bottom.
    pinnedRef.current = true
    setPinned(true)
    el.scrollTop = el.scrollHeight
    return () => el.removeEventListener("scroll", onScroll)
  }, [el])

  // Follow growth only while pinned. Instant, never smooth — queued smooth
  // animations are what caused the yank during token streaming.
  useEffect(() => {
    if (el && pinnedRef.current) el.scrollTop = el.scrollHeight
  }, [dep, el])

  const jumpToLatest = useCallback(() => {
    if (!el) return
    el.scrollTop = el.scrollHeight
    pinnedRef.current = true
    setPinned(true)
  }, [el])

  return { ref, pinned, jumpToLatest }
}
