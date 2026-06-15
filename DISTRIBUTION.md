# Distribution: shipping BooSkills to other machines

Personal, local-only. The repo itself is the distribution unit: sync it via a
**private git remote**, then run the platform installer to wire skills + agent
personas into each agent's directories. No npm, no marketplace, no skills.sh.

| Platform | Installer | Mode |
|----------|-----------|------|
| Linux / macOS | `bash scripts/install.sh` | symlinks (live; re-run only on new skills) |
| Windows | `pwsh scripts/install.ps1` | copies (re-run after every pull) |

## One-time: publish from this machine (Linux)

The repo has no remote yet. Create a **private** remote and push (you commit and
push manually; agents never do).

```bash
cd /home/samkintop/opt/booskills
git status                      # review what you are about to commit
git add <paths>                 # stage by concern; do not use git add -A
git commit -m "booskills catalog"
# private remote (pick one):
gh repo create booskills --private --source=. --remote=origin   # GitHub private
# or:  git remote add origin git@host:you/booskills.git
git push -u origin master
```

This stays local-only in spirit: a private repo for syncing your own machines, not
a public registry.

## On Windows: first install

Prerequisites: Git and PowerShell 5+ (or `pwsh` 7+). Node.js only if you want the
`boo-router` script to run.

```powershell
git clone <your-private-remote-url> $HOME\opt\booskills
cd $HOME\opt\booskills
# if PowerShell blocks the script:
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\scripts\install.ps1
```

This copies into:
- `%USERPROFILE%\.agents\skills\<name>` (flat catalog)
- `%USERPROFILE%\.claude\skills\<name>` (Claude Code; or use `claude plugin marketplace add .`)
- `%USERPROFILE%\.codex\skills\<name>` and `%USERPROFILE%\.codex\agents\<name>.toml`
- `%USERPROFILE%\.config\opencode\agents\<name>.md`

## On Windows: update

```powershell
cd $HOME\opt\booskills
.\scripts\update.ps1      # git pull --ff-only, then re-run install.ps1
```

Because Windows uses **copy** mode, the installer overwrites the target skill and
agent directories each run; re-running is how you update. (Linux symlinks update
live, so there you only re-run when adding a brand-new skill.)

## Notes / caveats

- **Symlinks.** Two catalog files are symlinks (`boo-router/scripts/router.mjs`,
  `boo-building-ui/references/design-guidance.md`). Git on Windows clones them as
  broken stubs; `install.ps1` overwrites the installed copies with the real files,
  so installed skills are correct even though the cloned repo's stubs are not.
- **OpenCode personas inherit the session model on Windows.** The Linux flow
  injects per-persona models from Paseo's active preset (`apply-agent-models.sh`).
  Windows has no Paseo, so personas install as the base files (no `model:` line)
  and inherit whatever model the OpenCode session runs. Edit the copied `.md`
  files if you want fixed per-persona models there.
- **`boo-router` is Paseo-oriented.** It reads `~/.paseo/model-tiers.json` and an
  active preset, which are Paseo state and are NOT shipped by this repo. On a
  Windows box without Paseo, the other catalog skills work standalone; `boo-router`
  needs those two files present to resolve picks.
- **Collisions.** `install.ps1` clobbers same-named target dirs (that is how update
  works). If you keep hand-authored skills under the same names in those dirs, move
  them first.
