# Component boundary

- `layout/` owns safe-area-aware page composition.
- `ui/` owns theme-driven, product-agnostic native primitives.
- Feature components belong under `src/features/<feature>/components` and may compose UI primitives but must not redefine foundation tokens.
- UI primitives must expose native accessibility roles, labels, and states where applicable, preserve Dynamic Type, and keep interactive targets at least 44 by 44 points.
- Health-related presentation must remain non-diagnostic. The safety callout is a visual and semantic container, not a triage engine.
