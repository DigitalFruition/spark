# Static Markdown Site Generator

A lightweight static website generator written in Node.js.

This project converts Markdown files into HTML pages using a shared HTML template and reusable include files. It supports both:

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

This allows components to be reused independently.

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

Populated from frontmatter or the first Markdown heading.

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

The renderer will:

1. Load the file
2. Render Markdown if necessary
3. Insert the resulting HTML
4. Resolve nested includes recursively

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

Supported fields are currently implementation-defined.

The `title` field is used by the template.

---

# URL Mapping

## Page Mapping

```text
content/index.md
→ /
```

```text
content/about.md
→ /about.html
```

```text
content/docs/getting-started.md
→ /docs/getting-started.html
```

Future enhancements may support directory-style URLs:

```text
/docs/getting-started/
```

via:

```text
dist/docs/getting-started/index.html
```

---

# Live Preview Mode

Start the development server:

```bash
npm run serve
```

Default URL:

```text
http://localhost:3000
```

Features:

* Render pages on demand
* No build step required
* Supports includes
* Supports Markdown rendering
* Suitable for local development

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

See `TESTING.MD` for the current test cases, fixture strategy, and CI reporting details.

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
