import { OpsTabs } from "./ops-tabs"

export default function OperationsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <OpsTabs />
      {children}
    </div>
  )
}
