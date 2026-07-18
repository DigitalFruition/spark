---
title: Start from the Basic Example
---

<style>
#topnav_div a[href="/docs/getting-started.html"] {
	background: #fff;
	color: #2ea5df;
	text-decoration: none;
}
</style>

# Getting Started

From a copy of this directory:

```bash
npm install
npm run serve
```

Edit `content/index.md`, adjust shared regions under `includes/` and `components/`, and keep site assets under `assets/`.

When the site is ready to publish:

```bash
npm run build
```

SPARK writes static output to `dist/`.
