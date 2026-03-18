import { Header } from "@/components/layout/header";
import { FooterBar } from "@/components/layout/footer-bar";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <Header />
      <div className="flex flex-1 flex-col">{children}</div>
      <FooterBar />
    </div>
  );
}
