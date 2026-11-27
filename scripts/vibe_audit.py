#!/usr/bin/env python3
"""vibe_audit.py - static scanner for generic AI-generated ("vibe-coded") UI patterns.

Version: 1.0.0
Usage:   python scripts/vibe_audit.py ./src [--fix-suggestions] [--json] [--fail-on high|medium|none]
Exit:    1 if any finding at/above --fail-on severity (default: high), else 0. 2 on usage error.

Security: read-only, stdlib only, no network, never follows symlinks, skips files > 1 MB.
"""
import argparse, json, os, re, sys
from collections import Counter

__version__ = "1.0.0"
EXTS = {".tsx", ".jsx", ".html", ".css", ".vue", ".svelte"}
SKIP_DIRS = {"node_modules", ".git", "dist", "build", ".next", ".nuxt", ".svelte-kit", "coverage", "__pycache__"}
MAX_BYTES = 1_000_000
SEV = {"low": 1, "medium": 2, "high": 3}

COLOR = r"(?:indigo|purple|violet)-(?:400|500|600|700)"
BUZZ = r"\b(?:Unleash(?:ed|es)?|Elevate[sd]?|Revolutioni[sz]e[sd]?|Seamless(?:ly)?|Next-Gen(?:eration)?|Supercharge[sd]?|Delve[sd]?|Game-?changing|Cutting-edge)\b"
EMOJI = "[\U0001F300-\U0001FAFF☀-➿⭐⬆✅❌]"

# (id, severity, regex, message, suggestion)
RULES = [
    ("ai-gradient", "high", re.compile(r"(?:from|via|to)-" + COLOR + r".*(?:from|via|to)-(?:" + COLOR + r"|pink-\d+)|linear-gradient\([^)]*#(?:6366f1|8b5cf6|a855f7|7c3aed)", re.I),
     "Default indigo/purple/pink AI gradient",
     "Use one flat grounded surface plus a single accent (emerald #10B981, amber #F59E0B or cobalt #2563EB) on CTAs/active states only."),
    ("ai-color", "high", re.compile(r"\b(?:bg|text|border|ring|from|via|to|fill|stroke)-" + COLOR + r"\b"),
     "Default Tailwind indigo/purple/violet color",
     "Replace with the project's brand token, or a 60-30-10 palette (alabaster #FAF9F6 / obsidian #0B0D10 base, one accent)."),
    ("neon-glow", "high", re.compile(r"shadow-(?:purple|indigo|violet|pink|fuchsia)-\d+(?:/\d+)?"),
     "Neon glow shadow", "Use a 1px structural border (border-zinc-200/80 or border-white/10) instead of colored glow."),
    ("glassmorphism", "medium", re.compile(r"backdrop-blur-\w+[^\"'`]*bg-white/(?:5|10|15|20)|bg-white/(?:5|10|15|20)[^\"'`]*backdrop-blur-\w+"),
     "Glassmorphism bloat", "Use opaque elevated surfaces with a 1px border; reserve blur for true overlays."),
    ("ai-buzzword", "high", re.compile(BUZZ, re.I),
     "Generic AI copywriting buzzword", "Rewrite as a concrete, measurable, domain-specific statement; use action-specific CTAs."),
    ("emoji-icon", "high", re.compile(EMOJI),
     "Emoji used as UI icon", "Swap for a 1.5px-stroke vector icon (lucide-react, phosphor, or inline SVG)."),
    ("heavy-shadow", "low", re.compile(r"\bshadow-(?:xl|2xl)\b"),
     "Heavy drop shadow", "Prefer a 1px border + subtle surface step."),
    ("floaty-motion", "low", re.compile(r"\banimate-(?:bounce|pulse|ping)\b|hover:-translate-y-\d+\s+hover:scale-1\d+"),
     "Floaty bounce/lift animation", "Use transition-colors duration-150 and active:scale-[0.99] press states."),
    ("grid-3col", "medium", re.compile(r"grid-cols-1\s+(?:sm:grid-cols-2\s+)?(?:md|lg):grid-cols-3"),
     "Cookie-cutter 3-column grid (flagged when repeated in a file)", "Use asymmetric 12-col spans (lg:col-span-7/5) or a Bento grid with varied spans."),
]
FONT_OK = re.compile(r"Instrument Serif|Fraunces|Space Grotesk|Syne|Plus Jakarta|DM Sans|IBM Plex|JetBrains Mono|Geist|Manrope|Newsreader|Bricolage", re.I)
INTER = re.compile(r"\bInter\b|font-inter|Inter\(", re.I)


