import TeacherBottomNav from "@/components/TeacherBottomNav";

export default function TeacherLayout({ children }) {
  return (
    <>
      {children}
      <TeacherBottomNav />
    </>
  );
}