import React from 'react'
import { render, screen } from '@testing-library/react'
import Avatar from '@/components/shared/Avatar'

describe('Avatar', () => {
  it('renders image when avatar_url provided', () => {
    render(<Avatar user={{ id: 'u1', name: 'Alice Doe', avatar_url: 'https://example.com/a.png' }} />)
    const img = screen.getByRole('img', { name: 'Alice Doe' })
    expect(img).toBeInTheDocument()
  })

  it('renders initials when no avatar_url', () => {
    render(<Avatar user={{ id: 'u2', name: 'Jane Doe', avatar_url: null }} />)
    expect(screen.getByText('JD')).toBeInTheDocument()
  })
})
