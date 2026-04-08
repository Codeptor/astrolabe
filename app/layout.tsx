import "./globals.css"
import { ThemeProvider } from "next-themes"
import type { Metadata, Viewport } from "next"

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://astrolabe.bhanueso.dev"

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Astrolabe — interactive Pioneer plaque pulsar map",
    template: "%s · Astrolabe",
  },
  description:
    "Pick any star in the galaxy and generate a Pioneer-plaque-style pulsar map for it. 14 best pulsars selected via GDOP, rendered in authentic 1972 line art with binary period encoding.",
  applicationName: "Astrolabe",
  authors: [{ name: "Bhanu", url: "https://bhanueso.dev" }],
  creator: "Bhanu",
  publisher: "Bhanu",
  keywords: [
    "pulsar map",
    "pioneer plaque",
    "voyager plaque",
    "pulsar triangulation",
    "galactic coordinates",
    "ATNF",
    "astronomy",
    "data visualization",
  ],
  referrer: "origin-when-cross-origin",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "Astrolabe",
    title: "Astrolabe — interactive Pioneer plaque pulsar map",
    description:
      "Pick any star in the galaxy and generate a Pioneer-plaque-style pulsar map for it.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Astrolabe — interactive Pioneer plaque pulsar map",
    description:
      "Pick any star in the galaxy and generate a Pioneer-plaque-style pulsar map for it.",
    creator: "@codeptor",
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0a10" },
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  colorScheme: "dark light",
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
