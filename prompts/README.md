# SeekBrain prompts

`assistant.md` defines the main assistant, all four modes and conversation behavior.
`research.md` describes task-scoped research operations and is attached for Research
and Deep Research. The current mode and project are supplied by the runtime.

These are added as SeekBrain sections in Pi's structured system prompt. Pi retains
its declared-tool guidance, working directory, project instructions and skills.
The CLI sends ordinary user messages; there is no `/entry` template or mandatory
workflow wrapper. Stage prompts remain local to their scientific responsibilities.
