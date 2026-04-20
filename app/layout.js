import { Analytics } from '@vercel/analytics/react';
import './globals.css';

export const metadata = {
  title: 'TONStriker',
  description: 'Web3 Football Prediction',
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh">
      <body>
        {children}
        {/* 🚀 注入全局流量雷达 */}
        <Analytics />
      </body>
    </html>
  );
}