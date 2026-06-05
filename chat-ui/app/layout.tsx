import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Anupama Nair — AI Representative',
  description:
    'Chat with the AI representative of Anupama Nair, CS undergraduate at Amrita Vishwa Vidyapeetham and candidate for the Scaler AI Engineer Intern role.',
  keywords: ['Anupama Nair', 'AI Engineer', 'Scaler', 'Portfolio', 'Research'],
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
  themeColor: '#0a0f1e',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="dark" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><circle cx='16' cy='16' r='16' fill='%237c3aed'/><text x='16' y='21' text-anchor='middle' font-size='14' font-family='Arial' font-weight='700' fill='white'>A</text></svg>" />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
