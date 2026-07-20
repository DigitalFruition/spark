import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs/promises";
import http from "node:http";
import { Socket } from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { DEFAULTS, build, buildRenderer, createPreviewApp, startPreviewServer } from "../site.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const execFileAsync = promisify(execFile);
const sitePath = path.resolve(testDir, "../site.js");
const binPath = path.resolve(testDir, "../bin/df-spark.js");
const basicExamplePath = path.resolve(testDir, "../examples/basic-site");

async function createFixtureWebsite() {
  const srcDir = await fs.mkdtemp(path.join(os.tmpdir(), "df-spark-test-"));

  await fs.mkdir(path.join(srcDir, "content"), { recursive: true });
  await fs.mkdir(path.join(srcDir, "includes"), { recursive: true });

  await fs.writeFile(
    path.join(srcDir, "template.html"),
    [
      "<!doctype html>",
      "<html>",
      "<head><title>{{title}}</title></head>",
      "<body>",
      "<!-- include: includes/header.html -->",
      "<main>{{body}}</main>",
      "</body>",
      "</html>",
    ].join("\n"),
    "utf8",
  );

  await fs.writeFile(
    path.join(srcDir, "includes/header.html"),
    "<header>Fixture Header</header>\n",
    "utf8",
  );

  await fs.writeFile(
    path.join(srcDir, "content/index.md"),
    [
      "---",
      "title: Fixture Home",
      "---",
      "",
      "# Ignored Heading",
      "",
      "Hello **fixture** page.",
    ].join("\n"),
    "utf8",
  );

  return srcDir;
}

async function createBasicExampleCopy() {
  const srcDir = await fs.mkdtemp(path.join(os.tmpdir(), "df-spark-basic-example-"));
  await fs.cp(basicExamplePath, srcDir, { recursive: true });
  return srcDir;
}

function fixtureConfig(srcDir, overrides = {}) {
  return {
    ...DEFAULTS,
    srcDir,
    outDir: "site-output",
    ...overrides,
  };
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function requestApp(app, route) {
  const socket = new Socket();
  const req = new http.IncomingMessage(socket);
  req.method = "GET";
  req.url = route;
  req.headers = {};

  const res = new http.ServerResponse(req);
  res.assignSocket(socket);

  const chunks = [];
  res.write = (chunk, encoding, callback) => {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
    if (typeof callback === "function") callback();
    return true;
  };

  return new Promise((resolve) => {
    res.end = (chunk, encoding, callback) => {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
      }
      if (typeof callback === "function") callback();
      resolve({
        status: res.statusCode,
        headers: res.getHeaders(),
        body: Buffer.concat(chunks).toString("utf8"),
      });
    };
    app.handle(req, res);
  });
}

async function requestServer(server, route) {
  const address = server.address();
  assert.equal(typeof address, "object");
  assert.ok(address);

  const url = new URL(route, `http://127.0.0.1:${address.port}`);

  return new Promise((resolve, reject) => {
    const req = http.request(url, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      res.on("end", () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks).toString("utf8"),
        });
      });
    });

    req.on("error", reject);
    req.end();
  });
}

async function closeServer(server) {
  await new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

async function runCli(args, options = {}) {
  try {
    const { stdout, stderr } = await execFileAsync(options.command ?? process.execPath, [
      ...(options.command ? [] : [sitePath]),
      ...args,
    ], {
      cwd: options.cwd,
      env: options.env,
    });
    return { code: 0, stdout, stderr };
  } catch (e) {
    return {
      code: e.code,
      stdout: e.stdout ?? "",
      stderr: e.stderr ?? "",
    };
  }
}

async function createPackageBinShim() {
  const binDir = await fs.mkdtemp(path.join(os.tmpdir(), "df-spark-bin-"));
  await fs.symlink(binPath, path.join(binDir, "df-spark"));
  return binDir;
}

function withPath(binDir) {
  return {
    ...process.env,
    PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ""}`,
  };
}

async function startCommand(args, options = {}) {
  const child = spawn(options.command ?? process.execPath, args, {
    cwd: options.cwd,
    env: options.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";

  const ready = new Promise((resolve, reject) => {
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
      const match = stdout.match(/Preview: http:\/\/127\.0\.0\.1:(\d+)/);
      if (match) {
        resolve(Number(match[1]));
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      reject(new Error(`Command exited before it was ready: ${code}\n${stderr}`));
    });
  });

  return {
    child,
    ready,
    output: () => ({ stdout, stderr }),
  };
}

async function stopCommand(child) {
  if (!child) return;
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  await once(child, "exit");
}

test("cli help prints usage", async () => {
  const result = await runCli(["--help"]);

  assert.equal(result.code, 0);
  assert.match(result.stdout, /Usage:/);
  assert.match(result.stdout, /node site\.js build/);
  assert.match(result.stdout, /node site\.js serve/);
  assert.match(result.stdout, /npm run build/);
  assert.match(result.stdout, /--host <host>/);
  assert.equal(result.stderr, "");
});

test("cli unknown commands print usage and exit non-zero", async () => {
  const result = await runCli(["wat"]);

  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /Unknown command: wat/);
  assert.match(result.stderr, /Usage:/);
  assert.match(result.stderr, /node site\.js --help/);
});

test("cli build reports invalid configured directories clearly", async () => {
  const srcDir = await createFixtureWebsite();
  const result = await runCli(["build", "--content", "missing"], { cwd: srcDir });

  assert.notEqual(result.code, 0);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /content directory not found: missing/);
  assert.doesNotMatch(result.stderr, /ENOENT|Error:/);
});

test("cli reports missing option values clearly", async () => {
  const missingPort = await runCli(["serve", "--port"]);

  assert.notEqual(missingPort.code, 0);
  assert.equal(missingPort.stdout, "");
  assert.match(missingPort.stderr, /--port requires a value/);

  const missingContent = await runCli(["build", "--content"]);

  assert.notEqual(missingContent.code, 0);
  assert.equal(missingContent.stdout, "");
  assert.match(missingContent.stderr, /--content requires a value/);
});

test("package binary help prints binary usage", async () => {
  const binDir = await createPackageBinShim();
  const result = await runCli(["--help"], {
    command: "df-spark",
    env: withPath(binDir),
  });

  assert.equal(result.code, 0);
  assert.match(result.stdout, /Usage:/);
  assert.match(result.stdout, /df-spark build/);
  assert.match(result.stdout, /df-spark serve/);
  assert.doesNotMatch(result.stdout, /node site\.js/);
  assert.equal(result.stderr, "");
});

test("package binary builds an external website fixture", async () => {
  const srcDir = await createFixtureWebsite();
  const binDir = await createPackageBinShim();

  const result = await runCli(["build", "--out", "site-output"], {
    command: "df-spark",
    cwd: srcDir,
    env: withPath(binDir),
  });

  assert.equal(result.code, 0);
  assert.match(result.stdout, /Built -> site-output\//);
  assert.match(
    await fs.readFile(path.join(srcDir, "site-output/index.html"), "utf8"),
    /Hello <strong>fixture<\/strong> page\./,
  );
  assert.equal(await pathExists(path.join(srcDir, "site.js")), false);
});

test("package binary serves an external website fixture", async () => {
  const srcDir = await createFixtureWebsite();
  const binDir = await createPackageBinShim();
  const command = await startCommand(["serve", "--port", "0"], {
    command: "df-spark",
    cwd: srcDir,
    env: withPath(binDir),
  });

  try {
    const port = await command.ready;
    const response = await new Promise((resolve, reject) => {
      const req = http.request(`http://127.0.0.1:${port}/`, (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        res.on("end", () => {
          resolve({
            status: res.statusCode,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      });
      req.on("error", reject);
      req.end();
    });

    assert.equal(response.status, 200);
    assert.match(response.body, /Hello <strong>fixture<\/strong> page\./);
    assert.match(command.output().stdout, /Pages from \/content, components from \/components/);
  } finally {
    await stopCommand(command.child);
  }
});

