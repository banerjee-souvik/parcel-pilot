// The model writes plain markdown-lite (**bold** for shipment IDs, dates, etc.) — not full markdown,
// just the one construct it actually uses. Splitting on a capturing group keeps the "**" delimiters
// out of the output while preserving them as split boundaries.
export function FormattedText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <span className="whitespace-pre-wrap">
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i} className="font-semibold">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}
