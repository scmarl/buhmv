import { useForm } from 'react-hook-form'
import { useLogin, useMe } from '../hooks/useAuth'
import { Navigate } from 'react-router-dom'

export default function LoginPage() {
  const { data: user } = useMe()
  const login = useLogin()
  const { register, handleSubmit, formState: { errors } } = useForm<{ username: string; password: string }>()

  if (user) return <Navigate to="/members" replace />

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f6f9' }}>
      <div style={{ background: '#fff', padding: 40, borderRadius: 8, boxShadow: '0 2px 16px rgba(0,0,0,0.10)', width: 340 }}>
        <h1 style={{ marginBottom: 24, fontSize: 22, fontWeight: 700 }}>BuHMV</h1>
        <form onSubmit={handleSubmit((data) => login.mutate(data))}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>Benutzername</label>
            <input {...register('username', { required: true })}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 4 }} />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>Passwort</label>
            <input type="password" {...register('password', { required: true })}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 4 }} />
          </div>
          {login.isError && <div style={{ color: 'red', marginBottom: 12, fontSize: 13 }}>Anmeldung fehlgeschlagen</div>}
          <button type="submit" disabled={login.isPending}
            style={{ width: '100%', padding: '10px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, fontWeight: 600, cursor: 'pointer' }}>
            {login.isPending ? 'Anmelden…' : 'Anmelden'}
          </button>
        </form>
      </div>
    </div>
  )
}
