---
title: Getting Started with SPARK
---

<style>
#topnav_div a[href="/docs/getting-started.html"] {
	background: #fff;
	color: #2ea5df;
	text-decoration: none;
}
</style>

# Getting Started

Use the standalone example as a starting point for a website repository:

```bash
cp -R examples/basic-site my-site
cd my-site
npm install
npm run serve
```

For package consumers, the important convention is that scripts call `df-spark` instead of reaching into this generator repository.
