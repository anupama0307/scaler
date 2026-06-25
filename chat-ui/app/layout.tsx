import type { Metadata, Viewport } from 'next';
import { Space_Grotesk } from 'next/font/google';
import { Analytics } from '@vercel/analytics/react';
import './globals.css';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'],
  variable: '--font-space',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Anupama Nair — AI Representative',
  description:
    'Chat with the AI representative of Anupama Nair, CS undergraduate at Amrita Vishwa Vidyapeetham. Get to know her background, projects, research, and skills.',
  keywords: ['Anupama Nair', 'AI Engineer', 'Portfolio', 'Chatbot', 'Research'],
  authors: [{ name: 'Anupama Nair' }],
  openGraph: {
    title: 'Anupama Nair — AI Representative',
    description:
      'Chat with the AI representative of Anupama Nair — researcher, builder, Visteon Scholar.',
    type: 'website',
    locale: 'en_US',
    siteName: 'Anupama Nair AI Chat',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Anupama Nair — AI Representative',
    description:
      'Chat with the AI representative of Anupama Nair — researcher, builder, Visteon Scholar.',
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#070a11',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={spaceGrotesk.variable} suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="dark" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><circle cx='16' cy='16' r='16' fill='%2322d3ee'/><text x='16' y='21' text-anchor='middle' font-size='14' font-family='Arial' font-weight='700' fill='white'>A</text></svg>" />
      </head>
      <body suppressHydrationWarning>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
