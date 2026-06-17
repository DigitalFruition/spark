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

test("build writes output from an isolated website directory", async () => {
  const srcDir = await createFixtureWebsite();

  await build(fixtureConfig(srcDir));

  const rendered = await fs.readFile(path.join(srcDir, "site-output/index.html"), "utf8");
  assert.match(rendered, /Hello <strong>fixture<\/strong> page\./);

  const repoDist = path.resolve(testDir, "../dist");
  assert.notEqual(path.resolve(srcDir, "site-output"), repoDist);
});
