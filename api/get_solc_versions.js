export const config = {
  runtime: "edge",
};

export default async function handler() {
  try {
    const url =
      "https://raw.githubusercontent.com/ethereum/solc-bin/gh-pages/bin/list.json";
    const fetchResponse = await fetch(url);

    if (!fetchResponse.ok)
      return new Response(
        JSON.stringify({
          message: `Failed to fetch compilers list: ${fetchResponse.status} ${fetchResponse.statusText}`,
        }),
        {
          status: fetchResponse.status,
          headers: { "Content-Type": "application/json" },
        }
      );

    const data = await fetchResponse.json();

    return new Response(JSON.stringify({ solc_versions: data.releases }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "s-maxage=86400, stale-while-revalidate",
      },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ message: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
