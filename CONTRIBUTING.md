# Contributing

Thank you for helping improve DF SPARK.

This repository contains the generator package. Websites built with DF SPARK should live in separate website repositories that depend on this package and call the `df-spark` binary.

## Local Setup

Use Node.js 22 or newer.

Install dependencies:

```bash
npm ci
```

Run the test suite:

```bash
npm test
```

Build the repository sample site:

```bash
npm run build
```

Generate the JUnit test report used by CI:

```bash
npm run test:junit
```

The JUnit report is written to `reports/junit.xml`. The `reports/` directory is ignored by Git.

## Generator Development

Generator behavior lives primarily in `site.js`, with the package binary in `bin/df-spark.js`.

Keep changes focused and aligned with the tested v1.0.0 behavior documented in `README.md` and `TESTING.md`.

When changing rendering, build output, preview behavior, CLI parsing, package metadata, or example-site usage, update tests and documentation in the same change when practical.

Before proposing a change, run:

```bash
npm test
npm run build
npm --cache /private/tmp/df-spark-npm-cache pack --dry-run
```

Use `npm pack --dry-run` for package-facing changes so the tarball contents stay intentional.

## Website Template Usage

The copyable starter website is under:

```text
examples/basic-site/
```

It is shaped like a standalone consumer website repository. Its scripts invoke the installed package binary:

```json
{
  "scripts": {
    "build": "df-spark build",
    "serve": "df-spark serve --port 3000"
  }
}
```

Use the example site when checking whether a change still works for external website repositories. The test suite includes coverage for building and previewing the example through the package binary.

## Commit And Review Expectations

Make small, focused commits. Avoid combining unrelated implementation, documentation, and cleanup work unless the change is intentionally tiny.

All changes require human review before merge, release, publication, or operational use.

Do not add secrets, tokens, private keys, customer data, private business information, or deployment credentials to code, tests, documentation, prompts, tickets, or commit messages.

## AI-Assisted Contributions

AI coding agents and AI-assisted contributors must follow `AGENTS.md`.

Key expectations:

* Do not conceal AI involvement.
* Preserve prompt summaries where practical.
* Use an AI-specific Git identity when tooling permits.
* Include AI attribution in commit messages for AI-generated work.
* Update `AI_USAGE.md` when AI assistance materially changes code, tests, documentation, architecture, CI/CD, or release posture.
* Do not claim AI-generated work is complete, approved, secure, compliant, production-ready, or fully tested without independent human review.

Suggested AI-generated commit metadata:

```text
AI-Generated-By: OpenAI Codex
Human-Operator: Josh Gitlin
Prompt-Summary: Brief summary of the requested assistance.
```

## Publication Hygiene

Before public GitHub publication or npm release, maintainers should confirm:

* Only intended branches are pushed publicly.
* Private author emails have been handled according to maintainer policy.
* Ignored generated and local-only paths are not tracked.
* Package metadata uses the intended public name, version, license, binary, and repository URLs.
* Tests, build, and package dry-run checks pass.

Release decisions remain the responsibility of human maintainers.
