import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import Modal from '@/components/shared/Modal'

test('Modal shows children when open and closes on overlay/close button', () => {
  const onClose = vi.fn()
  const { container } = render(
    <Modal isOpen={true} onClose={onClose} title="My Modal">
      <div>Hello Content</div>
    </Modal>
  )

  expect(screen.getByText('My Modal')).toBeInTheDocument()
  expect(screen.getByText('Hello Content')).toBeInTheDocument()

  fireEvent.click(container.firstChild as HTMLElement)
  expect(onClose).toHaveBeenCalledTimes(1)

  const closeBtn = screen.getByRole('button')
  fireEvent.click(closeBtn)
  expect(onClose).toHaveBeenCalledTimes(2)
})

test('Modal returns null when closed', () => {
  const { queryByText } = render(
    <Modal isOpen={false} onClose={() => {}} title="Hidden" />
  )
  expect(queryByText('Hidden')).toBeNull()
})
