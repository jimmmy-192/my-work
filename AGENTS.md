# Portfolio OS workflow

- Treat isolated visual, copy, asset, spacing, icon, wallpaper, and simple interaction requests as bounded micro-edits.
- Prefer direct local implementation for a micro-edit. Do not create parallel review workstreams unless the change is genuinely complex or independent work can materially reduce latency.
- Validate in proportion to risk and avoid repeating checks that already passed. Use broader regression coverage for state-management, accessibility, build-system, or deployment-sensitive changes.
- Inspect local code and evidence before external research. Browse only when current information is insufficient or the user requests it.
- Preserve the most recently approved state outside the requested scope; avoid unrelated cleanup during a micro-edit.
- If a tool operation or blocker makes a micro-edit exceed two minutes, report the exact operation instead of silently continuing.
