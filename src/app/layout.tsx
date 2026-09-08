import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "Ceres - Controle de Precos",
  description: "Controle de precos de alimentos via leitura de notas fiscais",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground" suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <Header />
          <main className="container mx-auto px-4 py-8">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
