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

## Adding Tests

Prefer tests that create their own temporary fixture websites.

Tests should avoid depending on:

* Existing files in `dist/`
* Local machine state
* Network access
* Timers or sleeps
* The repository's sample content unless the test is specifically about that sample content

Generated tests should be deterministic and concise enough for CI logs.
