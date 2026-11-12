"""Set OBS up for ABI (python tools/obs_setup.py [prices|record|stream]). Close OBS first.

Makes, next to your own (nothing of yours is changed), and rewrites only these when run again:
  Profiles
  - "ABI Prices": recording the market to read prices. Whole screen, 30 fps, "Indistinguishable quality" on NVENC,
    hybrid MP4 into ABI Builds/videos, no mouse pointer, F9 records / F10 stops.
  - "Record": gameplay. 1080p 60 fps, "Indistinguishable quality" on NVENC, hybrid MP4 into Videos/OBS, game sound
    and mic, F9 records / F10 stops.
  - "Stream": 1080p 60 fps at 6000 kbps on NVENC (what Twitch takes; lower it to 1280x720 in Settings > Video if it
    drops frames), audio 160 kbps, F11 starts / F12 stops the stream. The service and stream key you set yourself
    in Settings > Stream.
  Scene collections
  - "ABI Prices": the screen, without the mouse pointer.
  - "Gameplay": scene "Game" (Game Capture: whatever runs full screen) and scene "Screen" (Display Capture), to switch
    to when the game capture shows black.
The word on the command line picks what OBS opens with (default: record). To go back, pick your own in OBS's
Profile and Scene Collection menus.
"""
import configparser, copy, json, os, shutil, sys, uuid

OBS = os.path.join(os.environ["APPDATA"], "obs-studio")
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # the ABI Builds folder
PRICE_VIDEOS = os.path.join(HERE, "videos")
GAME_VIDEOS = os.path.join(os.environ["USERPROFILE"], "Videos", "OBS")


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


key = lambda k: json.dumps({"bindings": [{"key": k}]})


def profile(folder, name, sections):
    d = os.path.join(OBS, "basic", "profiles", folder)
    os.makedirs(d, exist_ok=True)
    write_ini(os.path.join(d, "basic.ini"), {"General": {"Name": name}, **sections})


def source(template, sid, name, settings):
    s = copy.deepcopy(template)
    s.update({"name": name, "uuid": str(uuid.uuid4()), "id": sid, "versioned_id": sid, "settings": settings, "hotkeys": {}})
    return s


def scene(template, item_template, name, src):
    sc = copy.deepcopy(template)
    sc.update({"name": name, "uuid": str(uuid.uuid4()), "hotkeys": {"OBSBasic.SelectScene": []}})
    it = copy.deepcopy(item_template)
    it.update({"name": src["name"], "source_uuid": src["uuid"], "id": 1})
    # fit the capture to the canvas whatever its size
    it.update({"bounds_type": 2, "bounds_align": 0, "bounds": {"x": float(W), "y": float(H)}, "pos": {"x": 0.0, "y": 0.0}})
    sc["settings"] = {"id_counter": 1, "custom_size": False, "items": [it]}
    return sc


def collection(folder, name, scenes_and_sources, base):
    col = copy.deepcopy(base)
    col["name"] = name
    col["sources"] = scenes_and_sources
    names = [s["name"] for s in scenes_and_sources if s["id"] == "scene"]
    col["scene_order"] = [{"name": n} for n in names]
    col["current_scene"] = col["current_program_scene"] = names[0]
    with open(os.path.join(OBS, "basic", "scenes", folder + ".json"), "w", encoding="utf-8") as f:
        json.dump(col, f, indent=4)


def use(profile_name, profile_dir, col_name, col_file):
    user = os.path.join(OBS, "user.ini")
    if not os.path.exists(user + ".before-abi"):
        shutil.copy2(user, user + ".before-abi")
    with open(user, encoding="utf-8-sig") as f:
        lines = f.read().splitlines()
    want = {"Profile": profile_name, "ProfileDir": profile_dir, "SceneCollection": col_name, "SceneCollectionFile": col_file}
    out, inside = [], False
    for ln in lines:
        if ln.startswith("["):
            inside = ln.strip() == "[Basic]"
        elif inside and "=" in ln and ln.split("=", 1)[0] in want:
            k = ln.split("=", 1)[0]
            ln = f"{k}={want.pop(k)}"
        out.append(ln)
    if want:
        out += ["", "[Basic]"] + [f"{k}={v}" for k, v in want.items()]
    with open(user, "w", encoding="utf-8") as f:
        f.write("\n".join(out) + "\n")


