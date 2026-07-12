import { redirect } from 'next/navigation'
import { requireAdminSession } from '@/lib/admin/session'
import { AdminShell } from '@/components/admin/admin-shell'

export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  let admin
  try {
    admin = await requireAdminSession()
  } catch {
    redirect('/admin/login')
  }

  return (
    <AdminShell username={admin.username} role={admin.role}>
      {children}
    </AdminShell>
  )
}
