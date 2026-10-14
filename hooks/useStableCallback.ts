import { useCallback, useLayoutEffect, useRef } from 'react'

// Returns a function that keeps the same identity across renders but always
// calls the latest `callback`, so memoized children are not re-rendered just
// because a parent recreated a handler.
export function useStableCallback<Args extends unknown[], Result>(
  callback: (...args: Args) => Result
) {
  const callbackRef = useRef(callback)

  useLayoutEffect(() => {
    callbackRef.current = callback
  })

  return useCallback((...args: Args) => callbackRef.current(...args), [])
}
