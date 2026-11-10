import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "Sri Hanuman Sri Ramalingeshwara Devalayam | Lalapet",
  description: "Online pooja booking and temple administration"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
