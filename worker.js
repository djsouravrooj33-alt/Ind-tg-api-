const API_KEYS = [
  "amane001",
  "amane002",
  "amane003",
  "amane004",
  "amane005",
  "amane006"
];

// ================================
// GITHUB RAW DATABASE URL
// ================================

const JSON_URL =
  "https://github.com/djsouravrooj33-alt/Ind-tg-api-/blob/main/tg_India%20(2).json";

const TXT_URL =
  "https://github.com/djsouravrooj33-alt/Ind-tg-api-/blob/main/INDIAN_TG_NUMBERS.txt";

const DEVELOPER = "@amane_friends";

const headers = {
  "Content-Type": "application/json; charset=UTF-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*"
};

function send(data, status = 200) {
  return new Response(
    JSON.stringify(data, null, 2),
    {
      status,
      headers
    }
  );
}

export default {

  async fetch(request, env, ctx) {

    if (request.method === "OPTIONS") {
      return new Response(null, { headers });
    }

    try {

      const url = new URL(request.url);

      const id = url.searchParams.get("id");
      const apikey = url.searchParams.get("apikey");

      // ================================
      // API KEY
      // ================================

      if (!apikey || !API_KEYS.includes(apikey)) {

        return send({
          status: false,
          message: "Invalid API Key",
          developer: DEVELOPER
        }, 401);

      }

      // ================================
      // USER ID
      // ================================

      if (!id) {

        return send({
          status: false,
          message: "Use: ?apikey=amane001&id=TEST001",
          developer: DEVELOPER
        }, 400);

      }

      const userId = id.trim();

      let jsonResult = null;
      let txtResult = null;

      // ==================================================
      // JSON DATABASE
      // ==================================================

      const jsonCacheKey = new Request(
        JSON_URL,
        {
          method: "GET"
        }
      );

      let jsonResponse =
        await caches.default.match(jsonCacheKey);

      if (!jsonResponse) {

        const githubResponse =
          await fetch(JSON_URL);

        if (!githubResponse.ok) {

          throw new Error(
            "GitHub JSON file not found: " +
            githubResponse.status
          );

        }

        jsonResponse = new Response(
          githubResponse.body,
          githubResponse
        );

        jsonResponse.headers.set(
          "Cache-Control",
          "public, max-age=3600"
        );

        ctx.waitUntil(
          caches.default.put(
            jsonCacheKey,
            jsonResponse.clone()
          )
        );

      }

      const jsonData =
        await jsonResponse.clone().json();

      if (
        jsonData &&
        typeof jsonData === "object" &&
        jsonData[userId]
      ) {

        const item = jsonData[userId];

        jsonResult = {
          user_id: userId,
          phone: item.number || null,
          country: item.country || null,
          country_code: item.country_code || null
        };

      }

      // ==================================================
      // TXT DATABASE
      // ==================================================

      const txtCacheKey = new Request(
        TXT_URL,
        {
          method: "GET"
        }
      );

      let txtResponse =
        await caches.default.match(txtCacheKey);

      if (!txtResponse) {

        const githubResponse =
          await fetch(TXT_URL);

        if (!githubResponse.ok) {

          throw new Error(
            "GitHub TXT file not found: " +
            githubResponse.status
          );

        }

        txtResponse = new Response(
          githubResponse.body,
          githubResponse
        );

        txtResponse.headers.set(
          "Cache-Control",
          "public, max-age=3600"
        );

        ctx.waitUntil(
          caches.default.put(
            txtCacheKey,
            txtResponse.clone()
          )
        );

      }

      const txt =
        await txtResponse.clone().text();

      const lines =
        txt.split(/\r?\n/);

      for (const line of lines) {

        const match = line.match(
          /User ID:\s*([^|]+)\s*\|\s*Phone:\s*([^|]+)\s*\|\s*Username:\s*(.*)/i
        );

        if (!match) {
          continue;
        }

        const foundId =
          match[1].trim();

        if (foundId === userId) {

          txtResult = {
            user_id: foundId,
            phone: match[2].trim(),
            username: match[3].trim()
          };

          break;
        }

      }

      // ==================================================
      // NOT FOUND
      // ==================================================

      if (!jsonResult && !txtResult) {

        return send({
          status: false,
          query: userId,
          message: "User ID not found",
          developer: DEVELOPER
        }, 404);

      }

      // ==================================================
      // SUCCESS
      // ==================================================

      return send({
        status: true,
        query: userId,
        json: jsonResult,
        txt: txtResult,
        developer: DEVELOPER
      });

    } catch (error) {

      return send({
        status: false,
        error: error.message,
        developer: DEVELOPER
      }, 500);

    }

  }

};
