import './globals.css';

export const metadata = {
  title: 'Accessory Counter',
  description: 'Phone cases, chargers, cables and more. Order online and collect from the shop.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Accessory Counter', statusBarStyle: 'default' },
};

export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#0b63f6' };

export default function RootLayout({ children }) {
  return (
    <html lang="en-GB">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700&family=Figtree:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
