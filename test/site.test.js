import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { DEFAULTS, build, buildRenderer } from "../site.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));

async function createFixtureWebsite() {
  const srcDir = await fs.mkdtemp(path.join(os.tmpdir(), "md-site-test-"));

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
  const externalAssetsDir = await fs.mkdtemp(path.join(os.tmpdir(), "md-site-shared-assets-"));
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
