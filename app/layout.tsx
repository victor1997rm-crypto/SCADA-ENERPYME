import "./globals.css";

export const metadata = {
  title: "SCADA Monitor — Ammper Energía",
  description: "Monitoreo remoto en vivo del simulador SCADA",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
