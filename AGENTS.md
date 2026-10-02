# Repository Workflow

- After every completed development update, run the relevant checks, commit the
  update, and push it to GitHub (`origin`). This is the owner's standing request.
- Stage only files belonging to the update. Do not discard or include unrelated
  unfinished changes without the owner's instruction.
- Never commit secrets, local certificates/private keys, personal recordings,
  dependencies, build output, or generated test output.
- Use ordinary non-force pushes. If authentication or a remote conflict prevents
  a push, report the failure clearly; do not claim the update was published.
- Report the pushed commit and verification results when closing out the update.
