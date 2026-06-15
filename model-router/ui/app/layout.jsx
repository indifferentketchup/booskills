import "./globals.css";

export const metadata = {
  title: "Model Router Control",
  description: "Local playground and provider-priority editor for the Paseo model-router.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
