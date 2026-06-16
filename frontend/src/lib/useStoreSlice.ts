import { useSyncExternalStore } from 'react'
import type { StoreApi } from 'zustand/vanilla'

export function useStoreSlice<T, U>(
  store: StoreApi<T>,
  selector: (state: T) => U
): U {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(store.getState())
  )
}
