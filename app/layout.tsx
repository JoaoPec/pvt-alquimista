import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { absolute: "PVT Alquimista — Arembepe" },
  description: "Psytrance, natureza e conexão sob a Lua Cheia, em Arembepe.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
