import "./globals.css"
import { ThemeProvider } from "next-themes"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "astrolabe",
  description: "what would your Pioneer plaque look like?",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className="min-h-svh antialiased"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          themes={["dark", "light", "gold", "blueprint"]}
          enableSystem={false}
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
