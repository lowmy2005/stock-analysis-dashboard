# Development Workflow & Quality Standards

## Quality Checks
- Before finishing changes, run `npm run lint` (`tsc --noEmit`) to verify that all TypeScript types are valid.
- If modifying dependencies or build steps, ensure `npm run build` succeeds.

## Styling & UX
- Follow the existing dark financial terminal aesthetic (Tailwind CSS v4).
- Ensure charts rendered with Recharts adapt to resizing cleanly and support dark mode tooltips.
