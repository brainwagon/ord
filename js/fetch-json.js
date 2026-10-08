// The shell's one way to fetch from OpenRouter's API: JSON, checked.

/**
 * Fetch `url` as JSON and check it with `valid`; throws an Error whose
 * message says what went wrong (for "Couldn't load …: <message>.").
 * @param {string} url
 * @param {(body: any) => boolean} valid
 */
export async function fetchJson(url, valid) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OpenRouter answered ${res.status} ${res.statusText}`.trim());
  const body = await res.json();
  if (!valid(body)) throw new Error('OpenRouter sent an unexpected response');
  return body;
}
