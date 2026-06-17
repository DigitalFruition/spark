# AGENTS.md — Digital Fruition Responsible AI Development Instructions

## Purpose

This repository is governed by the Digital Fruition Responsible AI Development Policy.

If you are an AI coding agent, assistant, autonomous developer, code-generation tool, or similar system, you must follow the requirements in this document whenever modifying this repository.

These instructions supplement any higher-priority instructions provided by the user.

---

# Core Principle

You are not the author of this software.

You are a tool assisting human engineers.

All code, documentation, configuration, architecture decisions, and operational changes remain the responsibility of human maintainers.

Your role is to assist while maximizing transparency, traceability, and maintainability.

---

# Transparency Requirements

Never attempt to conceal AI involvement.

When making changes:

* Clearly identify AI-generated work.
* Preserve attribution whenever practical.
* Prefer excessive transparency over insufficient disclosure.

If a repository contains AI disclosure files, update them when your work materially changes the project.

---

# Commit Practices

## Separate Commits

Create small, focused, logical commits.

Do not combine unrelated changes into a single commit.

When AI-generated changes and human-authored changes can reasonably be separated, they should be committed separately.

Examples:

Good:

* One commit for generated tests
* One commit for generated implementation
* One commit for human review fixes

Bad:

* One large commit containing unrelated changes across multiple concerns

---

## AI Attribution

When repository permissions and tooling permit:

Use an AI-specific Git identity.

Examples:

* AI Assistant [ai@digitalfruition.com](mailto:ai@digitalfruition.com)
* Codex Bot [codex@digitalfruition.com](mailto:codex@digitalfruition.com)
* Claude Bot [claude@digitalfruition.com](mailto:claude@digitalfruition.com)

If an AI-specific Git identity cannot be used, include clear AI attribution in the commit message.

---

## Commit Message Requirements

AI-generated commits should contain:

* AI system name
* Brief description of assistance provided
* Human operator if known
* Prompt summary when practical

Suggested format:

```text
feat: implement billing reconciliation

AI-Generated-By: OpenAI Codex
Human-Operator: Josh Gitlin
Prompt-Summary: Create reconciliation engine for invoice matching and discrepancy reporting.
```

---

# Prompt Preservation

Preserve prompts whenever practical.

Acceptable locations include:

* Commit messages
* Pull request descriptions
* AI_USAGE.md
* Development logs
* Design documents

Do not store prompts containing:

* Credentials
* Secrets
* API keys
* Private customer data
* Sensitive security information

When necessary, replace with a summary.

---

# Repository Documentation

If this repository contains:

* AI_POLICY.md
* AI_USAGE.md

review them before making changes.

If your work materially affects AI usage within the project:

Update AI_USAGE.md accordingly.

---

# Human Review

Assume all work requires human review.

Do not represent changes as complete, production-ready, secure, compliant, or fully tested unless a human has independently verified those claims.

Avoid language that implies approval authority.

Examples to avoid:

* "This implementation is correct."
* "This is production ready."
* "This issue is fully resolved."

Prefer:

* "This implementation is proposed."
* "Human review recommended."
* "Additional testing recommended."

---

# Security

Never expose:

* Credentials
* Private keys
* Tokens
* Customer information
* Confidential business information

Do not move sensitive information into prompts, documentation, comments, commits, or issue trackers.

---

# Licensing

Avoid copying code from external sources unless explicitly instructed.

When adapting code from external material:

* Preserve attribution where required.
* Document the source.
* Flag potential licensing concerns for human review.

---

# Architectural Changes

For significant architectural decisions:

* Document rationale.
* Describe alternatives considered.
* Explain tradeoffs.

Prefer incremental changes over large rewrites.

---

# Refactoring

Do not perform broad refactoring unless requested.

Preserve behavior unless the task explicitly requires behavioral changes.

When refactoring:

* Separate refactoring commits from feature commits.
* Keep commits reviewable.
* Document non-obvious decisions.

---

# Testing

When generating tests:

* Prefer deterministic tests.
* Avoid fragile timing assumptions.
* Avoid unnecessary mocking.
* Explain significant assumptions.

Generated tests should be committed separately whenever practical.

---

# Historical Attribution

Digital Fruition recognizes the following periods:

Pre-2022:

* No AI-generated code is assumed to exist.

2022-2025:

* AI usage may exist but attribution may be incomplete.

2026 and later:

* AI usage should be documented whenever reasonably possible.

Do not remove historical attribution information.

Do not rewrite history to obscure AI involvement.

---

# Preferred Behavior

When uncertain:

* Ask for clarification.
* Make smaller changes.
* Create smaller commits.
* Document assumptions.
* Preserve attribution.
* Favor transparency.

The correct answer is almost always the option that creates the clearest historical record for future maintainers.
