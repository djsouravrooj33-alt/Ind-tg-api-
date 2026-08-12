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
// GITHUB PUBLIC JSON DATABASES
// ======================================================

const JSON_FILES = [
  "https://raw.githubusercontent.com/djsouravrooj33-alt/Ind-tg-api-/main/tg_India%20(2).json",

  "https://raw.githubusercontent.com/djsouravrooj33-alt/Ind-tg-api-/main/tg_ind_normaly.json"
];


// ======================================================
// GITHUB PUBLIC TXT DATABASE
// ======================================================

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
// LOAD GITHUB FILE + CLOUDFLARE CACHE
// ======================================================

async function loadFile(url, ctx) {

  const cacheKey =
    new Request(url);


  // --------------------------------------------------
  // CHECK CLOUDFLARE CACHE
  // --------------------------------------------------

  const cached =
    await caches.default.match(cacheKey);


  if (cached) {

    return await cached.text();

  }


  // --------------------------------------------------
  // FETCH GITHUB
  // --------------------------------------------------

  const response =
    await fetch(url);


  if (!response.ok) {

    throw new Error(
      `GitHub file error: ${response.status}`
    );

  }


  const text =
    await response.text();


  // --------------------------------------------------
  // SAVE IN CLOUDFLARE CACHE
  // 1 HOUR
  // --------------------------------------------------

  const cacheResponse =
    new Response(
      text,
      {
        headers: {
          "Content-Type":
            "text/plain; charset=UTF-8",

          "Cache-Control":
            "public, max-age=3600"
        }
      }
    );


  ctx.waitUntil(
    caches.default.put(
      cacheKey,
      cacheResponse.clone()
    )
  );


  return text;

}


// ======================================================
// SEARCH JSON DATABASES
// ======================================================

async function searchJSON(id, ctx) {

  const wanted =
    id.toLowerCase();


  for (
    const jsonUrl of JSON_FILES
  ) {

    const jsonText =
      await loadFile(
        jsonUrl,
        ctx
      );


    let jsonData;


    try {

      jsonData =
        JSON.parse(jsonText);

    } catch {

      throw new Error(
        "Invalid JSON database: " +
        jsonUrl
      );

    }


    if (
      !jsonData ||
      typeof jsonData !== "object"
    ) {

      continue;

    }


    // ------------------------------------------------
    // DIRECT MATCH
    // ------------------------------------------------

    if (
      Object.prototype.hasOwnProperty.call(
        jsonData,
        id
      )
    ) {

      const item =
        jsonData[id];


      return {

        user_id: id,

        mobile_number:
          item?.number ?? null,

        country:
          item?.country ?? null,

        country_code:
          item?.country_code ?? null,

        source:
          jsonUrl

      };

    }


    // ------------------------------------------------
    // CASE-INSENSITIVE MATCH
    // ------------------------------------------------

    for (
      const key of Object.keys(jsonData)
    ) {

      if (
        key.toLowerCase() === wanted
      ) {

        const item =
          jsonData[key];


        return {

          user_id: key,

          mobile_number:
            item?.number ?? null,

          country:
            item?.country ?? null,

          country_code:
            item?.country_code ?? null,

          source:
            jsonUrl

        };

      }

    }

  }


  return null;

}


// ======================================================
// SEARCH TXT DATABASE
// ======================================================

async function searchTXT(id, ctx) {

  const txt =
    await loadFile(
      TXT_URL,
      ctx
    );


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

      return {

        user_id:
          foundId,

        mobile_number:
          match[2].trim(),

        username:
          match[3].trim() || null,

        source:
          TXT_URL

      };

    }

  }


  return null;

}


// ======================================================
// MAIN WORKER
// ======================================================

export default {

  async fetch(
    request,
    env,
    ctx
  ) {

    // ==================================================
    // CORS
    // ==================================================

    if (
      request.method === "OPTIONS"
    ) {

      return new Response(
        null,
        {
          headers: HEADERS
        }
      );

    }


    // ==================================================
    // ONLY GET
    // ==================================================

    if (
      request.method !== "GET"
    ) {

      return send(
        {
          status: false,
          message:
            "Only GET method allowed",
          developer:
            DEVELOPER
        },
        405
      );

    }


    try {

      const url =
        new URL(request.url);


      const apiKey =
        url.searchParams.get(
          "apikey"
        );


      const userId =
        url.searchParams.get(
          "id"
        );


      // ==================================================
      // API KEY CHECK
      // ==================================================

      if (
        !apiKey ||
        !API_KEYS.includes(apiKey)
      ) {

        return send(
          {
            status: false,
            message:
              "Invalid API Key, need api key to dm @amane_loyal_me",
            developer:
              DEVELOPER
          },
          401
        );

      }


      // ==================================================
      // ID CHECK
      // ==================================================

      if (
        !userId
      ) {

        return send(
          {
            status: false,
            message:
              "Use: ?apikey=amane001&id=USER_ID",
            developer:
              DEVELOPER
          },
          400
        );

      }


      const id =
        userId.trim();


      // ==================================================
      // SEARCH JSON
      // ==================================================

      const jsonResult =
        await searchJSON(
          id,
          ctx
        );


      // ==================================================
      // SEARCH TXT
      // ==================================================

      const txtResult =
        await searchTXT(
          id,
          ctx
        );


      // ==================================================
      // NOT FOUND
      // ==================================================

      if (
        !jsonResult &&
        !txtResult
      ) {

        return send(
          {
            status: false,

            query:
              id,

            message:
              "User ID not found",

            developer:
              DEVELOPER
          },
          404
        );

      }


      // ==================================================
      // SUCCESS
      // ==================================================

      return send(
        {
          status: true,

          query:
            id,

          json:
            jsonResult,

          txt:
            txtResult,

          developer:
            DEVELOPER
        },
        200
      );


    } catch (error) {

      // ==================================================
      // ERROR
      // ==================================================

      return send(
        {
          status: false,

          error:
            error.message,

          developer:
            DEVELOPER
        },
        500
      );

    }

  }

};