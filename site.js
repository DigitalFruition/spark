#!/usr/bin/env node
import fs from "node:fs/promises";
import fssync from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import express from "express";
import mime from "mime";
import MarkdownIt from "markdown-it";
import matter from "gray-matter";

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
});

const ASSETS_DIR = "assets";
const ROOT_STATIC_FILES = ["favicon.ico", "robots.txt"];
const DEFAULT_INCLUDE_DIRS = ["includes", "components"];

const DEFAULTS = {
  srcDir: process.cwd(),
  contentDir: "content",
  includesDir: "includes",
  componentsDir: "components",
  templateFile: "template.html",
  outDir: "dist",
  port: 3000,
};

/**
 * Very small argv parser:
 *   node site.js build --out dist
 *   node site.js serve --port 3000
 */
function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const k = a.slice(2);
      const v = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
      args[k] = v;
    } else {
      args._.push(a);
    }
  }
  return args;
}

function toPosix(p) {
  return p.split(path.sep).join("/");
}

function isUnderDir(filePath, dirPath) {
  const rel = path.relative(dirPath, filePath);
  return !!rel && !rel.startsWith("..") && !path.isAbsolute(rel);
}

class IncludeError extends Error {
  constructor(code, includeRef, detail) {
    const displayRef = path.isAbsolute(includeRef) ? "[absolute path]" : toPosix(includeRef);
    super(`Include ${code}: ${displayRef}${detail ? ` (${detail})` : ""}`);
    this.name = "IncludeError";
    this.code = code;
    this.includeRef = includeRef;
  }
}

function allowedIncludeDirs(ctx) {
  return (ctx.allowedIncludeDirs ?? DEFAULT_INCLUDE_DIRS)
    .map((dir) => path.resolve(ctx.srcRoot, dir))
    .filter((dir) => isUnderDir(dir, ctx.srcRoot));
}

function resolveIncludePath(includeRef, ctx) {
  if (path.isAbsolute(includeRef)) {
    throw new IncludeError("absolute-path", includeRef, "absolute include paths are not allowed");
  }

  const includePath = path.resolve(ctx.srcRoot, includeRef);
  const allowedDirs = allowedIncludeDirs(ctx);
  const inAllowedDir = allowedDirs.some((dir) => isUnderDir(includePath, dir));

  if (!inAllowedDir) {
    const allowedLabels = (ctx.allowedIncludeDirs ?? DEFAULT_INCLUDE_DIRS).map((dir) => `${toPosix(dir)}/`);
    throw new IncludeError(
      "outside-allowed-dirs",
      includeRef,
      `includes must be under ${allowedLabels.join(" or ")}`,
    );
  }

  return { includePath, allowedDir: allowedDirs.find((dir) => isUnderDir(includePath, dir)) };
}

async function realIncludePath(includeRef, includePath, allowedDir) {
  let realPath;
  let realAllowedDir;
  try {
    realPath = await fs.realpath(includePath);
    realAllowedDir = await fs.realpath(allowedDir);
  } catch (e) {
    if (e?.code === "ENOENT") {
      throw new IncludeError("missing", includeRef, "file was not found");
    }
    if (e?.syscall === "realpath") {
      throw new IncludeError("read-failed", includeRef, "file could not be read");
    }
    throw e;
  }

  if (!isUnderDir(realPath, realAllowedDir)) {
    throw new IncludeError(
      "outside-allowed-dirs",
      includeRef,
      "includes must resolve inside an approved include directory",
    );
  }

  return realPath;
}

