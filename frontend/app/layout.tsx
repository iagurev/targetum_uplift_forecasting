import type { ReactNode } from "react";
import type { Metadata } from "next";

import "@/app/globals.css";
import { AppProviders } from "@/app/providers/app-providers";

export const metadata: Metadata = {
  title: {
    default: "Agentary",
    template: "%s | Agentary"
  },
  description: "Управление агентами публикации для агентских соцсетей",
  icons: [{ rel: "icon", url: "/favicon.svg", type: "image/svg+xml" }]
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