def iter_files(root):
    if os.path.isfile(root):
        yield root
        return
    for dp, dn, fn in os.walk(root, followlinks=False):
        dn[:] = [d for d in dn if d not in SKIP_DIRS and not os.path.islink(os.path.join(dp, d))]
        for f in fn:
            p = os.path.join(dp, f)
            if os.path.splitext(f)[1].lower() in EXTS and not os.path.islink(p):
                yield p


def scan(root):
    findings, errors = [], []
    inter_hit, font_ok_hit, grid_counts = None, False, {}
    for path in iter_files(root):
        try:
            if os.path.getsize(path) > MAX_BYTES:
                errors.append(f"skipped (>1MB): {path}")
                continue
            with open(path, encoding="utf-8", errors="replace") as fh:
                lines = fh.read().splitlines()
        except OSError as e:
            errors.append(f"unreadable: {path}: {e}")
            continue
        for n, line in enumerate(lines, 1):
            if INTER.search(line) and inter_hit is None:
                inter_hit = (path, n)
            if FONT_OK.search(line):
                font_ok_hit = True
            for rid, sev, rx, msg, fix in RULES:
                if rx.search(line):
                    if rid == "grid-3col":
                        grid_counts.setdefault(path, []).append((n, line.strip()))
                        continue
                    findings.append(dict(file=path, line=n, rule=rid, severity=sev, message=msg, fix=fix, snippet=line.strip()[:140]))
    for path, hits in grid_counts.items():
        if len(hits) >= 2:  # a single 3-col grid is fine; repetition is the cliche
            rid, sev, _, msg, fix = next(r for r in RULES if r[0] == "grid-3col")
            for n, snip in hits:
                findings.append(dict(file=path, line=n, rule=rid, severity=sev, message=msg, fix=fix, snippet=snip[:140]))
    if inter_hit and not font_ok_hit:
        findings.append(dict(file=inter_hit[0], line=inter_hit[1], rule="inter-only", severity="medium",
                             message="Inter used with no display/mono pairing",
                             fix="Pair a display face (Instrument Serif/Fraunces/Space Grotesk) + body (Plus Jakarta/IBM Plex) + mono (JetBrains/IBM Plex Mono).",
                             snippet=""))
    return findings, errors


def main(argv=None):
    ap = argparse.ArgumentParser(description="Static anti-vibe UI audit")
    ap.add_argument("path", help="file or directory to scan")
    ap.add_argument("--fix-suggestions", action="store_true", help="print a fix for each finding")
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    ap.add_argument("--fail-on", choices=["high", "medium", "none"], default="high")
    ap.add_argument("--version", action="version", version=__version__)
    a = ap.parse_args(argv)
    if not os.path.exists(a.path):
        print(f"error: path not found: {a.path}", file=sys.stderr)
        return 2
    findings, errors = scan(a.path)
    findings.sort(key=lambda f: (-SEV[f["severity"]], f["file"], f["line"]))
    counts = Counter(f["severity"] for f in findings)
    if a.json:
        print(json.dumps(dict(version=__version__, counts=counts, findings=findings, errors=errors), indent=2))
    else:
        for f in findings:
            print(f"[{f['severity'].upper():6}] {f['file']}:{f['line']}  {f['rule']}: {f['message']}")
            if f["snippet"]:
                print(f"         > {f['snippet']}")
            if a.fix_suggestions:
                print(f"         fix: {f['fix']}")
        for e in errors:
            print(f"warn: {e}", file=sys.stderr)
        print(f"\nvibe_audit {__version__}: high={counts['high']} medium={counts['medium']} low={counts['low']}")
    if a.fail_on == "none":
        return 0
    limit = SEV[a.fail_on]
    return 1 if any(SEV[f["severity"]] >= limit for f in findings) else 0


if __name__ == "__main__":
    sys.exit(main())
