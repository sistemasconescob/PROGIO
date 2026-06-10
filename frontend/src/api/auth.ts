import { api } from './client'
import type { User } from '../types'

export const login = (username: string, password: string) =>
  api.post<{ access_token: string; refresh_token: string }>('/auth/login', { username, password })

export const getMe = () => api.get<User>('/auth/me')

export const changePassword = (current_password: string, new_password: string) =>
  api.put('/auth/change-password', { current_password, new_password })
