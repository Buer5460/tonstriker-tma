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
      </body>
    </html>
  );
}