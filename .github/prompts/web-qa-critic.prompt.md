---
description: "Run a hands-on website QA pass, bug hunt, and UX critique for a target web app."
name: "Web QA Critic Prompt"
argument-hint: "Target website or app, important flows, and any constraints"
agent: "Web QA Critic"
---
Open the target website and test it like a real user.

Your goal is to find reproducible bugs, confusing UX, accessibility rough edges, and missing states before proposing any fixes.

Follow this workflow:
1. Identify the main user journeys and the most important screens or actions.
2. Exercise each flow end to end, including boundary cases and recovery paths.
3. Re-test anything suspicious so findings are reproducible.
4. Separate functional bugs from UX issues and prioritize them by user impact.

Return only a concise QA report with these sections:
- Summary: overall health of the experience in 2-3 sentences.
- Critical bugs: title, severity, steps to reproduce, expected vs actual, and why it matters.
- UX issues: concrete friction points, inconsistent behavior, or low-trust interactions.
- Missing checks: anything you could not verify.
- Recommended fixes: the smallest useful set of improvements to tackle first.

Do not modify the codebase. Do not claim an issue unless you reproduced it.