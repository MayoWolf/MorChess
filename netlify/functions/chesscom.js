const API_ROOT = "https://api.chess.com/pub";

exports.handler = async (event) => {
  const path = event.queryStringParameters?.path;
  if (!path || !path.startsWith("/player/")) {
    return json(400, { error: "Missing or invalid Chess.com API path." });
  }

  try {
    const response = await fetch(`${API_ROOT}${path}`, {
      headers: {
        Accept: event.headers.accept || "application/json",
        "User-Agent": "MorChess dashboard",
      },
    });
    const body = await response.text();
    return {
      statusCode: response.status,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": response.headers.get("content-type") || "text/plain; charset=utf-8",
        "Cache-Control": path.endsWith("/pgn") ? "public, max-age=3600" : "public, max-age=300",
      },
      body,
    };
  } catch (error) {
    return json(502, { error: error instanceof Error ? error.message : "Chess.com request failed." });
  }
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  };
}
