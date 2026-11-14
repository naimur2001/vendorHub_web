// Remounts on every navigation between shop pages, so the content fades and slides in
// (CSS only: .page-enter in globals.css; off with "reduce motion").
export default function ShopTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
