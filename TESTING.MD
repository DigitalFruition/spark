# Testing

This project uses Node's built-in test runner.

The test suite is intended to provide deterministic coverage for the static site generator before broader v1.0.0 feature work.

## Commands

Run the local test suite:

```bash
npm test
```

Generate a JUnit XML report for CI consumers:

```bash
npm run test:junit
```

The JUnit report is written to:

```text
reports/junit.xml
```

The `reports/` directory is ignored by Git.

## CI Behavior

GitLab CI runs tests for:

* Merge request pipelines
* Pipelines on the `main` branch

The CI job runs:

```bash
npm ci
npm run test:junit
```

The generated JUnit XML file is published through GitLab's `artifacts:reports:junit` setting so GitLab can display individual test cases and pass/fail results in the pipeline UI.

## Fixture Strategy

Tests create isolated temporary website directories with `fs.mkdtemp()`.

Each fixture website is separate from the generator source tree and contains its own:

* `template.html`
* `content/index.md`
* `includes/header.html`

This keeps tests independent of the repository's local `content/`, `includes/`, `template.html`, and `dist/` state.

The fixture output directory is named `site-output` inside the temporary website directory. Tests do not rely on the repository `dist/` directory.

## Current Test Cases

### `renders Markdown content into a templated HTML page`

This test builds a renderer against an isolated temporary website directory and renders `content/index.md` through the fixture template.

It verifies:

* Frontmatter `title` is used as the page title.
* `{{title}}` is replaced in the HTML template.
* Markdown content is rendered into HTML.
* `{{body}}` is replaced in the HTML template.
* HTML includes are resolved from the fixture website directory.
* Raw `{{body}}` and `{{title}}` placeholders are not left in the output.

This protects the basic page rendering path used by both preview and static build flows.

### `uses frontmatter title and omits frontmatter from page body`

This test renders a page with YAML frontmatter and body content.

It verifies:

* Frontmatter `title` is used as the page title.
* `{{title}}` is populated from frontmatter.
* Frontmatter delimiters and metadata are not rendered into the page body.

This protects the primary v1.0.0 title convention and frontmatter stripping behavior.

### `uses first Markdown H1 when frontmatter title is absent`

This test renders a page without frontmatter and with multiple H1 headings.

It verifies:

* The first Markdown H1 is used as the page title.
* Later headings do not override the derived title.

This protects the first title fallback path.

### `uses filename stem when no frontmatter title or H1 exists`

This test renders a page without frontmatter or H1 content.

It verifies:

* The Markdown filename stem is used as the page title.
* The fallback title is inserted into `{{title}}`.

This protects the final title fallback path.

### `escapes HTML in titles inserted into templates`

This test renders a page with HTML-like text in the frontmatter title.

It verifies:

* The raw derived title remains available to renderer callers.
* The title is HTML-escaped when inserted into the template.
* Raw title HTML is not emitted inside the `<title>` element.

This protects templates from treating title metadata as trusted HTML.

### `renders valid Markdown includes from approved component directory`

This test renders a page that includes a Markdown component from `components/`.

It verifies:

* Markdown include targets under the approved component directory are allowed.
* Included Markdown is rendered to HTML.
* Valid includes continue to work after include path validation.

This protects reusable Markdown components from regressions in include validation.

### `renders one-level HTML includes`

This test renders a page with a direct HTML include from `includes/`.

It verifies:

* One-level include resolution works for HTML fragments.
* Valid include rendering is independent of the template include path.

This protects the most direct reusable HTML fragment workflow.

### `renders two-level nested HTML includes`

This test renders a page with an HTML include that includes another HTML fragment.

It verifies:

* HTML includes may include nested HTML fragments.
* Nested output preserves surrounding outer-fragment content.

This protects recursive HTML include rendering.

### `renders Markdown includes nested inside HTML includes`

This test renders a page with an HTML include that includes a Markdown component.

It verifies:

* HTML includes may include Markdown fragments.
* Nested Markdown fragments are rendered to HTML before insertion.

This protects mixed HTML and Markdown recursive include rendering.

### `renders nested includes inside Markdown fragments`

This test renders a page with a Markdown component that includes another fragment.

It verifies:

* Markdown fragments may contain nested include comments.
* Nested fragments are resolved after Markdown rendering.

This protects recursive include behavior inside reusable Markdown components.

### `build renders component Markdown as unwrapped HTML fragments`

This test runs the static build against a fixture with top-level and nested Markdown components.

It verifies:

* Component Markdown files are written under `dist/components/`.
* Nested component paths are preserved.
* Component output contains rendered Markdown.
* Component output is not wrapped in the full page template.

This protects component build output from regressing into page rendering behavior.

### `components can be included from content and other components`

This test runs the static build against a page that includes a Markdown component which includes another Markdown component.

It verifies:

* Pages under `content/` can include Markdown components.
* Markdown components can include other Markdown components.
* Built component output resolves nested includes.
* Built component output remains unwrapped.

This protects the reusable fragment workflow for pages and nested components.

