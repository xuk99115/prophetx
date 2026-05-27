# Contributing to Arena

Welcome! We're really glad you're interested in contributing. 🙏

This project is built by a small team, and every contribution — code, docs, bug reports, or even just feedback — makes it better. This guide will help you get started.

---

## Introduction

Arena is an open-source project that aims to [brief description of what the project does]. We believe great software is built collaboratively, and we welcome contributions from developers of all skill levels.

You don't have to be an expert to help. If something feels wrong or could be better, that's exactly when you should contribute.

---

## Quick Start

### Prerequisites

- Node.js 18+
- npm or pnpm or yarn

### Run locally

```bash
git clone https://github.com/<your-username>/arena.git
cd arena
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and you should see the app running.

### Run tests

```bash
npm test
```

---

## How to Contribute

### 1. Fork and clone

Click the **Fork** button on the repository page, then clone your fork:

```bash
git clone https://github.com/<your-username>/arena.git
cd arena
```

### 2. Create a branch

Always work on a feature branch:

```bash
git checkout -b feature/your-awesome-idea
# or for bug fixes:
git checkout -b fix/something-that-bugs-me
```

### 3. Make your changes

Write code, fix bugs, update docs — whatever it is. Try to keep changes focused: one branch = one logical change.

### 4. Submit a Pull Request

Push your branch:

```bash
git push origin feature/your-awesome-idea
```

Then open a Pull Request on GitHub. Fill in the PR template (it'll appear automatically).

---

## Code Style

We use automated formatting to keep things consistent — you shouldn't have to think about it too hard.

- **ESLint** — linting is enforced. Run `npm run lint` to check.
- **Prettier** — formatting is automated. Your editor should pick up the config from `.prettierrc`, or you can run `npm run format`.
- **TypeScript** — all new code should be typed. If you're touching an untyped file, adding types is a welcome contribution too.

Before pushing, make sure everything passes:

```bash
npm run lint
npm run format
npm test
```

---

## Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/). Keep it simple:

- `feat: add dark mode toggle`
- `fix: prevent crash when data is missing`
- `docs: update README with new setup step`
- `refactor: simplify user validation`

Avoid vague messages like "update stuff" or "fix bug". If you're unsure, describe *what* changed and *why* if it's not obvious.

---

## Pull Request Process

1. **Fill out the PR template** — it asks for a description, motivation, and testing steps. Do your best, we'll help refine it.
2. **Link related issues** — if your PR closes an issue, mention `Closes #123` in the description.
3. **All CI checks must pass** — lint, tests, etc. We'll review once everything is green.
4. **At least one approval required** to merge — we aim to review within 2–3 days. If it's been longer, feel free to leave a friendly ping.
5. **Be open to feedback** — code review is a conversation, not a judgment. We're all learning.

You don't need a perfect PR to open it. Draft PRs are welcome for work-in-progress.

---

## Good First Issues

Looking for somewhere to start? These issues are intentionally scoped to be approachable:

- 🟢 `good first issue` label — well-defined tasks, usually self-contained
- 📝 Documentation improvements — typos, missing examples, clearer wording
- 🐛 Bug fixes with tests — great for understanding the codebase
- ⚡ Performance improvements — often self-contained and measurable

Check the [issues page](https://github.com/arena/arena/issues?q=label%3A%22good+first+issue%22) for current candidates.

**How to claim an issue:** Leave a comment saying "I'd like to work on this" and we'll assign it to you. No need to ask permission.

---

## Questions

- **Found a bug?** Open an issue with a clear description and steps to reproduce.
- **Have an idea?** Open a Discussion or an issue tagged `enhancement`. We'd love to hear it.
- **Need help?** The best place to ask is in a GitHub Discussion or by opening a `question` tagged issue.

---

## A Note on Being Welcoming

This project is committed to being inclusive and respectful. Harassment, rudeness, or gatekeeping will not be tolerated. Everyone deserves a welcoming environment to learn and contribute.

Thank you for being here. Let's build something great together. 🚀