// Safe serialiser for JSON-LD injected via dangerouslySetInnerHTML.
//
// JSON.stringify alone does NOT escape `<`, so a DB-sourced string containing
// `</script>` (e.g. a topic title) would break out of the
// <script type="application/ld+json"> block — a classic stored-XSS vector.
// Escaping `<`, `>` and `&` to their \uXXXX forms keeps the output valid JSON
// while making script-tag breakout impossible. This mirrors the mitigation
// Next.js uses for its own __NEXT_DATA__ payload.
export function jsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
}
