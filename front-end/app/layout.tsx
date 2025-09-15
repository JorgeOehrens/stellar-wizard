import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { Analytics } from '@vercel/analytics/next'
import { WalletProvider } from './providers/WalletProvider'
import { ThemeProvider } from './providers/ThemeProvider'
import './globals.css'

export const metadata: Metadata = {
  title: 'Stellar Wizard - From Prompt to Blockchain in One Click',
  description: 'Create NFTs, deploy DeFi strategies, and interact with Stellar using natural language. AI-powered blockchain interactions made simple.',
  keywords: 'Stellar, blockchain, AI, DeFi, NFT, Soroban, Web3, natural language',
    icons: {
    icon: "/wizzard.svg",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <style>{`
html {
  font-family: ${GeistSans.style.fontFamily};
  --font-sans: ${GeistSans.variable};
  --font-mono: ${GeistMono.variable};
}
        `}</style>
      </head>
      <body>
        <ThemeProvider>
          <WalletProvider>
            {children}
          </WalletProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
