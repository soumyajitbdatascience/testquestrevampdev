import type { Metadata } from "next";
import { Sora, Manrope } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { BrandingProvider } from "@/components/student/branding-provider";

// B2C design handoff: display = Sora (600–800), body = Manrope (400–800)
const sora = Sora({
  variable: "--font-display",
  weight: ["400", "600", "700", "800"],
  subsets: ["latin"],
});

const manrope = Manrope({
  variable: "--font-sans",
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Testquest — Premium Test Series for Class 6–12",
  description: "Master CBSE, ICSE and State Board exams. Thousands of chapter-wise tests with detailed solutions. Built for Indian school students.",
};

// Pre-hydration script — applies light by default with dark/system override
const themeInitScript = `
(function(){
  try {
    var theme = localStorage.getItem('testquest-theme') || 'light';
    var resolved = theme;
    if (theme === 'system') {
      resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.classList.add(resolved);
  } catch (e) {
    document.documentElement.classList.add('light');
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${sora.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <BrandingProvider>{children}</BrandingProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
