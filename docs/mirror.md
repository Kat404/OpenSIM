# OpenSIM — Mirror a Codeberg (dual push desde local)

OpenSIM vive en dos remotes:

- **GitHub** (canónico): `git@github.com:Kat404/OpenSIM.git` — donde van los PRs, las issues, y donde corre el CI nativo de GitHub.
- **Codeberg** (mirror): `ssh://git@codeberg.org/Kat404/OpenSIM.git` — copia pasiva para discovery / backup / archival FOSS-friendly.

El repo `origin` está configurado con dos push URLs. **Un solo `git push origin <branch>` escribe en ambos.** La elección es deliberada: cero infra extra, control total, sin secrets en GitHub.

## Setup (ya hecho)

```bash
git remote -v
# origin  git@github.com:Kat404/OpenSIM.git          (fetch)
# origin  git@github.com:Kat404/OpenSIM.git          (push)
# origin  ssh://git@codeberg.org/Kat404/OpenSIM.git  (push)
```

Para verificar que ambos push URLs están activos:

```bash
git config --get-all remote.origin.pushurl
# git@github.com:Kat404/OpenSIM.git
# ssh://git@codeberg.org/Kat404/OpenSIM.git
```

## Workflow post-merge

Cuando se mergea el PR (o cuando se pushea cualquier rama):

```bash
# Default — push a ambos remotes:
git push origin <branch>

# Si querés ver el detalle de qué va a cada remote:
git push --dry-run --verbose origin <branch> 2>&1 | grep -E '(Writing|Pushing|To)'

# Push selectivo a UNO (si Codeberg está caído o lo que sea):
git push origin <branch>:<branch>             # GitHub only (usa el primer push URL)
GIT_PUSH_OPTION_COUNT=1 git push origin <branch>  # equivalente explícito
# o cambiá temporalmente con --push-option (ver man git-push)
```

## Caveats

- **SSH key en cada host**: necesitás que tu `~/.ssh/id_ed25519` (o el que uses) esté autorizada tanto en GitHub (`Kat404` account) como en Codeberg (`Kat404` account). Si la key es la misma, basta con autorizarla en ambos. Si son distintas, configuralas via `~/.ssh/config` con dos `Host` blocks:

  ```
  Host github.com
      User git
      IdentityFile ~/.ssh/id_ed25519_github
      IdentitiesOnly yes

  Host codeberg.org
      User git
      IdentityFile ~/.ssh/id_ed25519_codeberg
      IdentitiesOnly yes
  ```

- **Push a Codeberg puede fallar** (host caído, key rotada, etc.) sin que el push a GitHub falle. GitHub sale primero porque es el primer push URL; si Codeberg rechaza, el output lo muestra y vos decidís. Para reintentar solo Codeberg:

  ```bash
  git push origin <branch>:<branch>:codeberg  # pero esto confunde refs
  # más limpio: remote dedicado
  git remote add codeberg ssh://git@codeberg.org/Kat404/OpenSIM.git
  git push codeberg <branch>
  ```

- **No hay sync automático post-merge de PR**: cuando merges un PR en GitHub, el merge commit vive en GitHub pero NO se pushea solo a Codeberg. Tenés que correr `git pull && git push origin main` desde local después de cada merge. Alternativa: hacer el merge localmente con `gh pr merge --squash --delete-branch` y dejar que el push a origin haga el resto.

- **Proteger ramas en Codeberg**: si querés evitar pushes accidentales a `main` directo en Codeberg, activá branch protection en el panel de Codeberg (no hay API equivalente a GitHub). En GitHub ya está cubierto por el PR-only workflow.

## Cambiar a otra estrategia

Si en algún momento querés un sync automático (sin acordarte de pushear), las opciones son:

1. **Mirror nativo de Codeberg** (zero config en el repo, solo en el panel de Codeberg → Mirrors): Codeberg pull-ea de GitHub cada 1-6h. Pro: nada que mantener. Contra: delay.
2. **GitHub Actions push a Codeberg** (workflow que dispara en push a main y pushea a Codeberg vía SSH). Pro: instantáneo. Contra: requiere `CODEBERG_SSH_KEY` como secret en GitHub.
