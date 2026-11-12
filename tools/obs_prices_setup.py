"""Set OBS up to record the in-game market for reading prices (python tools/obs_prices_setup.py).

Makes a profile and a scene collection called "ABI Prices", next to your own (nothing of yours is changed),
and makes them the ones OBS opens with. Close OBS first. Run it again any time; it rewrites only these.

- Records the whole screen at its own size, 30 fps, "Indistinguishable quality" on the NVIDIA encoder
  (sharp digits, files that stay reasonable), as hybrid MP4 (safe if OBS crashes), into ABI Builds/videos.
- The mouse pointer is left out of the picture, so it never covers a price.
- F9 starts recording, F10 stops it, so you never leave the game.
To go back: Profile > Untitled and Scene Collection > Untitled in OBS's menu.
"""
import configparser, copy, json, os, shutil, sys, uuid

OBS = os.path.join(os.environ["APPDATA"], "obs-studio")
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # the ABI Builds folder
VIDEOS = os.path.join(HERE, "videos")
NAME, DIR = "ABI Prices", "ABI_Prices"


def screen_size():
    try:
        import ctypes
        ctypes.windll.user32.SetProcessDPIAware()
        return ctypes.windll.user32.GetSystemMetrics(0), ctypes.windll.user32.GetSystemMetrics(1)
    except Exception:
        return 1920, 1080


def write_ini(path, sections):
    cp = configparser.ConfigParser(interpolation=None)
    cp.optionxform = str  # OBS keys are case-sensitive
    for s, kv in sections.items():
        cp[s] = {k: str(v) for k, v in kv.items()}
    with open(path, "w", encoding="utf-8") as f:
        cp.write(f, space_around_delimiters=False)


def main():
    if not os.path.isdir(OBS):
        sys.exit("OBS settings not found (open OBS once first).")
    os.makedirs(VIDEOS, exist_ok=True)
    w, h = screen_size()

    # the profile: video size, recording quality, place, hotkeys
    prof = os.path.join(OBS, "basic", "profiles", DIR)
    os.makedirs(prof, exist_ok=True)
    key = lambda k: json.dumps({"bindings": [{"key": k}]})
    write_ini(os.path.join(prof, "basic.ini"), {
        "General": {"Name": NAME},
        "Video": {"BaseCX": w, "BaseCY": h, "OutputCX": w, "OutputCY": h, "FPSType": 0, "FPSCommon": 30, "ScaleType": "lanczos"},
        "Output": {"Mode": "Simple"},
        "SimpleOutput": {"FilePath": VIDEOS, "RecFormat2": "hybrid_mp4", "RecQuality": "HQ", "RecEncoder": "nvenc",
                         "FileNameWithoutSpace": "true"},
        "Hotkeys": {"OBSBasic.StartRecording": key("OBS_KEY_F9"), "OBSBasic.StopRecording": key("OBS_KEY_F10")},
    })

    # the scenes: a copy of yours (the screen capture), without the mouse pointer
    scenes = os.path.join(OBS, "basic", "scenes")
    src = os.path.join(scenes, "Untitled.json")
    with open(src, encoding="utf-8") as f:
        col = json.load(f)
    col = copy.deepcopy(col)
    col["name"] = NAME
    for s in col.get("sources", []):
        if s.get("id") == "monitor_capture":
            s["settings"]["capture_cursor"] = False
    # fresh ids, so OBS never mixes the two collections up
    ids = {}
    for s in col.get("sources", []):
        ids[s["uuid"]] = s["uuid"] = str(uuid.uuid4())
    for s in col.get("sources", []):
        for it in s.get("settings", {}).get("items", []):
            if it.get("source_uuid") in ids:
                it["source_uuid"] = ids[it["source_uuid"]]
    with open(os.path.join(scenes, DIR + ".json"), "w", encoding="utf-8") as f:
        json.dump(col, f, indent=4)

    # OBS opens with them (your user.ini is backed up once, next to it)
    user = os.path.join(OBS, "user.ini")
    if not os.path.exists(user + ".before-abi"):
        shutil.copy2(user, user + ".before-abi")
    with open(user, encoding="utf-8-sig") as f:
        lines = f.read().splitlines()
    want = {"Profile": NAME, "ProfileDir": DIR, "SceneCollection": NAME, "SceneCollectionFile": DIR + ".json"}
    out, inside = [], False
    for ln in lines:
        if ln.startswith("["):
            inside = ln.strip() == "[Basic]"
        elif inside and "=" in ln and ln.split("=", 1)[0] in want:
            k = ln.split("=", 1)[0]
            ln = f"{k}={want.pop(k)}"
        out.append(ln)
    if want:  # no [Basic] section yet
        out += ["", "[Basic]"] + [f"{k}={v}" for k, v in want.items()]
    with open(user, "w", encoding="utf-8") as f:
        f.write("\n".join(out) + "\n")

    print(f"Done: profile and scenes '{NAME}', {w}x{h} at 30 fps, recordings in {VIDEOS}")


if __name__ == "__main__":
    main()
