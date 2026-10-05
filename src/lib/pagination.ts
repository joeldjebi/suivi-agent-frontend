import { useState } from 'react'

/** Découpe une liste en pages côté navigateur. La page est ramenée dans les bornes si la liste raccourcit. */
export function usePaged<T>(items: T[], pageSize = 20) {
  const [page, setPage] = useState(1)
  const pages = Math.max(1, Math.ceil(items.length / pageSize))
  const current = Math.min(page, pages)
  return {
    page: current,
    pages,
    total: items.length,
    pageSize,
    setPage,
    items: items.slice((current - 1) * pageSize, current * pageSize),
  }
}
