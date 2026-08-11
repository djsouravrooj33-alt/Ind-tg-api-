const API_KEYS = [
  "amane001",
  "amane002",
  "amane003",
  "amane004",
  "amane005",
  "amane006"
];

const DEVELOPER = "@amane_friends";

const OWNER = "djsouravrooj33-alt";
const REPO = "Ind-tg-api-";
const BRANCH = "main";

const JSON_FILE = "tg_India (2).json";
const TXT_FILE = "INDIAN_TG_NUMBERS.txt";

const headers = {
  "Content-Type": "application/json; charset=UTF-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Cache-Control": "no-store"
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


// ==========================================
// GET FILE FROM PRIVATE GITHUB
// ==========================================

async function getGitHubFile(filename, env, ctx) {

  const apiUrl =
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(filename)}?ref=${BRANCH}`;

  const cacheKey = new Request(
    `https://cache.internal/${filename}?branch=${BRANCH}`
  );

  // -----------------------------
  // CHECK CLOUDFLARE CACHE
  // -----------------------------

  const cached = await caches.default.match(cacheKey);

  if (cached) {
    return await cached.text();
  }

  // -----------------------------
  // GITHUB REQUEST
  // -----------------------------

  if (!env.GITHUB_TOKEN) {
    throw new Error("GITHUB_TOKEN secret is missing");
  }

  const response = await fetch(apiUrl, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
      "Accept": "application/vnd.github.raw+json",
      "User-Agent": "Cloudflare-Game-API"
    }
  });

  if (!response.ok) {
    throw new Error(
      `GitHub file error: ${response.status}`
    );
  }

  const text = await response.text();

  // -----------------------------
  // CACHE FOR 1 HOUR
  // -----------------------------

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


// ==========================================
// MAIN WORKER
// ==========================================

export default {

  async fetch(request, env, ctx) {

    if (request.method === "OPTIONS") {
      return new Response(null, { headers });
    }

    try {

      const url = new URL(request.url);

      const id = url.searchParams.get("id");
      const apikey = url.searchParams.get("apikey");


      // ======================================
      // API KEY CHECK
      // ======================================

      if (!apikey || !API_KEYS.includes(apikey)) {

        return send({
          status: false,
          message: "Invalid API Key",
          developer: DEVELOPER
        }, 401);
      }


      // ======================================
      // ID CHECK
      // ======================================

      if (!id) {

        return send({
          status: false,
          message: "Use: ?apikey=amane001&id=TEST001",
          developer: DEVELOPER
        }, 400);
      }

      const userId = id.trim();


      // ======================================
      // RESULTS
      // ======================================

      let jsonResult = null;
      let txtResult = null;


      // ======================================
      // JSON DATABASE
      // ======================================

      const jsonText =
        await getGitHubFile(
          JSON_FILE,
          env,
          ctx
        );

      let jsonData;

      try {

        jsonData = JSON.parse(jsonText);

      } catch {

        throw new Error(
          "JSON database format is invalid"
        );

      }


      // Search User ID

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


      // ======================================
      // TXT DATABASE
      // ======================================

      const txt =
        await getGitHubFile(
          TXT_FILE,
          env,
          ctx
        );

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
            username: match[3].trim() || null
          };

          break;
        }
      }


      // ======================================
      // NOT FOUND
      // ======================================

      if (!jsonResult && !txtResult) {

        return send({
          status: false,
          query: userId,
          message: "User ID not found",
          developer: DEVELOPER
        }, 404);
      }


      // ======================================
      // SUCCESS
      // ======================================

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