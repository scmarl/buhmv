import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../api/client'

export interface User {
  id: number
  username: string
  email: string
  role: 'admin' | 'office' | 'teamlead' | 'member'
  member_id: number | null
}

export function useMe() {
  return useQuery<User>({
    queryKey: ['me'],
    queryFn: () => api.get('/auth/me').then((r) => r.data),
    retry: false,
  })
}

export function useLogin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ username, password }: { username: string; password: string }) => {
      const form = new URLSearchParams({ username, password })
      const res = await api.post('/auth/login', form, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
      sessionStorage.setItem('token', res.data.access_token)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  })
}

export function useLogout() {
  const qc = useQueryClient()
  return () => {
    sessionStorage.removeItem('token')
    qc.clear()
    window.location.href = '/login'
  }
}
