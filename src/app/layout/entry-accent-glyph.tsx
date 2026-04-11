type EntryAccentGlyphProps = {
  inverse?: boolean;
};

export function EntryAccentGlyph({ inverse = false }: EntryAccentGlyphProps) {
  return (
    <span
      aria-hidden="true"
      className={`entry-accent-glyph${inverse ? ' entry-accent-glyph-inverse' : ''}`}
    >
      <span role="img" aria-hidden="true">
        ✨
      </span>
    </span>
  );
}