if not os.path.isdir(OBS):
    sys.exit("OBS settings not found (open OBS once first).")
W, H = screen_size()
for d in (PRICE_VIDEOS, GAME_VIDEOS):
    os.makedirs(d, exist_ok=True)

# profiles
profile("ABI_Prices", "ABI Prices", {
    "Video": {"BaseCX": W, "BaseCY": H, "OutputCX": W, "OutputCY": H, "FPSType": 0, "FPSCommon": 30, "ScaleType": "lanczos"},
    "Output": {"Mode": "Simple"},
    "SimpleOutput": {"FilePath": PRICE_VIDEOS, "RecFormat2": "hybrid_mp4", "RecQuality": "HQ", "RecEncoder": "nvenc", "FileNameWithoutSpace": "true"},
    "Hotkeys": {"OBSBasic.StartRecording": key("OBS_KEY_F9"), "OBSBasic.StopRecording": key("OBS_KEY_F10")},
})
profile("Record", "Record", {
    "Video": {"BaseCX": W, "BaseCY": H, "OutputCX": 1920, "OutputCY": 1080, "FPSType": 0, "FPSCommon": 60, "ScaleType": "lanczos"},
    "Output": {"Mode": "Simple"},
    "SimpleOutput": {"FilePath": GAME_VIDEOS, "RecFormat2": "hybrid_mp4", "RecQuality": "HQ", "RecEncoder": "nvenc",
                     "FileNameWithoutSpace": "true"},
    "Audio": {"SampleRate": 48000, "ChannelSetup": "Stereo"},
    "Hotkeys": {"OBSBasic.StartRecording": key("OBS_KEY_F9"), "OBSBasic.StopRecording": key("OBS_KEY_F10")},
})
profile("Stream", "Stream", {
    "Video": {"BaseCX": W, "BaseCY": H, "OutputCX": 1920, "OutputCY": 1080, "FPSType": 0, "FPSCommon": 60, "ScaleType": "lanczos"},
    "Output": {"Mode": "Simple"},
    "SimpleOutput": {"VBitrate": 6000, "StreamEncoder": "nvenc", "ABitrate": 160, "Preset": "veryfast",
                     "FilePath": GAME_VIDEOS, "RecFormat2": "hybrid_mp4", "RecQuality": "Stream", "FileNameWithoutSpace": "true"},
    "Audio": {"SampleRate": 48000, "ChannelSetup": "Stereo"},
    "Hotkeys": {"OBSBasic.StartStreaming": key("OBS_KEY_F11"), "OBSBasic.StopStreaming": key("OBS_KEY_F12")},
})

# scene collections, built from your own (its audio devices, the screen it captures)
with open(os.path.join(OBS, "basic", "scenes", "Untitled.json"), encoding="utf-8") as f:
    base = json.load(f)
disp = next(s for s in base["sources"] if s["id"] == "monitor_capture")
sc_t = next(s for s in base["sources"] if s["id"] == "scene")
item_t = sc_t["settings"]["items"][0]

screen_nc = source(disp, "monitor_capture", "Screen (no pointer)", {**disp["settings"], "capture_cursor": False})
collection("ABI_Prices", "ABI Prices", [screen_nc, scene(sc_t, item_t, "Market", screen_nc)], base)

game = source(disp, "game_capture", "Game Capture", {"capture_mode": "any_fullscreen", "capture_cursor": False, "allow_transparency": False, "limit_framerate": False, "anti_cheat_hook": True})
screen = source(disp, "monitor_capture", "Display Capture", {**disp["settings"], "capture_cursor": True})
collection("Gameplay", "Gameplay", [game, screen, scene(sc_t, item_t, "Game", game), scene(sc_t, item_t, "Screen", screen)], base)

pick = (sys.argv[1] if len(sys.argv) > 1 else "record").lower()
if pick == "prices":
    use("ABI Prices", "ABI_Prices", "ABI Prices", "ABI_Prices.json")
elif pick == "stream":
    use("Stream", "Stream", "Gameplay", "Gameplay.json")
else:
    use("Record", "Record", "Gameplay", "Gameplay.json")
print(f"Done ({W}x{H}). OBS opens with: {pick}. Gameplay recordings go to {GAME_VIDEOS}, market videos to {PRICE_VIDEOS}.")
