export default function BlockingBar({ text }: { text: string }) {
  return (
    <div className="fixed top-0 inset-x-0 z-20 bg-amber-100 text-amber-900 text-sm px-3 py-2 text-center border-b">
      {text}
    </div>
  );
}