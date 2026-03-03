import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ResolveFindingModal from '@/components/findings/ResolveFindingModal'
import { TaskPriority } from '@/types'

vi.mock('@/utils/fileUtils', () => ({
  blobToBase64: async () => 'AAA_BASE64'
}))

const finding = {
  id: 't1',
  title: 'Fix spill',
  checklist_item_id: 'i1',
  priority: TaskPriority.High,
  assigned_to: 'u1',
  due_date: '2024-02-01',
  status: 'open',
  description: 'Entrance area',
  photo: null,
  proof_of_fix: null,
  checklist_id: 'c1',
  created_at: '2024-01-10'
}

test('requires photo before resolving and calls onResolve with base64', async () => {
  const onResolve = vi.fn(async () => {})
  const onClose = vi.fn()

  render(
    <ResolveFindingModal isOpen={true} onClose={onClose} finding={finding} onResolve={onResolve} />
  )

  const resolveBtn = screen.getByRole('button', { name: /Mark as Resolved/i })
  expect(resolveBtn).toBeDisabled()

  const uploadTrigger = screen.getByText(/Click to upload photo/i)
  fireEvent.click(uploadTrigger)

  const file = new File([new Uint8Array([1, 2, 3])], 'proof.png', { type: 'image/png' })
  const input = document.querySelector('input[type="file"]') as HTMLInputElement
  fireEvent.change(input, { target: { files: [file] } })

  await waitFor(() => expect(resolveBtn).not.toBeDisabled())
  fireEvent.click(resolveBtn)

  await waitFor(() => expect(onResolve).toHaveBeenCalledWith('t1', { photo: 'AAA_BASE64' }))
})

test('clear photo button resets state', async () => {
  const onResolve = vi.fn(async () => {})
  render(
    <ResolveFindingModal isOpen={true} onClose={() => {}} finding={finding} onResolve={onResolve} />
  )

  const uploadTrigger = screen.getByText(/Click to upload photo/i)
  fireEvent.click(uploadTrigger)

  const file = new File([new Uint8Array([4, 5])], 'proof2.png', { type: 'image/png' })
  const input = document.querySelector('input[type="file"]') as HTMLInputElement
  fireEvent.change(input, { target: { files: [file] } })

  const removeBtn = await screen.findByRole('button', { name: /Remove photo/i })
  fireEvent.click(removeBtn)

  const resolveBtn = screen.getByRole('button', { name: /Mark as Resolved/i })
  await waitFor(() => expect(resolveBtn).toBeDisabled())
})