function changeExt(filePath, newExt) {
  return filePath.replace(/\.[^.]+$/, newExt);
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function readText(filePath) {
  return fs.readFile(filePath, "utf8");
}

/**
 * Include syntax:
 *   <!-- include: includes/nav.html -->
 *   <!-- include: components/sidebar.md -->
 */
const INCLUDE_RE = /<!--\s*include:\s*([^\s]+)\s*-->/g;

async function renderIncludes(htmlOrTemplate, ctx) {
  // ctx: { srcRoot, cache, renderMarkdownPartial, visited }
  return replaceAsync(htmlOrTemplate, INCLUDE_RE, async (_m, includeRef) => {
    const { includePath, allowedDir } = resolveIncludePath(includeRef, ctx);
    const readableIncludePath = await realIncludePath(includeRef, includePath, allowedDir);

    // Prevent trivial cycles.
    if (ctx.visited.has(readableIncludePath)) {
      return `<!-- include-cycle: ${toPosix(includeRef)} -->`;
    }

    const key = `inc:${readableIncludePath}`;
    const cached = ctx.cache.get(key);
    if (cached) return cached;

    ctx.visited.add(readableIncludePath);
    let out = "";
    try {
      const content = await readText(readableIncludePath);
      if (includePath.endsWith(".md")) {
        out = await ctx.renderMarkdownPartial(content, readableIncludePath);
      } else {
        // Assume HTML/text fragment
        out = await renderIncludes(content, { ...ctx, visited: ctx.visited });
      }
    } catch (e) {
      if (e instanceof IncludeError) {
        throw e;
      }
      if (e?.code === "ENOENT") {
        throw new IncludeError("missing", includeRef, "file was not found");
      }
      if (e?.syscall === "open") {
        throw new IncludeError("read-failed", includeRef, "file could not be read");
      }
      throw e;
    } finally {
      ctx.visited.delete(readableIncludePath);
    }

    ctx.cache.set(key, out);
    return out;
  });
}

async function replaceAsync(str, re, asyncFn) {
  const matches = [...str.matchAll(re)];
  if (matches.length === 0) return str;

  let out = "";
  let lastIndex = 0;
  for (const m of matches) {
    out += str.slice(lastIndex, m.index);
    out += await asyncFn(...m);
    lastIndex = m.index + m[0].length;
  }
  out += str.slice(lastIndex);
  return out;
}

function deriveTitle({ frontmatter, markdownText, filePath }) {
  if (frontmatter?.title) return String(frontmatter.title);
  const h1 = markdownText.match(/^#\s+(.+)\s*$/m);
  if (h1) return h1[1].trim();
  return path.basename(filePath, path.extname(filePath));
}

async function loadTemplate(templatePath, ctx) {
  const raw = await readText(templatePath);
  const withIncludes = await renderIncludes(raw, ctx);
  return withIncludes;
}

async function renderMarkdownToHtml(markdownText, filePath) {
  const parsed = matter(markdownText);
  const bodyHtml = md.render(parsed.content);
  const title = deriveTitle({
    frontmatter: parsed.data,
    markdownText: parsed.content,
    filePath,
  });
  return { bodyHtml, data: parsed.data ?? {}, title };
}

async function buildRenderer(config) {
  config = { ...DEFAULTS, ...config };
  const cache = new Map(); // include cache etc.
  const srcRoot = config.srcDir;

  const ctxBase = {
    srcRoot,
    cache,
    allowedIncludeDirs: [config.includesDir, config.componentsDir],
    visited: new Set(),
    renderMarkdownPartial: async (mdText, mdPath) => {
      const { bodyHtml } = await renderMarkdownToHtml(mdText, mdPath);
      // Partials can contain includes too (rare, but nice)
      return renderIncludes(bodyHtml, {
        srcRoot,
        cache,
        visited: new Set(),
        renderMarkdownPartial: ctxBase.renderMarkdownPartial, // will be replaced after ctxBase exists
      });
    },
  };

  // Fix self-reference now that ctxBase exists
  ctxBase.renderMarkdownPartial = async (mdText, mdPath) => {
    const { bodyHtml } = await renderMarkdownToHtml(mdText, mdPath);
    return renderIncludes(bodyHtml, { ...ctxBase, visited: new Set() });
  };

  const templatePath = path.resolve(config.srcDir, config.templateFile);
  const templateHtml = await loadTemplate(templatePath, ctxBase);

  async function renderPageFromFile(absMdPath, wrapInTemplate) {
    const mdText = await readText(absMdPath);
    const { bodyHtml, title } = await renderMarkdownToHtml(mdText, absMdPath);
    const bodyWithIncludes = await renderIncludes(bodyHtml, { ...ctxBase, visited: new Set() });

    if (!wrapInTemplate) {
      return {
        html: bodyWithIncludes,
        title,
      };
    }

    // Simple interpolation
    const page = templateHtml
      .replaceAll("{{body}}", bodyWithIncludes)
      .replaceAll("{{title}}", escapeHtml(title));

    return {
      html: page,
      title,
    };
  }

  return { renderPageFromFile };
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function* walkFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      yield* walkFiles(full);
    } else if (ent.isFile()) {
      yield full;
    }
  }
}

