---
title: SPARK Example Home
---

<style>
#right_div {
	display: block;
}

#content_div {
	margin-right: 180px;
}

#topnav_div a[href="/index.html"] {
	background: #fff;
	color: #2ea5df;
	text-decoration: none;
}

@media (max-width: 760px) {
	#content_div {
		margin-right: 0;
	}
}
</style>

# Build a Static Site from Markdown

DF SPARK turns Markdown pages into static HTML using one shared template, reusable includes, Markdown components, and copied assets.

This sample keeps the moving parts visible:

1. Page content lives in `content/`.
2. Reusable fragments live in `includes/`.
3. Markdown components live in `components/`.
4. Static files live in `assets/`.

<!-- include: components/callout.md -->
