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


// ==========================================
// GITHUB API
// ==========================================

async function githubFetch(path, env) {

  if (!env.GITHUB_TOKEN) {
    throw new Error("GITHUB_TOKEN secret is missing");
  }

  const response = await fetch(
    `https://api.github.com${path}`,
    {
      headers: {
        "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "Cloudflare-Game-API"
      }
    }
  );

  return response;
}


// ==========================================
// GET DATABASE FILE
// ==========================================

async function getFile(filename, env, ctx) {

  const path =
    `/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(filename)}?ref=${BRANCH}`;

  const cacheKey = new Request(
    `https://database-cache.example/${filename}`
  );

  // Cache
  const cached =
    await caches.default.match(cacheKey);

  if (cached) {
    return await cached.text();
  }

  const response =
    await githubFetch(path, env);

  if (!response.ok) {

    const errorText =
      await response.text();

    throw new Error(
      `GitHub file error: ${response.status} - ${errorText}`
    );
  }

  const data =
    await response.json();

  // GitHub returns base64 for contents API
  if (!data.content) {
    throw new Error(
      `GitHub returned no content for ${filename}`
    );
  }

  const binary =
    atob(
      data.content.replace(/\n/g, "")
    );

  const bytes =
    Uint8Array.from(
      binary,
      c => c.charCodeAt(0)
    );

  const text =
    new TextDecoder().decode(bytes);

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


// ==========================================
// FIND DATABASE FILES AUTOMATICALLY
// ==========================================

async function findFiles(env) {

  const path =
    `/repos/${OWNER}/${REPO}/contents/?ref=${BRANCH}`;

  const response =
    await githubFetch(path, env);

  if (!response.ok) {

    const text =
      await response.text();

    throw new Error(
      `GitHub repository error: ${response.status} - ${text}`
    );
  }

  const files =
    await response.json();

  if (!Array.isArray(files)) {
    throw new Error(
      "GitHub repository listing is not an array"
    );
  }

  let jsonFile = null;
  let txtFile = null;

  for (const file of files) {

    if (file.type !== "file") {
      continue;
    }

    const name =
      file.name.toLowerCase();

    if (
      !jsonFile &&
      name.endsWith(".json")
    ) {
      jsonFile = file.name;
    }

    if (
      !txtFile &&
      name.endsWith(".txt")
    ) {
      txtFile = file.name;
    }
  }

  return {
    jsonFile,
    txtFile
  };
}


// ==========================================
// WORKER
// ==========================================

export default {

  async fetch(request, env, ctx) {

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers
      });
    }

    try {

      const url =
        new URL(request.url);

      const id =
        url.searchParams.get("id");

      const apikey =
        url.searchParams.get("apikey");


      // ====================================
      // API KEY
      // ====================================

      if (
        !apikey ||
        !API_KEYS.includes(apikey)
      ) {

        return send({
          status: false,
          message: "Invalid API Key",
          developer: DEVELOPER
        }, 401);
      }


      // ====================================
      // ID
      // ====================================

      if (!id) {

        return send({
          status: false,
          message:
            "Use: ?apikey=amane001&id=TEST001",
          developer: DEVELOPER
        }, 400);
      }

      const userId =
        id.trim();


      // ====================================
      // FIND FILES
      // ====================================

      const files =
        await findFiles(env);


      if (!files.jsonFile && !files.txtFile) {

        return send({
          status: false,
          message:
            "No JSON/TXT database found in GitHub repository",
          developer: DEVELOPER
        }, 404);
      }


      let jsonResult = null;
      let txtResult = null;


      // ====================================
      // JSON
      // ====================================

      if (files.jsonFile) {

        const jsonText =
          await getFile(
            files.jsonFile,
            env,
            ctx
          );

        let jsonData;

        try {

          jsonData =
            JSON.parse(jsonText);

        } catch {

          throw new Error(
            `Invalid JSON database: ${files.jsonFile}`
          );
        }


        if (
          jsonData &&
          typeof jsonData === "object" &&
          jsonData[userId]
        ) {

          const item =
            jsonData[userId];

          jsonResult = {
            user_id: userId,
            phone: item.number || null,
            country: item.country || null,
            country_code:
              item.country_code || null
          };
        }
      }


      // ====================================
      // TXT
      // ====================================

      if (files.txtFile) {

        const txt =
          await getFile(
            files.txtFile,
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


          if (foundId === userId) {

            txtResult = {
              user_id: foundId,
              phone: match[2].trim(),
              username:
                match[3].trim() || null
            };

            break;
          }
        }
      }


      // ====================================
      // NOT FOUND
      // ====================================

      if (!jsonResult && !txtResult) {

        return send({
          status: false,
          query: userId,
          message: "User ID not found",
          database: {
            json_file: files.jsonFile,
            txt_file: files.txtFile
          },
          developer: DEVELOPER
        }, 404);
      }


      // ====================================
      // SUCCESS
      // ====================================

      return send({

        status: true,

        query: userId,

        json: jsonResult,

        txt: txtResult,

        database: {
          json_file: files.jsonFile,
          txt_file: files.txtFile
        },

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