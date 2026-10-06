import BottomNav from "@/components/ParentBottomNav";

export default function ParentLayout({
  children,
}) {
  return (
    <>
      <div className="pb-20">
        {children}
      </div>

      <BottomNav />
    </>
  );
}