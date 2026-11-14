import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function LoginPage({ onSuccess }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    setPassword(e.target.value.replace(/\D/g, '').slice(0, 4))
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password.length !== 4) {
      setError('请输入 4 位数字密码')
      return
    }
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (response.ok) {
        onSuccess()
      } else {
        setError('密码错误')
        setPassword('')
      }
    } catch {
      setError('请求失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="grid-bg" aria-hidden="true" />
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>TikViews</h1>
        <p>请输入 4 位数字密码以继续</p>
        <div className="login-field">
          <Input
            id="login-password"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            value={password}
            onChange={handleChange}
            aria-invalid={Boolean(error)}
            autoFocus
          />
        </div>
        {error && <p className="login-error">{error}</p>}
        <Button type="submit" disabled={loading || password.length !== 4}>
          {loading ? '验证中...' : '进入'}
        </Button>
      </form>
    </div>
  )
}
