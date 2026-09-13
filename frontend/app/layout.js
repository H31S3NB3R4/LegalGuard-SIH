import { Inter } from "next/font/google";
import "./globals.css";
import DemoBanner from "./DemoBanner";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata = {
  title: "LegalGuard — Legal Metrology Compliance",
  description:
    "AI-Powered Legal Metrology Compliance for E-commerce. Ensuring consumer protection and regulatory empowerment.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        <DemoBanner />
        {children}
      </body>
    </html>
  );
}
