import { Poppins } from 'next/font/google';
import './globals.css';
import Providers from '@/components/Providers';

// Load Poppins with the specific weights and subsets needed
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins', // Defines a CSS variable name
  display: 'swap',
});

export const metadata = {
  title: 'Luna - A new light on conversation',
  description: 'Real-time messaging application',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={poppins.variable}>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}