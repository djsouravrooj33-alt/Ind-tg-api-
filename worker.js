// ============================================================
// IND TG GAME API
// Private GitHub JSON + TXT
// Cloudflare Cache
// API Key Authentication
// Developer: @amane_friends
// ============================================================

const API_KEYS = [
  "amane001",
  "amane002",
  "amane003",
  "amane004",
  "amane005",
  "amane006"
];

const JSON_URL =
  "https://api.github.com/repos/djsouravrooj33-alt/Ind-tg-api-/contents/tg_India%20(2).json";

const TXT_URL =
  "https://api.github.com/repos/djsouravrooj33-alt/Ind-tg-api-/contents/INDIAN_TG_NUMBERS.txt";

const DEVELOPER = "@amane_friends";

const headers = {
  "Content-Type": "application/json; charset=UTF-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Cache-Control": "no-store"
};


// ============================================================
// JSON RESPONSE
// ============================================================

function send(data, status = 200) {
  return new Response(
    JSON.stringify(data, null, 2),
    {
      status,
      headers
    }
  );
}


// ============================================================
// LOAD PRIVATE GITHUB FILE WITH CLOUDFLARE CACHE
// ============================================================

async function getGitHubFile(url, env, ctx) {

  const cacheKey = new Request(url, {
    method: "GET"
  });

  // -------------------------------
  // CHECK CLOUDFLARE CACHE
  // -------------------------------

  let cached = await caches.default.match(cacheKey);

  if (cached) {
    return await cached.text();
  }


  // -------------------------------
  // GITHUB TOKEN CHECK
  // -------------------------------

  if (!env.GITHUB_TOKEN) {
    throw new Error(
      "GITHUB_TOKEN secret is not configured"
    );
  }


  // -------------------------------
  // FETCH PRIVATE GITHUB FILE
  // -------------------------------

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
      "Accept": "application/vnd.github.raw+json",
      "User-Agent": "Cloudflare-Worker-Game-API"
    }
  });


  if (!response.ok) {

    throw new Error(
      `GitHub file error: ${response.status}`
    );

  }


  const text = await response.text();


  // -------------------------------
  // SAVE TO CLOUDFLARE CACHE
  // -------------------------------

  const cacheResponse = new Response(text, {
    headers: {
      "Content-Type": "text/plain; charset=UTF-8",
      "Cache-Control": "public, max-age=3600"
    }
  });

  ctx.waitUntil(
    caches.default.put(
      cacheKey,
      cacheResponse.clone()
    )
  );


  return text;
}


// ============================================================
// MAIN WORKER
// ============================================================

export default {

  async fetch(request, env, ctx) {

    // -------------------------------
    // CORS
    // -------------------------------

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers
      });
    }


    if (request.method !== "GET") {

      return send({
        status: false,
        message: "Only GET method allowed",
        developer: DEVELOPER
      }, 405);

    }


    try {

      const url = new URL(request.url);

      const userId =
        url.searchParams.get("id");

      const apiKey =
        url.searchParams.get("apikey");


      // ======================================================
      // API KEY AUTHENTICATION
      // ======================================================

      if (
        !apiKey ||
        !API_KEYS.includes(apiKey)
      ) {

        return send({
          status: false,
          message: "Invalid API Key",
          developer: DEVELOPER
        }, 401);

      }


      // ======================================================
      // USER ID CHECK
      // ======================================================

      if (!userId) {

        return send({
          status: false,
          message:
            "Use: ?apikey=amane001&id=USER_ID",
          developer: DEVELOPER
        }, 400);

      }


      const id =
        userId.trim();


      let jsonResult = null;
      let txtResult = null;


      // ======================================================
      // JSON DATABASE
      // ======================================================

      const jsonText =
        await getGitHubFile(
          JSON_URL,
          env,
          ctx
        );


      let jsonData;

      try {

        jsonData =
          JSON.parse(jsonText);

      } catch {

        throw new Error(
          "Invalid JSON database"
        );

      }


      // Find User ID in JSON

      if (
        jsonData &&
        typeof jsonData === "object" &&
        jsonData[id]
      ) {

        const item =
          jsonData[id];


        jsonResult = {

          user_id: id,

          room_id:
            item.number || null,

          country:
            item.country || null,

          country_code:
            item.country_code || null

        };

      }


      // ======================================================
      // TXT DATABASE
      // ======================================================

      const txt =
        await getGitHubFile(
          TXT_URL,
          env,
          ctx
        );


      const lines =
        txt.split(/\r?\n/);


      for (const line of lines) {

        const match =
          line.match(
            /User ID:\s*([^|]+)\s*\|\s*Phone:\s*([^|]+)\s*\|\s*Username:\s*(.*)/i
          );


        if (!match) {
          continue;
        }


        const foundId =
          match[1].trim();


        if (foundId === id) {

          txtResult = {

            user_id:
              foundId,

            room_id:
              match[2].trim(),

            username:
              match[3].trim()

          };


          break;

        }

      }


      // ======================================================
      // USER NOT FOUND
      // ======================================================

      if (
        !jsonResult &&
        !txtResult
      ) {

        return send({

          status: false,

          query: id,

          message:
            "User ID not found",

          developer:
            DEVELOPER

        }, 404);

      }


      // ======================================================
      // SUCCESS
      // ======================================================

      return send({

        status: true,

        query: id,

        json: jsonResult,

        txt: txtResult,

        developer:
          DEVELOPER

      });


    } catch (error) {

      return send({

        status: false,

        error:
          error.message,

        developer:
          DEVELOPER

      }, 500);

    }

  }

};