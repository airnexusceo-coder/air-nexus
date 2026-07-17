import { Analytics } from '@vercel/analytics/next'
import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font/sans'
import { Inter, Lora } from 'next/font/google'
import type { Metadata, Viewport } from 'next'
import { ProductionRuntime } from '@/components/production-runtime'
import { FONT_PREFERENCE_STORAGE_KEY } from '@/lib/font-preference'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const lora = Lora({ subsets: ['latin'], variable: '--font-lora', display: 'swap' })

// Applies the stored font preference before first paint, so switching fonts
// in Settings never causes a flash of the previous font on the next load.
const FONT_PREFERENCE_SCRIPT = `(function(){try{var v=localStorage.getItem(${JSON.stringify(FONT_PREFERENCE_STORAGE_KEY)});if(v)document.documentElement.setAttribute('data-font',v);}catch(e){}})();`

export const metadata: Metadata = {
  title: 'Air Nexus — Intelligence Without Limits',
  description:
    'Air Nexus is a next-generation AI platform powered by AirGPT for learning, creation, research, and productive work.',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#050505',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`dark ${GeistSans.variable} ${GeistMono.variable} ${inter.variable} ${lora.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: FONT_PREFERENCE_SCRIPT }} />
      </head>
      <body className="font-sans antialiased">
        {children}
        <ProductionRuntime />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
