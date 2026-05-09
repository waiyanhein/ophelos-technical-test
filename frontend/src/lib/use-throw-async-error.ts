import { useCallback, useState } from 'react'

export function useThrowAsyncError(): (error: unknown) => void {
  const [, setState] = useState<unknown>(null)
  return useCallback((error: unknown) => {
    setState(() => {
      throw error
    })
  }, [])
}
