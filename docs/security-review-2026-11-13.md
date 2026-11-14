# Development image exception review: 2026-11-13

Scope: Node 26.13.1, Debian Trixie, Portfolio local development image only.
Seven existing ID/package decisions were re-evaluated for their exact current
versions. Expiry: 2026-11-19T18:00:00Z (2026-11-20 03:00 JST), one week after
the previous expiry. No monitor thresholds or matching rules changed.

## Revalidated exclusions

- CVE-2026-42250 / libbz2-1.0 1.0.8-6: vulnerable bzip2recover utility
  absent; bzip2 package not installed. The shared library alone does not
  provide this executable's vulnerable recovery logic.
- CVE-2026-16742 / libsystemd0 and libudev1 257.13-1~deb13u1:
  systemd-homed executable/package/process absent.
- CVE-2026-15059 / the same two packages: systemd-oomd
  executable/package/process absent; no affected IPC service.
- CVE-2026-89092 / libc-bin and libc6 2.41-12+deb13u4:
  nscd package/executable/process/socket absent.

Checked the running container package status, filesystem and process list.
Compose mounts only the project and its node_modules volume, not host nscd,
systemd or DBus sockets. Reassess when packages, mounts or commands change.
These are absent-component findings, not a blanket claim that development
images or static-site build tools cannot affect production artifacts.

Debian official tracker, checked 2026-11-13, has no fixed Trixie package for
these four advisories. Some have upstream or unstable-release fixes; mixing
unstable core packages into this stable image is not a supported routine update.

- https://security-tracker.debian.org/tracker/CVE-2026-42250
- https://security-tracker.debian.org/tracker/CVE-2026-16742
- https://security-tracker.debian.org/tracker/CVE-2026-15059
- https://security-tracker.debian.org/tracker/CVE-2026-89092

## Verification and limits

Fresh final-candidate Trivy 0.76.0 scan (2026-11-13, DB updated 00:58 UTC):
206 findings, no zlib findings. Applying the exact decision matcher accepts
only 7; 199 remain (44 high, 86 medium, 65 low, 4 unknown). At the new expiry,
all 7 become active again. The other 223 historical decisions remain expired.
The old Bookworm zlib and Node notices were not extended. No new unrelated
CVE exceptions were added. Fixable glob/minimatch findings and unproven
reachability, including other glibc issues, remain visible.

This is not a successful full security-monitor result: remaining findings
still require investigation or remediation. No deployment or push performed.