test("basic example builds from its npm script with the package binary", async () => {
  const srcDir = await createBasicExampleCopy();
  const binDir = await createPackageBinShim();
  const result = await runCli(["run", "build", "--", "--out", "site-output"], {
    command: "npm",
    cwd: srcDir,
    env: withPath(binDir),
  });

  assert.equal(result.code, 0);
  assert.match(result.stdout, /Built -> site-output\//);

  const outDir = path.join(srcDir, "site-output");
  const home = await fs.readFile(path.join(outDir, "index.html"), "utf8");
  const nested = await fs.readFile(path.join(outDir, "docs/getting-started.html"), "utf8");
  const component = await fs.readFile(path.join(outDir, "components/sidebar.html"), "utf8");
  const css = await fs.readFile(path.join(outDir, "assets/css/site.css"), "utf8");

  assert.match(home, /<title>Basic SPARK Site<\/title>/);
  assert.match(home, /id="header_div"/);
  assert.match(home, /id="topnav_div"/);
  assert.match(home, /id="leftnav_div"/);
  assert.match(home, /id="rightnav_div"/);
  assert.match(home, /id="content_div"/);
  assert.match(home, /id="footer_div"/);
  assert.match(home, /<h2>Build or Preview<\/h2>/);
  assert.match(nested, /<title>Start from the Basic Example<\/title>/);
  assert.match(component, /This sidebar is a reusable Markdown component/);
  assert.match(css, /#body_div/);
});

test("basic example previews pages, components, and assets through the package binary", async () => {
  const srcDir = await createBasicExampleCopy();
  const binDir = await createPackageBinShim();
  const command = await startCommand(["serve", "--port", "0"], {
    command: "df-spark",
    cwd: srcDir,
    env: withPath(binDir),
  });

  try {
    const port = await command.ready;

    const request = (route) => new Promise((resolve, reject) => {
      const req = http.request(`http://127.0.0.1:${port}${route}`, (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        res.on("end", () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      });
      req.on("error", reject);
      req.end();
    });

    const home = await request("/");
    const nested = await request("/docs/getting-started");
    const component = await request("/components/sidebar");
    const asset = await request("/assets/css/site.css");

    assert.equal(home.status, 200);
    assert.match(home.body, /<h1>A Small Site You Can Copy<\/h1>/);
    assert.match(home.body, /id="container"/);

    assert.equal(nested.status, 200);
    assert.match(nested.body, /<title>Start from the Basic Example<\/title>/);

    assert.equal(component.status, 200);
    assert.match(component.headers["content-type"], /text\/html/);
    assert.match(component.body, /<h2>Sections<\/h2>/);
    assert.doesNotMatch(component.body, /<!doctype html>|id="container"/);

    assert.equal(asset.status, 200);
    assert.match(asset.headers["content-type"], /text\/css/);
    assert.match(asset.body, /#topnav_div ul/);
    assert.match(asset.body, /#right_div/);
  } finally {
    await stopCommand(command.child);
  }
});

test("renders Markdown content into a templated HTML page", async () => {
  const srcDir = await createFixtureWebsite();
  const { renderPageFromFile } = await buildRenderer(fixtureConfig(srcDir));

  const { html, title } = await renderPageFromFile(
    path.join(srcDir, "content/index.md"),
    true,
  );

  assert.equal(title, "Fixture Home");
  assert.match(html, /<title>Fixture Home<\/title>/);
  assert.match(html, /<main><h1>Ignored Heading<\/h1>/);
  assert.match(html, /Hello <strong>fixture<\/strong> page\./);
  assert.match(html, /<header>Fixture Header<\/header>/);
  assert.doesNotMatch(html, /{{body}}|{{title}}/);
});

test("renders HTML content into a templated page without Markdown conversion", async () => {
  const srcDir = await createFixtureWebsite();
  await fs.writeFile(
    path.join(srcDir, "content/contact.html"),
    [
      "<h1>Contact Us</h1>",
      "<form action=\"/contact\" method=\"post\">",
      "<label>Name <input name=\"name\"></label>",
      "</form>",
    ].join("\n"),
    "utf8",
  );

  const { renderPageFromFile } = await buildRenderer(fixtureConfig(srcDir));
  const { html, title } = await renderPageFromFile(path.join(srcDir, "content/contact.html"), true);

  assert.equal(title, "Contact Us");
  assert.match(html, /<title>Contact Us<\/title>/);
  assert.match(html, /<main><h1>Contact Us<\/h1>/);
  assert.match(html, /<form action="\/contact" method="post">/);
  assert.doesNotMatch(html, /<p><h1>|&lt;form/);
});

test("uses and removes embedded HTML title metadata before rendering page body", async () => {
  const srcDir = await createFixtureWebsite();
  await fs.writeFile(
    path.join(srcDir, "content/contact.html"),
    [
      "<title>Legacy Contact &amp; Sales</title>",
      "<h1>Contact Us</h1>",
      "<p>Talk to the Digital Fruition team.</p>",
    ].join("\n"),
    "utf8",
  );

  const { renderPageFromFile } = await buildRenderer(fixtureConfig(srcDir));
  const { html, title } = await renderPageFromFile(path.join(srcDir, "content/contact.html"), true);

  assert.equal(title, "Legacy Contact & Sales");
  assert.match(html, /<title>Legacy Contact &amp; Sales<\/title>/);
  assert.match(html, /<main>\s*<h1>Contact Us<\/h1>/);
  assert.doesNotMatch(html, /<main>[\s\S]*<title>/);
});

test("uses first parsed HTML H1 when HTML title metadata is absent", async () => {
  const srcDir = await createFixtureWebsite();
  await fs.writeFile(
    path.join(srcDir, "content/contact.html"),
    [
      "<section>",
      "<h1>Contact <span>Digital Fruition</span></h1>",
      "<p>Legacy HTML fragment.</p>",
      "</section>",
    ].join("\n"),
    "utf8",
  );

  const { renderPageFromFile } = await buildRenderer(fixtureConfig(srcDir));
  const { html, title } = await renderPageFromFile(path.join(srcDir, "content/contact.html"), true);

  assert.equal(title, "Contact Digital Fruition");
  assert.match(html, /<title>Contact Digital Fruition<\/title>/);
  assert.match(html, /<h1>Contact <span>Digital Fruition<\/span><\/h1>/);
});

test("uses frontmatter title and omits frontmatter from page body", async () => {
  const srcDir = await createFixtureWebsite();
  await fs.writeFile(
    path.join(srcDir, "content/index.md"),
    ["---", "title: Frontmatter Title", "---", "", "# Body Heading", "", "Page body."].join("\n"),
    "utf8",
  );

  const { renderPageFromFile } = await buildRenderer(fixtureConfig(srcDir));
  const { html, title } = await renderPageFromFile(path.join(srcDir, "content/index.md"), true);

  assert.equal(title, "Frontmatter Title");
  assert.match(html, /<title>Frontmatter Title<\/title>/);
  assert.match(html, /<h1>Body Heading<\/h1>/);
  assert.doesNotMatch(html, /title: Frontmatter Title/);
  assert.doesNotMatch(html, /---/);
});

test("uses first Markdown H1 when frontmatter title is absent", async () => {
  const srcDir = await createFixtureWebsite();
  await fs.writeFile(
    path.join(srcDir, "content/index.md"),
    ["# Heading Title", "", "# Later Heading", "", "Page body."].join("\n"),
    "utf8",
  );

  const { renderPageFromFile } = await buildRenderer(fixtureConfig(srcDir));
  const { html, title } = await renderPageFromFile(path.join(srcDir, "content/index.md"), true);

  assert.equal(title, "Heading Title");
  assert.match(html, /<title>Heading Title<\/title>/);
});

test("uses filename stem when no frontmatter title or H1 exists", async () => {
  const srcDir = await createFixtureWebsite();
  await fs.writeFile(
    path.join(srcDir, "content/plain-page.md"),
    "Plain page body without a heading.\n",
    "utf8",
  );

  const { renderPageFromFile } = await buildRenderer(fixtureConfig(srcDir));
  const { html, title } = await renderPageFromFile(path.join(srcDir, "content/plain-page.md"), true);

  assert.equal(title, "plain-page");
  assert.match(html, /<title>plain-page<\/title>/);
});

test("escapes HTML in titles inserted into templates", async () => {
  const srcDir = await createFixtureWebsite();
  await fs.writeFile(
    path.join(srcDir, "content/index.md"),
    ["---", "title: \"<script>alert('x')</script> & Site\"", "---", "", "Page body."].join("\n"),
    "utf8",
  );

  const { renderPageFromFile } = await buildRenderer(fixtureConfig(srcDir));
  const { html, title } = await renderPageFromFile(path.join(srcDir, "content/index.md"), true);

  assert.equal(title, "<script>alert('x')</script> & Site");
  assert.match(
    html,
    /<title>&lt;script&gt;alert\(&#39;x&#39;\)&lt;\/script&gt; &amp; Site<\/title>/,
  );
  assert.doesNotMatch(html, /<title><script>/);
});

test("renders valid Markdown includes from approved component directory", async () => {
  const srcDir = await createFixtureWebsite();
  await fs.mkdir(path.join(srcDir, "components"), { recursive: true });
  await fs.writeFile(
    path.join(srcDir, "components/sidebar.md"),
    ["<aside>", "", "## Sidebar", "", "Reusable **Markdown** component.", "", "</aside>"].join("\n"),
    "utf8",
  );
  await fs.writeFile(
    path.join(srcDir, "content/index.md"),
    ["# Page", "", "<!-- include: components/sidebar.md -->"].join("\n"),
    "utf8",
  );

  const { renderPageFromFile } = await buildRenderer(fixtureConfig(srcDir));
  const { html } = await renderPageFromFile(path.join(srcDir, "content/index.md"), true);

  assert.match(html, /<aside>/);
  assert.match(html, /<h2>Sidebar<\/h2>/);
  assert.match(html, /Reusable <strong>Markdown<\/strong> component\./);
});

test("renders one-level HTML includes", async () => {
  const srcDir = await createFixtureWebsite();
  await fs.writeFile(
    path.join(srcDir, "content/index.md"),
    ["# Page", "", "<!-- include: includes/notice.html -->"].join("\n"),
    "utf8",
  );
  await fs.writeFile(
    path.join(srcDir, "includes/notice.html"),
    "<section>One-level notice</section>\n",
    "utf8",
  );

  const { renderPageFromFile } = await buildRenderer(fixtureConfig(srcDir));
  const { html } = await renderPageFromFile(path.join(srcDir, "content/index.md"), true);

  assert.match(html, /<section>One-level notice<\/section>/);
});

test("renders two-level nested HTML includes", async () => {
  const srcDir = await createFixtureWebsite();
  await fs.writeFile(
    path.join(srcDir, "content/index.md"),
    ["# Page", "", "<!-- include: includes/outer.html -->"].join("\n"),
    "utf8",
  );
  await fs.writeFile(
    path.join(srcDir, "includes/outer.html"),
    ["<section>", "Outer before", "<!-- include: includes/inner.html -->", "Outer after", "</section>"].join("\n"),
    "utf8",
  );
  await fs.writeFile(
    path.join(srcDir, "includes/inner.html"),
    "<strong>Nested HTML include</strong>\n",
    "utf8",
  );

  const { renderPageFromFile } = await buildRenderer(fixtureConfig(srcDir));
  const { html } = await renderPageFromFile(path.join(srcDir, "content/index.md"), true);

  assert.match(html, /Outer before/);
  assert.match(html, /<strong>Nested HTML include<\/strong>/);
  assert.match(html, /Outer after/);
});

test("renders Markdown includes nested inside HTML includes", async () => {
  const srcDir = await createFixtureWebsite();
  await fs.mkdir(path.join(srcDir, "components"), { recursive: true });
  await fs.writeFile(
    path.join(srcDir, "content/index.md"),
    ["# Page", "", "<!-- include: includes/card.html -->"].join("\n"),
    "utf8",
  );
  await fs.writeFile(
    path.join(srcDir, "includes/card.html"),
    ["<aside>", "<!-- include: components/card-body.md -->", "</aside>"].join("\n"),
    "utf8",
  );
  await fs.writeFile(
    path.join(srcDir, "components/card-body.md"),
    ["## Card Body", "", "Nested **Markdown** body."].join("\n"),
    "utf8",
  );

  const { renderPageFromFile } = await buildRenderer(fixtureConfig(srcDir));
  const { html } = await renderPageFromFile(path.join(srcDir, "content/index.md"), true);

  assert.match(html, /<aside>/);
  assert.match(html, /<h2>Card Body<\/h2>/);
  assert.match(html, /Nested <strong>Markdown<\/strong> body\./);
  assert.match(html, /<\/aside>/);
});

test("renders nested includes inside Markdown fragments", async () => {
  const srcDir = await createFixtureWebsite();
  await fs.mkdir(path.join(srcDir, "components"), { recursive: true });
  await fs.writeFile(
    path.join(srcDir, "content/index.md"),
    ["# Page", "", "<!-- include: components/outer.md -->"].join("\n"),
    "utf8",
  );
  await fs.writeFile(
    path.join(srcDir, "components/outer.md"),
    ["## Outer Component", "", "<!-- include: includes/inner.html -->"].join("\n"),
    "utf8",
  );
  await fs.writeFile(
    path.join(srcDir, "includes/inner.html"),
    "<span>Nested from Markdown</span>\n",
    "utf8",
  );

  const { renderPageFromFile } = await buildRenderer(fixtureConfig(srcDir));
  const { html } = await renderPageFromFile(path.join(srcDir, "content/index.md"), true);

  assert.match(html, /<h2>Outer Component<\/h2>/);
  assert.match(html, /<span>Nested from Markdown<\/span>/);
});

test("build renders component Markdown as unwrapped HTML fragments", async () => {
  const srcDir = await createFixtureWebsite();
  await fs.mkdir(path.join(srcDir, "components/nested"), { recursive: true });
  await fs.writeFile(
    path.join(srcDir, "components/sidebar.md"),
    ["<aside>", "", "## Sidebar", "", "Reusable **Markdown** component.", "", "</aside>"].join("\n"),
    "utf8",
  );
  await fs.writeFile(
    path.join(srcDir, "components/nested/badge.md"),
    ["<span class=\"badge\">", "", "**Nested** badge", "", "</span>"].join("\n"),
    "utf8",
  );

  await build(fixtureConfig(srcDir));

  const outDir = path.join(srcDir, "site-output");
  const sidebar = await fs.readFile(path.join(outDir, "components/sidebar.html"), "utf8");
  const badge = await fs.readFile(path.join(outDir, "components/nested/badge.html"), "utf8");

  assert.match(sidebar, /<h2>Sidebar<\/h2>/);
  assert.match(sidebar, /Reusable <strong>Markdown<\/strong> component\./);
  assert.doesNotMatch(sidebar, /<!doctype html>|<html>|<body>|Fixture Header|<main>/);
  assert.match(badge, /<strong>Nested<\/strong> badge/);
});

test("components can be included from content and other components", async () => {
  const srcDir = await createFixtureWebsite();
  await fs.mkdir(path.join(srcDir, "components"), { recursive: true });
  await fs.writeFile(
    path.join(srcDir, "components/badge.md"),
    "<strong>Nested component badge</strong>\n",
    "utf8",
  );
  await fs.writeFile(
    path.join(srcDir, "components/sidebar.md"),
    ["<aside>", "## Sidebar", "<!-- include: components/badge.md -->", "</aside>"].join("\n"),
    "utf8",
  );
  await fs.writeFile(
    path.join(srcDir, "content/index.md"),
    ["# Page", "", "<!-- include: components/sidebar.md -->"].join("\n"),
    "utf8",
  );

  await build(fixtureConfig(srcDir));

  const page = await fs.readFile(path.join(srcDir, "site-output/index.html"), "utf8");
  const sidebar = await fs.readFile(path.join(srcDir, "site-output/components/sidebar.html"), "utf8");

  assert.match(page, /<main><h1>Page<\/h1>/);
  assert.match(page, /<aside>/);
  assert.match(page, /<strong>Nested component badge<\/strong>/);
  assert.match(sidebar, /<aside>/);
  assert.match(sidebar, /<strong>Nested component badge<\/strong>/);
  assert.doesNotMatch(sidebar, /<!doctype html>|Fixture Header|<main>/);
});

test("preview renders component routes as unwrapped HTML fragments", async () => {
  const srcDir = await createFixtureWebsite();
  await fs.mkdir(path.join(srcDir, "components"), { recursive: true });
  await fs.writeFile(
    path.join(srcDir, "components/sidebar.md"),
    ["## Preview Sidebar", "", "Preview **component** body."].join("\n"),
    "utf8",
  );

  const app = await createPreviewApp(fixtureConfig(srcDir));
  for (const route of ["/components/sidebar", "/components/sidebar.html", "/components/sidebar.md"]) {
    const response = await requestApp(app, route);

    assert.equal(response.status, 200);
    assert.match(response.headers["content-type"], /text\/html/);
    assert.match(response.body, /<h2>Preview Sidebar<\/h2>/);
    assert.match(response.body, /Preview <strong>component<\/strong> body\./);
    assert.doesNotMatch(response.body, /## Preview Sidebar|<!doctype html>|Fixture Header|<main>/);
  }
});

test("build maps content Markdown files to classic HTML output paths", async () => {
  const srcDir = await createFixtureWebsite();
  await fs.writeFile(
    path.join(srcDir, "content/about.md"),
    ["# About", "", "About page body."].join("\n"),
    "utf8",
  );
  await fs.mkdir(path.join(srcDir, "content/docs"), { recursive: true });
  await fs.writeFile(
    path.join(srcDir, "content/docs/getting-started.md"),
    ["# Getting Started", "", "Nested page body."].join("\n"),
    "utf8",
  );

  await build(fixtureConfig(srcDir));

  const outDir = path.join(srcDir, "site-output");
  assert.match(
    await fs.readFile(path.join(outDir, "index.html"), "utf8"),
    /Hello <strong>fixture<\/strong> page\./,
  );
  assert.match(
    await fs.readFile(path.join(outDir, "about.html"), "utf8"),
    /About page body\./,
  );
  assert.match(
    await fs.readFile(path.join(outDir, "docs/getting-started.html"), "utf8"),
    /Nested page body\./,
  );
  assert.equal(await pathExists(path.join(outDir, "docs/getting-started/index.html")), false);
});

test("build maps HTML-only content files to templated HTML output paths", async () => {
  const srcDir = await createFixtureWebsite();
  await fs.mkdir(path.join(srcDir, "content/forms"), { recursive: true });
  await fs.writeFile(
    path.join(srcDir, "content/forms/contact.html"),
    [
      "<h1>Contact Us</h1>",
      "<form>",
      "<button type=\"submit\">Send</button>",
      "</form>",
    ].join("\n"),
    "utf8",
  );

  await build(fixtureConfig(srcDir));

  const outDir = path.join(srcDir, "site-output");
  const rendered = await fs.readFile(path.join(outDir, "forms/contact.html"), "utf8");

  assert.match(rendered, /<title>Contact Us<\/title>/);
  assert.match(rendered, /<main><h1>Contact Us<\/h1>/);
  assert.match(rendered, /<button type="submit">Send<\/button>/);
});

test("build warns and prefers Markdown when matching HTML content also exists", async () => {
  const srcDir = await createFixtureWebsite();
  await fs.writeFile(
    path.join(srcDir, "content/about.md"),
    ["# Markdown About", "", "Markdown body."].join("\n"),
    "utf8",
  );
  await fs.writeFile(
    path.join(srcDir, "content/about.html"),
    ["<h1>HTML About</h1>", "<p>HTML body.</p>"].join("\n"),
    "utf8",
  );

  const originalWarn = console.warn;
  const warnings = [];
  console.warn = (message) => warnings.push(message);
  try {
    await build(fixtureConfig(srcDir));
  } finally {
    console.warn = originalWarn;
  }

  const rendered = await fs.readFile(path.join(srcDir, "site-output/about.html"), "utf8");
  assert.match(rendered, /<h1>Markdown About<\/h1>/);
  assert.match(rendered, /Markdown body\./);
  assert.doesNotMatch(rendered, /HTML body\./);
  assert.deepEqual(warnings, [
    "Warning: both content/about.md and content/about.html exist; using Markdown file.",
  ]);
});

test("preview maps root, extensionless, and html page routes consistently", async () => {
  const srcDir = await createFixtureWebsite();
  await fs.writeFile(
    path.join(srcDir, "content/about.md"),
    ["# About", "", "About page body."].join("\n"),
    "utf8",
  );
  await fs.mkdir(path.join(srcDir, "content/docs"), { recursive: true });
  await fs.writeFile(
    path.join(srcDir, "content/docs/getting-started.md"),
    ["# Getting Started", "", "Nested page body."].join("\n"),
    "utf8",
  );

  const app = await createPreviewApp(fixtureConfig(srcDir));
  const root = await requestApp(app, "/");
  const about = await requestApp(app, "/about");
  const aboutHtml = await requestApp(app, "/about.html");
  const nested = await requestApp(app, "/docs/getting-started");
  const nestedHtml = await requestApp(app, "/docs/getting-started.html");

  assert.equal(root.status, 200);
  assert.match(root.body, /Hello <strong>fixture<\/strong> page\./);

  assert.equal(about.status, 200);
  assert.equal(aboutHtml.status, 200);
  assert.equal(about.body, aboutHtml.body);
  assert.match(about.body, /About page body\./);

  assert.equal(nested.status, 200);
  assert.equal(nestedHtml.status, 200);
  assert.equal(nested.body, nestedHtml.body);
  assert.match(nested.body, /Nested page body\./);
});

test("preview maps HTML-only content pages through extensionless and html routes", async () => {
  const srcDir = await createFixtureWebsite();
  await fs.writeFile(
    path.join(srcDir, "content/contact.html"),
    ["<h1>Contact Us</h1>", "<p>Legacy HTML fragment.</p>"].join("\n"),
    "utf8",
  );

  const app = await createPreviewApp(fixtureConfig(srcDir));
  const contact = await requestApp(app, "/contact");
  const contactHtml = await requestApp(app, "/contact.html");

  assert.equal(contact.status, 200);
  assert.equal(contactHtml.status, 200);
  assert.equal(contact.body, contactHtml.body);
  assert.match(contact.body, /<title>Contact Us<\/title>/);
  assert.match(contact.body, /<main><h1>Contact Us<\/h1>/);
  assert.match(contact.body, /Legacy HTML fragment\./);
});

test("preview warns and prefers Markdown when matching HTML content also exists", async () => {
  const srcDir = await createFixtureWebsite();
  await fs.writeFile(
    path.join(srcDir, "content/about.md"),
    ["# Markdown About", "", "Markdown preview body."].join("\n"),
    "utf8",
  );
  await fs.writeFile(
    path.join(srcDir, "content/about.html"),
    ["<h1>HTML About</h1>", "<p>HTML preview body.</p>"].join("\n"),
    "utf8",
  );

  const originalWarn = console.warn;
  const warnings = [];
  console.warn = (message) => warnings.push(message);
  try {
    const app = await createPreviewApp(fixtureConfig(srcDir));
    const about = await requestApp(app, "/about");

    assert.equal(about.status, 200);
    assert.match(about.body, /<h1>Markdown About<\/h1>/);
    assert.match(about.body, /Markdown preview body\./);
    assert.doesNotMatch(about.body, /HTML preview body\./);
  } finally {
    console.warn = originalWarn;
  }

  assert.deepEqual(warnings, [
    "Warning: both content/about.md and content/about.html exist; using Markdown file.",
  ]);
});

test("preview returns 404 for missing pages and unsupported leaf trailing slash aliases", async () => {
  const srcDir = await createFixtureWebsite();
  await fs.mkdir(path.join(srcDir, "content/docs"), { recursive: true });
  await fs.writeFile(
    path.join(srcDir, "content/docs/getting-started.md"),
    ["# Getting Started", "", "Nested page body."].join("\n"),
    "utf8",
  );

  const app = await createPreviewApp(fixtureConfig(srcDir));
  const missing = await requestApp(app, "/missing");
  const nestedTrailingSlash = await requestApp(app, "/docs/getting-started/");

  assert.equal(missing.status, 404);
  assert.match(missing.body, /Not found: \/missing/);
  assert.equal(nestedTrailingSlash.status, 404);
  assert.match(nestedTrailingSlash.body, /Not found: \/docs\/getting-started\//);
});

test("preview server serves an isolated fixture project over an ephemeral port", async () => {
  const srcDir = await createFixtureWebsite();
  const repoRoot = path.resolve(testDir, "..");

  assert.ok(path.relative(repoRoot, srcDir).startsWith(".."));

  await fs.writeFile(
    path.join(srcDir, "content/about.md"),
    ["# Fixture About", "", "Known **fixture** page."].join("\n"),
    "utf8",
  );
  await fs.writeFile(
    path.join(srcDir, "content/broken.md"),
    ["# Broken", "", "<!-- include: includes/missing.html -->"].join("\n"),
    "utf8",
  );
  await fs.mkdir(path.join(srcDir, "components"), { recursive: true });
  await fs.writeFile(
    path.join(srcDir, "components/sidebar.md"),
    ["## Fixture Sidebar", "", "Reusable **component** fragment."].join("\n"),
    "utf8",
  );
  await fs.mkdir(path.join(srcDir, "assets/css"), { recursive: true });
  await fs.writeFile(
    path.join(srcDir, "assets/css/site.css"),
    "body { color: rebeccapurple; }\n",
    "utf8",
  );

  const server = await startPreviewServer(fixtureConfig(srcDir, { port: 0 }));

  try {
    const address = server.address();
    assert.equal(typeof address, "object");
    assert.ok(address);
    assert.equal(address.address, "127.0.0.1");

    const home = await requestServer(server, "/");
    assert.equal(home.status, 200);
    assert.match(home.headers["content-type"], /text\/html/);
    assert.match(home.body, /<title>Fixture Home<\/title>/);
    assert.match(home.body, /Hello <strong>fixture<\/strong> page\./);
    assert.match(home.body, /<header>Fixture Header<\/header>/);

    const about = await requestServer(server, "/about");
    assert.equal(about.status, 200);
    assert.match(about.body, /<h1>Fixture About<\/h1>/);
    assert.match(about.body, /Known <strong>fixture<\/strong> page\./);

    const component = await requestServer(server, "/components/sidebar");
    assert.equal(component.status, 200);
    assert.match(component.headers["content-type"], /text\/html/);
    assert.match(component.body, /<h2>Fixture Sidebar<\/h2>/);
    assert.match(component.body, /Reusable <strong>component<\/strong> fragment\./);
    assert.doesNotMatch(component.body, /<!doctype html>|Fixture Header|<main>/);

    const asset = await requestServer(server, "/assets/css/site.css");
    assert.equal(asset.status, 200);
    assert.match(asset.headers["content-type"], /text\/css/);
    assert.equal(asset.body, "body { color: rebeccapurple; }\n");

    const missing = await requestServer(server, "/missing");
    assert.equal(missing.status, 404);
    assert.match(missing.body, /Not found: \/missing/);

    const broken = await requestServer(server, "/broken");
    assert.equal(broken.status, 500);
    assert.match(broken.headers["content-type"], /text\/plain/);
    assert.match(broken.body, /Include missing: includes\/missing\.html/);
    assert.equal(broken.body.includes(srcDir), false);
  } finally {
    await closeServer(server);
  }
});

test("rejects cycles between two include files with a controlled error", async () => {
  const srcDir = await createFixtureWebsite();
  await fs.writeFile(
    path.join(srcDir, "content/index.md"),
    ["# Page", "", "<!-- include: includes/a.html -->"].join("\n"),
    "utf8",
  );
  await fs.writeFile(
    path.join(srcDir, "includes/a.html"),
    ["A before", "<!-- include: includes/b.html -->"].join("\n"),
    "utf8",
  );
  await fs.writeFile(
    path.join(srcDir, "includes/b.html"),
    ["B before", "<!-- include: includes/a.html -->"].join("\n"),
    "utf8",
  );

  await assert.rejects(
    () => build(fixtureConfig(srcDir)),
    (err) => {
      assert.equal(err.name, "IncludeError");
      assert.equal(err.code, "cycle");
      assert.equal(err.includeRef, "includes/a.html");
      assert.equal(err.message.includes(srcDir), false);
      return true;
    },
  );
});

test("rejects missing includes with a controlled error", async () => {
  const srcDir = await createFixtureWebsite();
  await fs.writeFile(
    path.join(srcDir, "content/index.md"),
    ["# Page", "", "<!-- include: includes/missing.html -->"].join("\n"),
    "utf8",
  );

  await assert.rejects(
    () => build(fixtureConfig(srcDir)),
    (err) => {
      assert.equal(err.name, "IncludeError");
      assert.equal(err.code, "missing");
      assert.equal(err.includeRef, "includes/missing.html");
      assert.equal(err.message.includes(srcDir), false);
      return true;
    },
  );
});

test("rejects traversal includes that escape approved directories", async () => {
  const srcDir = await createFixtureWebsite();
  await fs.writeFile(path.join(srcDir, "secret.html"), "not public\n", "utf8");
  await fs.writeFile(
    path.join(srcDir, "content/index.md"),
    ["# Page", "", "<!-- include: includes/../secret.html -->"].join("\n"),
    "utf8",
  );

  await assert.rejects(
    () => build(fixtureConfig(srcDir)),
    {
      name: "IncludeError",
      code: "outside-allowed-dirs",
      includeRef: "includes/../secret.html",
    },
  );
});

test("rejects absolute-path includes", async () => {
  const srcDir = await createFixtureWebsite();
  const absoluteInclude = path.join(srcDir, "includes/header.html");
  await fs.writeFile(
    path.join(srcDir, "content/index.md"),
    ["# Page", "", `<!-- include: ${absoluteInclude} -->`].join("\n"),
    "utf8",
  );

  await assert.rejects(
    () => build(fixtureConfig(srcDir)),
    {
      name: "IncludeError",
      code: "absolute-path",
      includeRef: absoluteInclude,
    },
  );
});

test("rejects includes that resolve outside approved directories through symlinks", async () => {
  const srcDir = await createFixtureWebsite();
  await fs.writeFile(path.join(srcDir, "secret.html"), "not public\n", "utf8");
  await fs.symlink(
    path.join(srcDir, "secret.html"),
    path.join(srcDir, "includes/secret-link.html"),
  );
  await fs.writeFile(
    path.join(srcDir, "content/index.md"),
    ["# Page", "", "<!-- include: includes/secret-link.html -->"].join("\n"),
    "utf8",
  );

  await assert.rejects(
    () => build(fixtureConfig(srcDir)),
    {
      name: "IncludeError",
      code: "outside-allowed-dirs",
      includeRef: "includes/secret-link.html",
    },
  );
});

test("build writes output from an isolated website directory", async () => {
  const srcDir = await createFixtureWebsite();

  await build(fixtureConfig(srcDir));

  const rendered = await fs.readFile(path.join(srcDir, "site-output/index.html"), "utf8");
  assert.match(rendered, /Hello <strong>fixture<\/strong> page\./);

  const repoDist = path.resolve(testDir, "../dist");
  assert.notEqual(path.resolve(srcDir, "site-output"), repoDist);
});

test("build output contains only deployable generated files", async () => {
  const srcDir = await createFixtureWebsite();

  await fs.writeFile(path.join(srcDir, "site.js"), "console.log('source');\n", "utf8");
  await fs.writeFile(path.join(srcDir, "package.json"), "{}\n", "utf8");
  await fs.writeFile(path.join(srcDir, "package-lock.json"), "{}\n", "utf8");

  await fs.mkdir(path.join(srcDir, ".git"), { recursive: true });
  await fs.writeFile(path.join(srcDir, ".git/config"), "[core]\n", "utf8");

  await fs.mkdir(path.join(srcDir, "node_modules/example-package"), { recursive: true });
  await fs.writeFile(
    path.join(srcDir, "node_modules/example-package/index.js"),
    "export default true;\n",
    "utf8",
  );

  await fs.mkdir(path.join(srcDir, "_Project"), { recursive: true });
  await fs.writeFile(path.join(srcDir, "_Project/plan.txt"), "local planning\n", "utf8");

  await fs.mkdir(path.join(srcDir, "site-output"), { recursive: true });
  await fs.writeFile(path.join(srcDir, "site-output/stale.html"), "stale build\n", "utf8");

  await build(fixtureConfig(srcDir));

  const outDir = path.join(srcDir, "site-output");
  const rendered = await fs.readFile(path.join(outDir, "index.html"), "utf8");
  assert.match(rendered, /Hello <strong>fixture<\/strong> page\./);
  assert.equal(await pathExists(path.join(outDir, "stale.html")), false);

  const blockedOutputs = [
    "site.js",
    "package.json",
    "package-lock.json",
    ".git/config",
    "node_modules/example-package/index.js",
    "site-output/index.html",
    "site-output/stale.html",
    "_Project/plan.txt",
  ];

  const copiedBlockedOutputs = [];
  for (const rel of blockedOutputs) {
    if (await pathExists(path.join(outDir, rel))) {
      copiedBlockedOutputs.push(rel);
    }
  }

  assert.deepEqual(copiedBlockedOutputs, []);
});

test("ignores custom assetsDir and uses the fixed assets convention", async () => {
  const srcDir = await createFixtureWebsite();
  const externalAssetsDir = await fs.mkdtemp(path.join(os.tmpdir(), "df-spark-shared-assets-"));
  await fs.writeFile(path.join(externalAssetsDir, "leaked.txt"), "outside asset\n", "utf8");

  const escapingAssetsDir = path.relative(srcDir, externalAssetsDir);
  await build(fixtureConfig(srcDir, { assetsDir: escapingAssetsDir }));

  const outDir = path.join(srcDir, "site-output");
  assert.match(
    await fs.readFile(path.join(outDir, "index.html"), "utf8"),
    /Hello <strong>fixture<\/strong> page\./,
  );
  assert.equal(await pathExists(path.join(outDir, "assets/leaked.txt")), false);
  assert.equal(
    await pathExists(path.join(srcDir, path.basename(externalAssetsDir), "leaked.txt")),
    false,
  );
});

test("copies approved static assets from the asset convention", async () => {
  const srcDir = await createFixtureWebsite();

  await fs.mkdir(path.join(srcDir, "assets/css"), { recursive: true });
  await fs.mkdir(path.join(srcDir, "assets/images/icons"), { recursive: true });
  await fs.writeFile(path.join(srcDir, "assets/css/site.css"), "body { color: #222; }\n", "utf8");
  await fs.writeFile(path.join(srcDir, "assets/images/icons/logo.svg"), "<svg></svg>\n", "utf8");
  await fs.writeFile(path.join(srcDir, "favicon.ico"), "icon\n", "utf8");
  await fs.writeFile(path.join(srcDir, "robots.txt"), "User-agent: *\nDisallow:\n", "utf8");

  await build(fixtureConfig(srcDir));

  const outDir = path.join(srcDir, "site-output");
  assert.equal(
    await fs.readFile(path.join(outDir, "assets/css/site.css"), "utf8"),
    "body { color: #222; }\n",
  );
  assert.equal(
    await fs.readFile(path.join(outDir, "assets/images/icons/logo.svg"), "utf8"),
    "<svg></svg>\n",
  );
  assert.equal(await fs.readFile(path.join(outDir, "favicon.ico"), "utf8"), "icon\n");
  assert.equal(
    await fs.readFile(path.join(outDir, "robots.txt"), "utf8"),
    "User-agent: *\nDisallow:\n",
  );
});
