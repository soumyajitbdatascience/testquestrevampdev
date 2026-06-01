import type { Metadata } from "next";
import { DM_Serif_Display, DM_Sans } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { BrandingProvider } from "@/components/student/branding-provider";

const dmSerifDisplay = DM_Serif_Display({
  variable: "--font-display",
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
});

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Testquest — Premium Test Series for Class 6–12",
  description: "Master CBSE, ICSE and State Board exams. Thousands of chapter-wise tests with detailed solutions. Built for Indian school students.",
};

// Pre-hydration script — applies dark by default with light/system override
const themeInitScript = `
(function(){
  try {
    var theme = localStorage.getItem('testquest-theme') || 'dark';
    var resolved = theme;
    if (theme === 'system') {
      resolved = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    document.documentElement.classList.add(resolved);
  } catch (e) {
    document.documentElement.classList.add('dark');
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
      className={`${dmSans.variable} ${dmSerifDisplay.variable} h-full antialiased`}
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
