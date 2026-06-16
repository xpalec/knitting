export function MissingTranslationBadge() {
  return (
    <span
      aria-label="No translation for active locale"
      title="No translation available for the selected language"
      className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-red-500 text-white text-[9px] font-bold shrink-0 ml-1"
    >
      !
    </span>
  );
}
