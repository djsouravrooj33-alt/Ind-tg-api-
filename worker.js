const API_KEYS = [
  "amane001",
  "amane002",
  "amane003",
  "amane004",
  "amane005",
  "amane006"
];

const DEVELOPER = "@amane_friends";

// ======================================================
// GITHUB PUBLIC DATABASE
// ======================================================

const JSON_URL =
  "https://raw.githubusercontent.com/djsouravrooj33-alt/Ind-tg-api-/main/tg_India%20(2).json";

const TXT_URL =
  "https://raw.githubusercontent.com/djsouravrooj33-alt/Ind-tg-api-/main/INDIAN_TG_NUMBERS.txt";


// ======================================================
// RESPONSE HEADERS
// ======================================================

const HEADERS = {
  "Content-Type": "application/json; charset=UTF-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*"
};


// ======================================================
// JSON RESPONSE
// ======================================================

function send(data, status = 200) {
  return new Response(
    JSON.stringify(data, null, 2),
    {
      status,
      headers: HEADERS
    }
  );
}


// ======================================================
// LOAD FILE WITH CLOUDFLARE CACHE
// ======================================================

async function loadFile(url, ctx) {

  const cacheKey = new Request(url);

  // -----------------------------
  // CHECK CACHE
  // -----------------------------

  const cached =
    await caches.default.match(cacheKey);

  if (cached) {
    return await cached.text();
  }


  // -----------------------------
  // FETCH GITHUB
  // -----------------------------

  const response =
    await fetch(url);

  if (!response.ok) {

    throw new Error(
      `GitHub file error: ${response.status}`
    );
  }


  const text =
    await response.text();


  // -----------------------------
  // SAVE CACHE
  // 1 HOUR
  // -----------------------------

  const cacheResponse =
    new Response(text, {
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


// ======================================================
// MAIN WORKER
// ======================================================

export default {

  async fetch(request, env, ctx) {

    // -----------------------------
    // OPTIONS / CORS
    // -----------------------------

    if (request.method === "OPTIONS") {

      return new Response(
        null,
        {
          headers: HEADERS
        }
      );
    }


    // -----------------------------
    // ONLY GET
    // -----------------------------

    if (request.method !== "GET") {

      return send({
        status: false,
        message: "Only GET method allowed",
        developer: DEVELOPER
      }, 405);
    }


    try {

      const url =
        new URL(request.url);


      const apiKey =
        url.searchParams.get("apikey");


      const userId =
        url.searchParams.get("id");


      // ==================================================
      // API KEY CHECK
      // ==================================================

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


      // ==================================================
      // USER ID CHECK
      // ==================================================

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


      // ==================================================
      // LOAD JSON DATABASE
      // ==================================================

      const jsonText =
        await loadFile(
          JSON_URL,
          ctx
        );


      let jsonData;

      try {

        jsonData =
          JSON.parse(jsonText);

      } catch {

        throw new Error(
          "Invalid JSON database format"
        );
      }


      // ==================================================
      // SEARCH JSON
      // ==================================================

      if (
        jsonData &&
        typeof jsonData === "object"
      ) {

        // Direct match first

        if (jsonData[id]) {

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

        } else {

          // Case-insensitive fallback

          const wanted =
            id.toLowerCase();

          for (
            const key of Object.keys(jsonData)
          ) {

            if (
              key.toLowerCase() === wanted
            ) {

              const item =
                jsonData[key];

              jsonResult = {

                user_id: key,

                mobile_numner:
                  item.number || null,

                country:
                  item.country || null,

                country_code:
                  item.country_code || null

              };

              break;
            }
          }
        }
      }


      // ==================================================
      // LOAD TXT DATABASE
      // ==================================================

      const txt =
        await loadFile(
          TXT_URL,
          ctx
        );


      // ==================================================
      // PARSE TXT
      // ==================================================

      const lines =
        txt.split(/\r?\n/);


      for (
        const line of lines
      ) {

        const match =
          line.match(
            /User ID:\s*([^|]+)\s*\|\s*Phone:\s*([^|]+)\s*\|\s*Username:\s*(.*)/i
          );


        if (!match) {
          continue;
        }


        const foundId =
          match[1].trim();


        if (
          foundId === id
        ) {

          txtResult = {

            user_id:
              foundId,

            room_id:
              match[2].trim(),

            username:
              match[3].trim() || null

          };


          break;
        }
      }


      // ==================================================
      // NOT FOUND
      // ==================================================

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


      // ==================================================
      // SUCCESS
      // ==================================================

      return send({

        status: true,

        query: id,

        json: jsonResult,

        txt: txtResult,

        developer:
          DEVELOPER

      });


    } catch (error) {

      // ==================================================
      // ERROR
      // ==================================================

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