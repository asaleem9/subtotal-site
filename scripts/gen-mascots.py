#!/usr/bin/env python3
"""Drive the Codex CLI's native image tool to generate the site's extra Octo poses.

Copy the app's octo-hero.png into --out first; it is the -i reference for every pose.

Usage:
  python3 -I scripts/gen-mascots.py --out <dir>            # generate missing assets
  python3 -I scripts/gen-mascots.py --out <dir> --only octo-hero
  python3 -I scripts/gen-mascots.py --out <dir> --install  # copy finished PNGs into Assets.xcassets

Each asset is generated with `codex exec`; the hero is generated first and attached (-i) to
every later prompt so the character stays consistent.
"""
import argparse, json, os, shutil, subprocess, sys, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANIFEST = os.path.join(ROOT, "design", "mascot-manifest.json")
ASSETS = os.path.join(ROOT, "design", "poses")

def png_info(path):
    with open(path, "rb") as f:
        head = f.read(33)
    if head[:8] != b"\x89PNG\r\n\x1a\n":
        return None
    w = int.from_bytes(head[16:20], "big"); h = int.from_bytes(head[20:24], "big")
    color_type = head[25]
    return w, h, color_type  # color_type 6 = RGBA, 4 = gray+alpha

def build_prompt(style, asset, ref_path):
    size = asset["size"]
    bg = ("Transparent background: request a transparent PNG from the image tool (background transparent). "
          "If the tool cannot produce transparency, generate on a flat solid #F4EFE6 background and then remove that "
          "background to true alpha with a small Python script (install Pillow into a venv in this directory if needed), "
          "keeping anti-aliased edges clean."
          if asset["transparent"] else "Opaque background exactly as described; no transparency.")
    ref = ("The attached image is the approved master drawing of Octo. Match its face, eye style, proportions, line weight "
           "and colours exactly; only the pose changes. " if ref_path else "")
    return (
        f"You are generating one illustration asset for an iOS app. Use your native image generation tool "
        f"(image_gen) — do NOT draw with code and do NOT use the browser. {ref}\n\n{style}\n\nSUBJECT: {asset['prompt']}\n\n"
        f"OUTPUT: a {size}x{size} PNG saved at ./{asset['name']}.png in the current working directory. {bg} "
        f"If the tool returns a different size, resize to exactly {size}x{size} (e.g. `sips -z {size} {size}`). "
        f"Verify the file exists and print its dimensions. Reply with DONE when the file is in place."
    )

def generate(style, asset, out_dir, ref_path, model=None, attempts=2):
    target = os.path.join(out_dir, asset["name"] + ".png")
    prompt = build_prompt(style, asset, ref_path)
    for attempt in range(1, attempts + 1):
        cmd = ["codex", "exec", "--skip-git-repo-check", "-s", "workspace-write", "-C", out_dir,
               "-o", os.path.join(out_dir, asset["name"] + ".last.txt")]
        if model: cmd += ["-m", model]
        if ref_path: cmd += ["-i", ref_path]
        cmd += ["--", prompt]  # "--" stops the variadic -i from eating the prompt
        print(f"[{asset['name']}] attempt {attempt} …", flush=True)
        t0 = time.time()
        try:
            subprocess.run(cmd, check=False, timeout=900, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
        except subprocess.TimeoutExpired:
            print(f"[{asset['name']}] timed out", flush=True)
        info = png_info(target) if os.path.exists(target) else None
        if info and info[0] == asset["size"] and info[1] == asset["size"]:
            alpha = info[2] in (4, 6)
            print(f"[{asset['name']}] ok {info[0]}x{info[1]} alpha={alpha} ({time.time()-t0:.0f}s)", flush=True)
            if asset["transparent"] and not alpha:
                print(f"[{asset['name']}] WARNING: no alpha channel", flush=True)
            return True
        print(f"[{asset['name']}] missing or wrong size: {info}", flush=True)
    return False

def install(manifest, out_dir):
    os.makedirs(ASSETS, exist_ok=True)
    for asset in manifest["assets"]:
        src = os.path.join(out_dir, asset["name"] + ".png")
        if not os.path.exists(src):
            print("skip (missing):", asset["name"]); continue
        shutil.copyfile(src, os.path.join(ASSETS, asset["name"] + ".png"))
        print("installed:", asset["name"])

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--only", action="append")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--install", action="store_true")
    ap.add_argument("--model")
    args = ap.parse_args()
    manifest = json.load(open(MANIFEST))
    os.makedirs(args.out, exist_ok=True)
    if args.install:
        install(manifest, args.out); return
    hero = os.path.join(args.out, "octo-hero.png")
    for asset in manifest["assets"]:
        if args.only and asset["name"] not in args.only: continue
        target = os.path.join(args.out, asset["name"] + ".png")
        if os.path.exists(target) and not args.force:
            print(f"[{asset['name']}] exists, skipping"); continue
        ref = hero if asset["reference"] and os.path.exists(hero) else None
        if asset["reference"] and not ref:
            print(f"[{asset['name']}] hero missing; generating without reference", flush=True)
        ok = generate(manifest["style"], asset, args.out, ref, model=args.model)
        if not ok:
            print(f"[{asset['name']}] FAILED", flush=True)
    print("done", flush=True)

if __name__ == "__main__":
    main()
