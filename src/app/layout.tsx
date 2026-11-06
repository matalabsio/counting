import type { Metadata } from "next";
import "./counting.css";

export const metadata: Metadata = {
  title: "Counting Day · Parvathipuram Manyam",
  description: "Live ZPTC and MPTC counting board for Parvathipuram Manyam district.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", background: "#f5f2e8" }}>{children}</body>
    </html>
  );
}
