# Syllabase

Upload your syllabi and get one calendar with every deadline and grade weight, a chatbot that knows your classes,
and study tools (cheat sheets, quizzes, flashcards, semester planner) that run on your own notes.
Sync your Canvas or Blackboard calendar feed. Built for UT Dallas first, usable by anyone.

**Live demo:** [syllabase-app.vercel.app](https://syllabase-app.vercel.app). Click "Try it as a guest" to explore sample courses, no sign-up needed.

## Getting started
```bash
npm install
cp .env.example .env.local   # fill in Anthropic + Supabase keys
npm run dev
```

Tests: `npm test` (unit) and `npm run test:db` (database permissions, no Supabase needed).

## Stack
Next.js 16 (App Router) · TypeScript · Tailwind v4 · Supabase (Postgres, Auth, Storage) · Claude Haiku 5.5 via `@anthropic-ai/sdk`
· `node-ical` / `ical-generator` for calendar feeds.

## Credits
Made with [Claude](https://claude.ai).

UTD course, professor and grade data from [UTD Nebula](https://www.utdnebula.com/) (MIT). Historical grade data via
[acmutd/utd-grades](https://github.com/acmutd/utd-grades) (MIT). Professor ratings link to [Rate My Professors](https://www.ratemyprofessors.com/).
