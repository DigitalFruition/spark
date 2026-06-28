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
