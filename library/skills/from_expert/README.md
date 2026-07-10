# Expert-saved skills

Skills promoted from finished NeuroScientist Level-1 runs via `/neuro-save-skill`.

Each skill folder is named by the taxonomy
`Stage-Species-Modality-Method-Target` (see
`../Neuroscience_Analysis_Skill_Taxonomy.md`) and is **dual-registered**:

- Matched by the repo `targeted_skill` loader — this dir is listed under
  `modules.targeted_skill.extra_skill_dirs` in `config.yaml`, and `INDEX.md`
  here is regenerated (loader-compatible) by `index_generate.py` on each save.
- Invocable via pi's `/skill:<pi_name>` — this dir is listed under `skills` in
  `.pi/settings.json`.

`INDEX.md` is auto-generated; do not edit it by hand.