async function copyStaticAssets(config, outDir) {
  const absAssetsDir = path.resolve(config.srcDir, ASSETS_DIR);

  if (fssync.existsSync(absAssetsDir)) {
    for await (const file of walkFiles(absAssetsDir)) {
      const rel = path.relative(absAssetsDir, file);
      const outPath = path.join(outDir, ASSETS_DIR, rel);
      await ensureDir(path.dirname(outPath));
      await fs.copyFile(file, outPath);
    }
  }

  for (const fileName of ROOT_STATIC_FILES) {
    const srcPath = path.resolve(config.srcDir, fileName);
    if (!fssync.existsSync(srcPath)) continue;

    const stat = await fs.stat(srcPath);
    if (!stat.isFile()) continue;

    const outPath = path.join(outDir, fileName);
    await ensureDir(path.dirname(outPath));
    await fs.copyFile(srcPath, outPath);
  }
}

async function build(config) {
  config = { ...DEFAULTS, ...config };
  const absContentDir = path.resolve(config.srcDir, config.contentDir);
  const absComponentsDir = path.resolve(config.srcDir, config.componentsDir);
  const absOutDir = path.resolve(config.srcDir, config.outDir);

  await fs.rm(absOutDir, { recursive: true, force: true });
  await ensureDir(absOutDir);

  const { renderPageFromFile } = await buildRenderer(config);

  // Render content pages (wrapped)
  for await (const file of walkFiles(absContentDir)) {
    if (!file.endsWith(".md")) continue;
    const rel = path.relative(absContentDir, file);
    const outRel = changeExt(rel, ".html");
    const outPath = path.join(absOutDir, outRel);

    const { html } = await renderPageFromFile(file, true);
    await ensureDir(path.dirname(outPath));
    await fs.writeFile(outPath, html, "utf8");
  }

  // Render component markdown (unwrapped)
  if (fssync.existsSync(absComponentsDir)) {
    for await (const file of walkFiles(absComponentsDir)) {
      if (!file.endsWith(".md")) continue;
      const rel = path.relative(absComponentsDir, file);
      const outRel = changeExt(rel, ".html");
      const outPath = path.join(absOutDir, config.componentsDir, outRel);

      const { html } = await renderPageFromFile(file, false);
      await ensureDir(path.dirname(outPath));
      await fs.writeFile(outPath, html, "utf8");
    }
  }

  // Copy only intentional static assets, not arbitrary files from the website root.
  await copyStaticAssets(config, absOutDir);

  console.log(`Built -> ${config.outDir}/`);
}

