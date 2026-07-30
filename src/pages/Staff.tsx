import { PageHeader } from '../components/ui'
import { StaffSection } from './Settings'

export default function Staff() {
  return (
    <div>
      <PageHeader
        title="Staff"
        subtitle="Manage cashiers, managers, and permissions"
      />
      <div className="card p-4">
        <StaffSection />
      </div>
    </div>
  )
}
