const PUBLISHED_BASE_URL =
  "https://mikel-kel.github.io/HomeTools-PublishedData";

/* =========================================================
   Read Published JSON
========================================================= */
export async function readPublishedJSON<T>(
  path: string
): Promise<T | null> {

  const res = await fetch(
    `${PUBLISHED_BASE_URL}/${path}`,
    {
      cache: "no-store"
    }
  );

  if (!res.ok) {
    return null;
  }

  return await res.json();
}