import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin · Counting Day",
  description: "Manual counting console for Parvathipuram Manyam ZPTC and MPTC results.",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
