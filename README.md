# DF SPARK

Digital Fruition SPARK is a lightweight static website generator written in Node.js.

It converts Markdown files into HTML pages using a shared HTML template and reusable include files. It supports both:

* **Live preview mode** for local development
* **Static build mode** for CI/CD pipelines and CDN deployment

The generated output is pure static HTML, CSS, JavaScript, and assets suitable for deployment to:

* Cloudflare Pages
* Cloudflare R2 + CDN
* Amazon S3 + CloudFront
* GitHub Pages
* Netlify
* Any static web host

---

# Quick Start

Use DF SPARK from a website repository that contains your content, templates, includes, components, and assets.

Install the package:

```bash
npm install --save-dev @digitalfruition/spark
```

Add package scripts:

```json
{
  "scripts": {
    "build": "df-spark build",
    "serve": "df-spark serve --port 3000"
  }
}
```

Create the expected site files:

```text
.
├── package.json
├── template.html
├── content/
│   └── index.md
├── includes/
├── components/
└── assets/
```

Add a minimal `template.html`:

```html
<!doctype html>
<html>
<head>
    <meta charset="utf-8">
    <title>{{title}}</title>
</head>
<body>
<main>
{{body}}
</main>
</body>
</html>
```

Add `content/index.md`:

```markdown
---
title: Home
---

# Home

Welcome to the site.
```

Preview locally:

```bash
npm run serve
```

Build static output:

```bash
npm run build
```

The generated site is written to `dist/`.

---

# Project Goals

## Simplicity

Content should be written as Markdown files stored directly in Git.

No databases, build servers, CMS platforms, or runtime dependencies are required once the site is published.

## Reusable Layouts

All pages share a common HTML template containing:

* Site header
* Navigation
* Footer
* Shared CSS and JavaScript references

Individual page content is injected into the template automatically.

## Modular Components

Reusable content fragments can be stored separately and included wherever needed.

Examples:

* Navigation menus
* Callout boxes
* Sidebars
* Shared notices
* Legal disclaimers

## Fast Local Development

A local preview server renders pages on demand.

Content changes are immediately visible without running a full site build.

## CI/CD Friendly

A single command renders the entire site into a static `dist/` directory suitable for publication by a CI pipeline.

---

# Directory Structure

```text
.
├── site.js
├── package.json
├── template.html
│
├── includes/
│   ├── header.html
│   ├── nav.html
│   └── footer.html
│
├── components/
│   ├── sidebar.md
│   └── callout.md
│
├── content/
│   ├── index.md
│   ├── about.md
│   └── docs/
│       └── getting-started.md
│
└── dist/
```

---

# Content Model

## Pages

Markdown files under `content/` become full website pages.

Example:

```text
content/about.md
```

becomes:

```text
dist/about.html
```

The generated HTML is wrapped using `template.html`.

---

## Components

Markdown files under `components/` become reusable HTML fragments.

Example:

```text
components/sidebar.md
```

becomes:

```text
dist/components/sidebar.html
```

Component output is **not wrapped** in the site template.

Nested component paths are preserved:

```text
components/cards/callout.md
```

becomes:

```text
dist/components/cards/callout.html
```

Components may include files from `includes/` or other Markdown components, and pages, templates, and other components may include them using the standard include syntax.

This allows components to be reused independently and previewed directly.

---

## Includes

Files under `includes/` are inserted directly into templates or pages.

Examples:

```text
includes/header.html
includes/footer.html
includes/nav.html
```

These are not published directly.

They exist only to build pages.

---

# Template System

The main template file is:

```text
template.html
```

Example:

```html
<!doctype html>
<html>
<head>
    <title>{{title}}</title>
</head>
<body>

<!-- include: includes/header.html -->
<!-- include: includes/nav.html -->

<main>
{{body}}
</main>

<!-- include: includes/footer.html -->

</body>
</html>
```

---

# Template Variables

## Page Body

```html
{{body}}
```

Replaced with rendered Markdown content.

---

## Page Title

```html
{{title}}
```

Populated from the first available source:

1. `title` in frontmatter
2. First Markdown H1
3. Markdown filename stem

Titles are HTML-escaped when inserted into the template.

---

# Include Syntax

Includes use standard HTML comments:

```html
<!-- include: includes/nav.html -->
```

Markdown components may also be included:

```html
<!-- include: components/sidebar.md -->
```

The same include syntax works in `template.html`, Markdown pages under `content/`, HTML fragments under `includes/`, and Markdown components under `components/`.

Include targets must be relative paths under one of these project source directories:

```text
includes/
components/
```

The renderer will:

1. Load the file
2. Render Markdown if necessary
3. Insert the resulting HTML
4. Resolve nested includes recursively

Nested includes are supported across HTML and Markdown fragments. For example, an HTML include may include another HTML fragment or a Markdown component, and a Markdown component may include additional fragments.

Missing includes, include cycles, absolute-path includes, and includes that use `..` traversal to escape the approved directories fail rendering with a controlled include diagnostic. Static build mode exits non-zero. Live preview mode returns a `500` response with a readable diagnostic.

---

