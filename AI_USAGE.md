# AI Usage

This repository is developed with human-guided AI assistance.

Digital Fruition SPARK (Simple Publishing And Rendering Kit) is a static Markdown site generator created as part of Digital Fruition's transition away from the legacy SitePalette publishing platform.

Humans remain responsible for all code, documentation, architecture, review, release, and publication decisions. AI systems are tools used to assist human maintainers; they are not authors, reviewers, approvers, or accountable maintainers of this software.

## Human Oversight

Primary human operator and reviewer:

- Josh Gitlin, Digital Fruition, LLC, `josh@digitalfruition.com`

All AI-assisted work is expected to receive human review before being merged, released, or used operationally.

## AI Systems Used

Known AI systems materially used on this repository:

- OpenAI ChatGPT / Codex, GPT-5.5 Medium
- OpenAI ChatGPT / Codex, GPT-5.5 High

No non-OpenAI AI systems are currently known to have materially contributed to this repository.

## Scope Of AI Assistance

AI assistance has been used for:

- Project planning and ticket drafting.
- Architecture and sequencing discussion.
- Code generation.
- Test generation.
- Documentation generation.
- Code review assistance.
- CI and packaging planning.

The project manager role in the early development process was also assisted by OpenAI ChatGPT / Codex. That workflow generated issue descriptions and review feedback that were then provided to implementation sessions.

## Prompt Preservation

Prompts are preserved where practical through:

- Git commit messages.
- Ticket descriptions.
- Merge request descriptions or review discussion.
- Prompt summaries included in AI-generated tickets and commits.

The exact conversational prompts may not be complete for every early development step. The common implementation prompt pattern was:

```text
Implement the next issue, followed by the relevant ticket body.
```

When exact prompts are unavailable, this file records issue-level prompt summaries reconstructed from ticket descriptions and git history.

Prompts and disclosure artifacts must not include credentials, tokens, private keys, customer data, confidential business information, or sensitive security details.

## Issue-Level AI Assistance Summary

The following summaries describe known or planned AI-assisted work. They are intended as transparency records, not as claims that the work is complete, correct, secure, or production-ready.

| Issue | Area | AI Assistance Summary |
| --- | --- | --- |
| 01 | Test harness | OpenAI Codex assisted with adding deterministic Node.js test coverage, fixture helpers, and CI-oriented test scripts. |
| 02 | Build safety tests | OpenAI Codex assisted with tests proving generated output excludes source files, dependency folders, local planning files, and stale build artifacts. |
| 03 | Asset copying | OpenAI Codex assisted with restricting build output to generated pages, component fragments, intentional `assets/` files, and approved root static files. |
| 04 | Repository hygiene | OpenAI Codex assisted with planning repository ignore rules for generated output and local planning files. |
| 05 | Include path validation | OpenAI Codex assisted with constraining include targets to approved directories and adding controlled diagnostics for invalid includes. |
| 06 | Recursive include support | OpenAI Codex assisted with tests and behavior documentation for nested includes and include-cycle handling. |
| 07 | Frontmatter title behavior | OpenAI Codex assisted with tests and documentation for title derivation from frontmatter, Markdown H1, and filename fallback. |
| 08 | Component rendering | OpenAI Codex assisted with component rendering tests, example component content, and documentation for unwrapped component output. |
| 09 | URL and output mapping | OpenAI Codex assisted with tests and documentation for classic `.html` output paths and preview URL mapping. |
| 10 | Preview server tests | OpenAI Codex assisted with preview server integration tests, an exported testable server startup path, and preview behavior documentation. |
| 11 | CLI polish | OpenAI Codex assisted with CLI help text, clearer error handling, loopback preview binding, option validation, and CLI behavior tests. |
| 12 | GitHub Actions CI | OpenAI Codex assisted with implementing a GitHub Actions CI workflow for pull requests and `main` pushes, including `npm ci`, tests, build, package packing, and packaged `df-spark` fixture verification. Human review remains required before relying on this CI for release decisions. |
| 13 | Example site fixture | OpenAI Codex assisted with adding a standalone `examples/basic-site/` fixture, SitePalette-style template structure, reduced legacy-inspired CSS, sample pages, includes, components, and CLI-oriented verification. |
| 14 | README v1.0 documentation | OpenAI Codex assisted with planning future README alignment work. Implementation remains subject to future human review. |
| 15 | Contributor guide | OpenAI Codex assisted with adding contributor documentation for setup, testing, example-site usage, commit workflow, AI attribution, and public publication hygiene. |
| 16 | Release notes and changelog | OpenAI Codex assisted with planning future release documentation. Implementation remains subject to future human review. |
| 17 | Package CLI for external sites | OpenAI Codex assisted with adding the `df-spark` package binary, package metadata, external website fixture CLI tests, and consumer README quickstart. |
| 18 | Template-site repository pattern | OpenAI Codex assisted with planning the copyable template-site model. Implementation remains subject to future human review. |
| 19 | Public GitHub publication readiness | OpenAI Codex assisted with planning public publication checks, licensing, AI usage disclosure, and first-push hygiene. |
| 20 | Package publish metadata review | OpenAI Codex assisted with reviewing package metadata, package contents, public package posture, deterministic package-install verification, and public GitHub metadata. |
| 21 | Replace placeholder sample content | OpenAI Codex assisted with replacing placeholder repository sample content, fixing navigation to existing pages, adding page-local current-nav styling, adding a nested sample page, and documenting the public-facing example structure. |
| GH-02 | HTML content passthrough | OpenAI Codex assisted with adding passthrough HTML page rendering, parsed HTML title metadata extraction, Markdown-preference warnings for duplicate page bodies, tests, and README documentation. |

## Commit Attribution

Where repository tooling permits, AI-generated commits should use an AI-specific identity such as:

```text
Codex Bot <codex@digitalfruition.com>
```

Some earlier commits may have been committed using human Git identities even when AI assistance was involved. Before first public GitHub publication, maintainers intend to review git history and may rewrite author and committer email addresses to:

```text
2036819+hmblprogrammer@users.noreply.github.com
```

History rewriting should happen only with explicit maintainer approval and before any public GitHub push.

## Review And Release Status

This file is a transparency record. It does not certify that the software is complete, secure, compliant, production-ready, or approved for release.

Human review remains required before:

- Merging AI-assisted changes.
- Publishing the repository publicly.
- Publishing an npm package.
- Creating release tags.
- Deploying generated output for production use.

## Maintenance

Update this file when AI assistance materially affects:

- Code.
- Tests.
- Documentation.
- Project architecture.
- CI/CD configuration.
- Release or publication process.

Prefer a concise prompt summary when preserving full prompts would expose sensitive information or create unnecessary noise.
