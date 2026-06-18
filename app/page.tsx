import { AppSidebar } from '@/components/app-sidebar'
import { Workspace } from '@/components/workspace'
import { ContextPanel } from '@/components/context-panel'

export default function Page() {
  return (
    <div className="flex h-screen w-full overflow-hidden">
      <AppSidebar />
      <Workspace />
      <ContextPanel />
    </div>
  )
}
