import type { Metadata } from "next"
import { Geist, Instrument_Serif } from "next/font/google"

import { Providers } from "@/components/providers"
import "./globals.css"

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
})

const instrument = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-instrument",
})

export const metadata: Metadata = {
  title: "Lumina — AI video ads from product stills",
  description:
    "Turn any product photo into a scroll-stopping video ad in 60 seconds. No filming. No editing. No agency. 3 credits on signup.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${geist.variable} ${instrument.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
