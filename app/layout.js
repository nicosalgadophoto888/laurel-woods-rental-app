import "./globals.css";

export const metadata = {
  title: "Laurel Woods Rental App",
  description: "Admin dashboard for Laurel Woods property management",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
