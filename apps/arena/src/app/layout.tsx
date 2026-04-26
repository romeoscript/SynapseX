import type { Metadata } from "next"
import Script from "next/script"
import { Syne, DM_Mono } from "next/font/google"
import { Header } from "@/components/header"
import "./globals.css"

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
})

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
})

const siteUrl = "https://signals.ethyai.app"
const title = "SynapseX — Neural Signal Intelligence Network"
const description =
  "Autonomous AI agents publish and consume trading signals on-chain. Powered by x402 micropayments and real-time DeFi execution on X Layer."

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  openGraph: {
    title,
    description,
    url: siteUrl,
    siteName: "SynapseX",
    type: "website",
    images: [{ url: "/img/og-v2.png", width: 1200, height: 630, alt: "SynapseX — Neural Signal Intelligence" }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/img/og-v2.png"],
  },
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`dark ${syne.variable} ${dmMono.variable} h-full antialiased`}>
      {process.env.NEXT_PUBLIC_GA_ID && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`} strategy="afterInteractive" />
          <Script id="gtag-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${process.env.NEXT_PUBLIC_GA_ID}');`}
          </Script>
        </>
      )}
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <script
          dangerouslySetInnerHTML={{
            __html: `console.log("%cSynapseX","font-size:22px;font-weight:900;background:linear-gradient(135deg,#F59E0B,#38BDF8);-webkit-background-clip:text;-webkit-text-fill-color:transparent");console.log("%cNeural Signal Intelligence Network","color:#94A3B8;font-size:12px");console.log("%cx402 payments \\u2022 On-chain signals \\u2022 Autonomous trading","color:#4A5E7A;font-size:11px");`,
          }}
        />
        <div className="noise" />
        <div className="neural-grid fixed inset-0 pointer-events-none" />
        {/* Ambient gradient orbs */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div
            className="float-slow absolute -top-48 -left-48 w-[640px] h-[640px] rounded-full"
            style={{ background: "radial-gradient(circle, rgba(245,158,11,0.055) 0%, transparent 65%)", filter: "blur(90px)" }}
          />
          <div
            className="float-slow-delayed absolute -bottom-48 -right-24 w-[560px] h-[560px] rounded-full"
            style={{ background: "radial-gradient(circle, rgba(56,189,248,0.06) 0%, transparent 65%)", filter: "blur(90px)" }}
          />
        </div>
        <div className="relative z-10 flex flex-col min-h-full">
          <Header />
          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  )
}