# Frontmatter

Optional YAML frontmatter may be added to any page.

Example:

```markdown
---
title: About Us
---

# About

Welcome to our website.
```

For v1.0.0, the supported frontmatter field is:

* `title`: used for the `{{title}}` template variable

Frontmatter is metadata only and is not rendered into the page body.

---

# URL Mapping

## Page Output Mapping

Static build mode writes Markdown pages under `content/` to matching `.html` files under `dist/`.

```text
content/index.md
→ dist/index.html
```

```text
content/about.md
→ dist/about.html
```

```text
content/docs/getting-started.md
→ dist/docs/getting-started.html
```

Directory-style build output is not part of v1.0.0. A source file such as:

```text
content/docs/getting-started.md
```

does not generate:

```text
dist/docs/getting-started/index.html
```

Future enhancements may add directory-style output, canonical URL generation, or redirects.

## Page Preview Mapping

Live preview mode accepts classic `.html` page URLs and extensionless aliases:

```text
content/index.md
→ /
```

```text
content/about.md
→ /about
→ /about.html
```

```text
content/docs/getting-started.md
→ /docs/getting-started
→ /docs/getting-started.html
```

Preview does not alias a leaf Markdown file to a trailing-slash route. For example, this source file:

```text
content/docs/getting-started.md
```

is not served from:

```text
/docs/getting-started/
```

That route is reserved for an actual directory index source such as:

```text
content/docs/getting-started/index.md
```

This keeps v1.0.0 preview behavior aligned with classic `.html` build output instead of implying directory-style output that the build does not generate.

## Component Mapping

```text
components/sidebar.md
→ /components/sidebar.html
```

```text
components/cards/callout.md
→ /components/cards/callout.html
```

Component preview routes render the same unwrapped HTML fragments as static build output. The preview server also accepts extensionless component routes such as:

```text
/components/sidebar
```

---

# Live Preview Mode

Start the development server:

```bash
npm run serve
```

Default URL:

```text
http://127.0.0.1:3000
```

Features:

* Render pages on demand
* Render component routes as unwrapped HTML fragments
* No build step required
* Supports includes
* Supports Markdown rendering
* Suitable for local development

The preview server binds to `127.0.0.1` by default. Use `--host 0.0.0.0` only when you intentionally need access from another device or container.

---

# Static Build Mode

Generate a complete static site:

```bash
npm run build
```

Output:

```text
dist/
```

All Markdown files are rendered and written to disk.

This mode is intended for CI/CD pipelines.

---

# Command Line

Show CLI usage:

```bash
df-spark --help
```

From this repository checkout, the primary project commands remain:

```bash
npm run build
npm run serve
```

The package exposes a `df-spark` binary for website repositories that depend on SPARK.

Supported build flags:

```text
--out dist
--content content
--components components
--includes includes
--template template.html
```

Supported preview flags:

```text
--port 3000
--host 127.0.0.1
--content content
--components components
--includes includes
--template template.html
```

Independent website repositories should call the package binary from their npm scripts instead of referencing this repository's `site.js` file directly. For example:

```json
{
  "devDependencies": {
    "@digitalfruition/spark": "^0.1.0"
  },
  "scripts": {
    "build": "df-spark build",
    "serve": "df-spark serve --port 3000"
  }
}
```

The direct `node site.js ...` entrypoint remains available for repository development and tests, but website repositories should use `df-spark`.

---

# Package Metadata

DF SPARK is shaped as a public scoped npm package named `@digitalfruition/spark` with the CLI binary `df-spark`.

Publishing remains a human release action. The package includes no publish script, credentials, or deployment configuration.

The npm package uses a `files` allowlist so packed releases include only runtime source and public documentation. Local planning files, generated output, reports, tests, and dependency folders are excluded from the package tarball.

The package is configured with MIT licensing and public npm access. Repository, issue tracker, and homepage metadata will be added once the public GitHub repository URL is created.

---

# CI/CD Example

```bash
npm ci
npm run build
```

Publish the contents of:

```text
dist/
```

to the desired static hosting platform.

---

# Testing

Run the deterministic test suite with:

```bash
npm test
```

GitLab CI runs the same tests and publishes JUnit XML test reports for merge requests and `main` branch pipelines.

See `TESTING.md` for the current test cases, fixture strategy, and CI reporting details.

---

# Asset Handling

Intentional static assets belong under:

```text
assets/
```

During static builds, files in `assets/` are copied to:

```text
dist/assets/
```

Nested asset paths are preserved. For example:

```text
assets/images/logo.png
```

becomes:

```text
dist/assets/images/logo.png
```

The build also copies approved root static files when present:

```text
favicon.ico
robots.txt
```

Project source files, package metadata, dependencies, local planning files, and previous build output are not copied into `dist/`.

---

# Design Principles

* Git-first workflow
* Markdown-first content authoring
* No runtime dependencies in production
* Static hosting compatible
* Minimal configuration
* Easy to understand
* Easy to extend

The system intentionally favors simplicity over feature richness. It is designed to be understandable by a single developer in a short amount of time while still supporting reusable layouts and automated deployment.
