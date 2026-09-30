# Local Offline Git Backup

## Goal

Use a fully local Git backup path so work continues even when GitHub is blocked or proxy changes break domestic software.

## What is set up

- Local bare Git mirror: `D:\大鹏\smart-tutor-backups\git\smart-tutor.git`
- Local Git remote name: `localbackup`
- Bundle output directory: `D:\大鹏\smart-tutor-backups\bundles`

## Commands

### 1) One-time setup or repair

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup-local-backup.ps1
```

### 2) Push current branch into local mirror

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\push-local-backup.ps1
```

### 3) Create a portable offline bundle

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\create-offline-bundle.ps1
```

## Restore options

### Clone from local mirror

```powershell
git clone D:\大鹏\smart-tutor-backups\git\smart-tutor.git D:\restore\smart-tutor
```

### Clone from bundle

```powershell
git clone D:\大鹏\smart-tutor-backups\bundles\smart-tutor-YYYYMMDD-HHMMSS.bundle D:\restore\smart-tutor
```

## Recommended daily workflow

1. Work normally in `D:\大鹏\smart-tutor`
2. Commit locally
3. Run `scripts\push-local-backup.ps1`
4. If GitHub is available, also run `git push origin main`
5. Before risky refactors, run `scripts\create-offline-bundle.ps1`

## Why this works better for you

- No proxy required for local backup
- Git history stays complete
- Restore does not depend on GitHub
- Domestic software can stay on your normal network mode
