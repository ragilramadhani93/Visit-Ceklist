import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import FindingsView from '@/components/findings/FindingsView'
import { TaskPriority, Role } from '@/types'

const baseUser = { id: 'u1', name: 'Auditor One', email: 'a@x.com', role: Role.Auditor, avatar_url: null, location: null }

test('renders empty state when no tasks', () => {
  render(<FindingsView tasks={[]} checklists={[]} users={[baseUser]} onResolveTask={async () => {}} />)
  expect(screen.getByText('Audit Findings')).toBeInTheDocument()
  expect(screen.getByText('No Findings Found')).toBeInTheDocument()
})

test('renders a finding card and supports filter', () => {
  const checklist = { id: 'c1', title: 'Store A', location: 'Jakarta', assigned_to: 'u1', due_date: null, status: 'pending', items: [{ id: 'i1', question: 'Clean floor?', type: 'yes-no', required: true }], created_at: '2024-01-01' }
  const task = { id: 't1', title: 'Fix wet floor', checklist_item_id: 'i1', priority: TaskPriority.High, assigned_to: 'u1', due_date: '2024-02-01', status: 'open', description: 'Area near entrance', photo: null, proof_of_fix: null, checklist_id: 'c1', created_at: '2024-01-10' }

  render(<FindingsView tasks={[task]} checklists={[checklist]} users={[baseUser]} onResolveTask={async () => {}} />)
  expect(screen.getByText('Fix wet floor')).toBeInTheDocument()
  const statusSelect = screen.getByLabelText('Status')
  fireEvent.change(statusSelect, { target: { value: 'resolved' } })
  expect(screen.getByText('No Findings Found')).toBeInTheDocument()
})
