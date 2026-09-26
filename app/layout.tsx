import type {Metadata} from 'next'
import {Caveat, Special_Elite} from 'next/font/google'
import './globals.css'

const hand = Caveat({subsets: ['latin'], variable: '--hand'})
const type = Special_Elite({weight: '400', subsets: ['latin'], variable: '--type'})

export const metadata: Metadata = {
  title: 'Permission Slip',
  description: 'AI agents need a signed permission slip before they do anything public. Built on Sanity Workflows.',
}

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={`${hand.variable} ${type.variable}`}>
      <body>{children}</body>
    </html>
  )
}