### `preview renders component routes as unwrapped HTML fragments`

This test drives the preview Express app in-process without opening a network port.

It verifies:

* Extensionless component preview routes render successfully.
* `.html` component preview routes render successfully.
* `.md` component preview routes render through the component renderer instead of returning raw Markdown.
* Previewed component output is not wrapped in the full page template.

This protects preview behavior so it matches static component build output.

### `build maps content Markdown files to classic HTML output paths`

This test runs the static build against root, top-level, and nested Markdown pages.

It verifies:

* `content/index.md` builds to `dist/index.html`.
* `content/about.md` builds to `dist/about.html`.
* `content/docs/getting-started.md` builds to `dist/docs/getting-started.html`.
* Leaf Markdown files do not generate directory-style `index.html` output.

This protects v1.0.0 static output from accidental directory-style URL changes.

### `preview maps root, extensionless, and html page routes consistently`

This test drives the preview Express app in-process without opening a network port.

It verifies:

* `/` renders `content/index.md`.
* `/about` and `/about.html` render the same page.
* `/docs/getting-started` and `/docs/getting-started.html` render the same nested page.

This protects the documented preview aliases for classic `.html` output paths.

### `preview returns 404 for missing pages and unsupported leaf trailing slash aliases`

This test drives the preview Express app in-process without opening a network port.

It verifies:

* Missing preview routes return `404`.
* A trailing-slash route such as `/docs/getting-started/` does not alias to `content/docs/getting-started.md`.

This documents the v1.0.0 design decision to keep leaf trailing-slash routes post-1.0 unless directory-style output is added intentionally.

### `rejects cycles between two include files with a controlled error`

This test runs the static build against two include files that include each other.

It verifies:

* Include cycles fail rendering deterministically.
* The failure is reported as an `IncludeError`.
* The diagnostic identifies the include reference without exposing the fixture source directory path.

This protects build and preview behavior from silently generating partial output for recursive include cycles.

### `rejects missing includes with a controlled error`

This test runs the static build against a page that references a missing include.

It verifies:

* Missing includes fail rendering.
* The failure is reported as an `IncludeError`.
* The diagnostic identifies the include reference without exposing the fixture source directory path.

This protects build and preview diagnostics from leaking unnecessary local filesystem details.

### `rejects traversal includes that escape approved directories`

This test runs the static build against a page with an include reference that uses `..` traversal to escape `includes/`.

It verifies:

* Traversal includes outside approved include directories fail rendering.
* The failure is reported as an `IncludeError`.

This protects include resolution from reading arbitrary files under the website source root.

### `rejects absolute-path includes`

This test runs the static build against a page that references an include by absolute path.

It verifies:

* Absolute include paths fail rendering even when they point at an otherwise valid include file.
* The failure is reported as an `IncludeError`.

This protects include resolution from bypassing project-relative include boundaries.

### `rejects includes that resolve outside approved directories through symlinks`

This test runs the static build against a page with an include reference that points to a symlink inside `includes/`.

It verifies:

* Include validation checks the real resolved file path before reading.
* Symlinks cannot be used to include files outside approved include directories.
* The failure is reported as an `IncludeError`.

This protects include resolution from bypassing approved directories through filesystem links.

### `build writes output from an isolated website directory`

This test runs the static build against an isolated temporary website directory.

It verifies:

* Static build output is written to the fixture's configured output directory.
* Rendered Markdown appears in the generated HTML file.
* The fixture output path is distinct from the repository `dist/` directory.

This protects the ability to run the generator against a website directory outside the generator package.

### `build output contains only deployable generated files`

This test runs the static build against an isolated temporary website directory that includes source files, package metadata, fake dependency and Git directories, local planning files, and stale build output.

It verifies:

* Rendered page output is still generated.
* Project source files are not copied to the build output.
* Package metadata is not copied to the build output.
* `.git/`, `node_modules/`, and `_Project/` contents are not copied to the build output.
* Previous build output is removed before the new build is written.

This protects `dist/` as a directory that can be published directly.

### `ignores custom assetsDir and uses the fixed assets convention`

This test runs the static build with an ignored custom `assetsDir` value that points outside the isolated temporary website directory.

It verifies:

* Rendered page output is still generated.
* The external assets directory is not read.
* The ignored asset path does not create files outside the configured output directory.

This protects the fixed `assets/` convention from path traversal regressions.

### `copies approved static assets from the asset convention`

This test runs the static build against an isolated temporary website directory with assets in the approved static asset locations.

It verifies:

* Files under `assets/` are copied to `dist/assets/`.
* Nested asset paths are preserved.
* Approved root static files such as `favicon.ico` and `robots.txt` are copied when present.

This protects the deliberate asset-copying convention while avoiding a broad repository-root copy.

## Adding Tests

Prefer tests that create their own temporary fixture websites.

Tests should avoid depending on:

* Existing files in `dist/`
* Local machine state
* Network access
* Timers or sleeps
* The repository's sample content unless the test is specifically about that sample content

Generated tests should be deterministic and concise enough for CI logs.
