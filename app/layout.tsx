import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'EcoTrace — Carbon Compliance Platform',
    template: '%s · EcoTrace',
  },
  description:
    'Track Scope 1–3 emissions, monitor department caps, search vendor ESG disclosures, and bridge PostgreSQL with MongoDB and pgvector.',
  applicationName: 'EcoTrace',
  authors: [{ name: 'EcoTrace DBMS Mini Project' }],
  keywords: [
    'carbon compliance',
    'GHG protocol',
    'PostgreSQL',
    'MongoDB',
    'pgvector',
    'Next.js',
  ],
};

export const viewport: Viewport = {
  themeColor: '#022c22',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