function guessSourceMdFromUrl(urlPath, config) {
  // /           -> content/index.md
  // /about      -> content/about.md
  // /docs/x     -> content/docs/x.md
  // /docs/x/    -> content/docs/x/index.md
  // /components/sidebar -> components/sidebar.md
  let p = urlPath.split("?")[0].split("#")[0];

  // Normalize
  if (!p.startsWith("/")) p = "/" + p;

  // Components route
  if (p.startsWith("/" + config.componentsDir + "/")) {
    const rel = p.slice(("/" + config.componentsDir + "/").length);
    const mdRel = rel.endsWith(".html") ? changeExt(rel, ".md") : rel + ".md";
    return { kind: "component", absPath: path.resolve(config.srcDir, config.componentsDir, mdRel) };
  }

  // Content route
  if (p === "/") {
    return { kind: "page", absPath: path.resolve(config.srcDir, config.contentDir, "index.md") };
  }

  // If requesting /foo.html treat it as foo.md
  if (p.endsWith(".html")) {
    p = changeExt(p, "");
  }

  // Trailing slash -> index.md
  const rel = p.endsWith("/") ? path.join(p, "index") : p;
  const mdRel = rel.replace(/^\//, "") + ".md";
  return { kind: "page", absPath: path.resolve(config.srcDir, config.contentDir, mdRel) };
}

async function serve(config) {
  const absOutDir = path.resolve(config.srcDir, config.outDir);
  const { renderPageFromFile } = await buildRenderer(config);

  const app = express();

  // Serve built assets if present, plus any static files in repo (css/js/images)
  app.use("/" + config.outDir, express.static(absOutDir));

  // Serve static assets directly from src (so you don't need a build for CSS tweaks)
  app.use(express.static(config.srcDir, {
    extensions: ["html"],
    setHeaders(res, filePath) {
      res.setHeader("Cache-Control", "no-store");
      const type = mime.getType(filePath);
      if (type) res.setHeader("Content-Type", type);
    },
  }));

  app.get("*", async (req, res) => {
    try {
      const { absPath, kind } = guessSourceMdFromUrl(req.path, config);

      if (!fssync.existsSync(absPath)) {
        res.status(404).type("text/html").send(`<h1>404</h1><p>Not found: ${escapeHtml(req.path)}</p>`);
        return;
      }

      const wrap = kind !== "component";
      const { html } = await renderPageFromFile(absPath, wrap);

      // Cheap ETag to reduce reload payloads
      const etag = crypto.createHash("sha1").update(html).digest("hex");
      if (req.headers["if-none-match"] === etag) {
        res.status(304).end();
        return;
      }

      res.setHeader("ETag", etag);
      res.setHeader("Cache-Control", "no-store");
      res.type("text/html").send(html);
    } catch (e) {
      if (e instanceof IncludeError) {
        res.status(500).type("text/plain").send(e.message);
        return;
      }
      res.status(500).type("text/plain").send(String(e?.stack || e));
    }
  });

  app.listen(Number(config.port), () => {
    console.log(`Preview: http://localhost:${config.port}`);
    console.log(`Pages from /${config.contentDir}, components from /${config.componentsDir}`);
  });
}

async function main() {
  const args = parseArgs(process.argv);
  const cmd = args._[0] || "build";

  const config = {
    ...DEFAULTS,
    srcDir: path.resolve(DEFAULTS.srcDir),
    contentDir: String(args.content ?? DEFAULTS.contentDir),
    includesDir: String(args.includes ?? DEFAULTS.includesDir),
    componentsDir: String(args.components ?? DEFAULTS.componentsDir),
    templateFile: String(args.template ?? DEFAULTS.templateFile),
    outDir: String(args.out ?? DEFAULTS.outDir),
    port: Number(args.port ?? DEFAULTS.port),
  };

  if (cmd === "build") {
    await build(config);
    return;
  }
  if (cmd === "serve") {
    await serve(config);
    return;
  }

  console.error(`Unknown command: ${cmd}`);
  console.error(`Usage:
  node site.js build [--out dist] [--content content] [--components components] [--includes includes] [--template template.html]
  node site.js serve [--port 3000]
`);
  process.exit(1);
}

export {
  DEFAULTS,
  build,
  buildRenderer,
  deriveTitle,
  guessSourceMdFromUrl,
  parseArgs,
  renderMarkdownToHtml,
};

// Run the CLI only when this file is executed directly, not when imported by tests.
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((e) => {
    console.error(e instanceof IncludeError ? e.message : e);
    process.exit(1);
  });
}
