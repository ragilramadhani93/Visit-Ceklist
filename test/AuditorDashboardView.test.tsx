import React from 'react'
import { render, screen } from '@testing-library/react'
import AuditorDashboardView from '@/components/auditor/AuditorDashboardView'
import { Role } from '@/types'

const user = { id: 'u1', name: 'Rina Auditor', email: 'r@x.com', role: Role.Auditor, avatar_url: null, location: null }

test('renders welcome and empty states', () => {
  render(
    <AuditorDashboardView
      user={user}
      onSelectChecklist={() => {}}
      checklists={[]}
      tasks={[]}
      users={[user]}
      onResolveTask={async () => {}}
    />
  )
  expect(screen.getByText(/Welcome, Rina/i)).toBeInTheDocument()
  expect(screen.getByText('No pending checklists assigned.')).toBeInTheDocument()
  expect(screen.getByText('No open tasks. Great job!')).toBeInTheDocument()
})
