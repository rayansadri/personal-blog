# SpendLens portfolio preview

This browser build reuses the supplied SpendLens React screens, charts, and analytics. It runs on GitHub Pages without a Node server, database, or API credentials.

Run `npm ci` then `npm run build` in this directory. Output is written to `../assets/spendlens-app/`. The portfolio device showcase embeds that output and preserves app state when changing devices.

The `preview/` adapters replace Next navigation with hash routes and back the original API contracts with fictional in-memory transactions. Home, Cards, Money DNA, Habits, Activity, Subscriptions, Upcoming, Changes, Insights, Timeline, Patterns, and Splits use the original components. Ask uses the original streaming UI with the local question planner and analytics, including chart cards and evidence. It makes no live AI requests. The import tab only previews a sample statement; it does not upload visitor files. Reset restores all demo state.

No real financial records or server credentials are included. Source components under `src/` come from the user's supplied SpendLens archive; unused server modules are not bundled.
