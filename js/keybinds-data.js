/* Keybind presets: the game's layout, the default and your presets (Home and Share use them on any page; the Keybinds
   page draws them). */
import { clone, data, K, ls, seedDone, seedMyKeys, setDirty } from "./base.js";

/* ---------- keybinds: presets you can read, compare and edit ---------- */
export const KB_ID = "keybinds";
// columns of sections; each action: [id, name in the game's settings, what it does]
export const KB_LAYOUT = [
  [
    ["Character Controls", [
      ["fwd", "Move Forward", "Walk forward."],
      ["back", "Retreat", "Walk backwards, slower than forwards."],
      ["left", "Move Left", "Strafe left."],
      ["right", "Move Right", "Strafe right."],
      ["crouch", "Crouch", "Crouch: quieter steps and a smaller target. Press again to stand up."],
      ["prone", "Prone", "Lie down: the steadiest aim and the hardest to spot, but slow to get up and move."],
      ["creep", "Creep", "Walk very slowly with almost silent steps. Turn it on before you close in on someone."],
      ["leanl", "Lean Left", "Peek left around cover so only part of you shows."],
      ["leanr", "Lean Right", "Peek right around cover so only part of you shows."],
      ["sprint", "Sprint", "Run. Uses stamina and makes your steps loud."],
      ["jump", "Jump", "Jump or climb over low obstacles."],
      ["interact", "Interact", "Open doors and containers, pick things up and use extracts."],
      ["ability", "Mode Exclusive Ability", "The special action of the current game mode, when that mode has one."],
      ["freecam", "Free Camera", "Look around while your body and weapon keep facing ahead."],
    ]],
    ["Moderate", [
      ["mark", "Mark", "Put a marker where you aim so your squad sees it."],
      ["teamvoice", "Team Voice Press to Talk", "Talk to your squad only."],
      ["proxvoice", "Proximity Voice Press to Talk", "Talk to anyone close to you, enemies included."],
      ["channel", "Switch Speak Channel", "Change who hears your voice."],
      ["comms", "Communication Menu", "Wheel of quick callouts for your squad."],
      ["chat", "Open Chat Window", "Type in the text chat."],
      ["chatup", "Scroll Up in Chat", "Scroll the chat back."],
      ["chatdown", "Scroll Down in Chat", "Scroll the chat forward."],
      ["bag", "Open/Close Backpack", "Open your inventory."],
      ["map", "Open/Close Map", "Open the map of the raid."],
      ["missions", "Open/Close Mission Panel", "See your missions and their steps."],
      ["tourney", "Tournament Details Panel", "Show the tournament standings while one is running."],
    ]],
  ],
  [
    ["Weapons & Equipment", [
      ["fire", "Fire", "Shoot."],
      ["aim", "Aim", "Aim down sights."],
      ["breath", "Hold Breath", "While aiming, steady the sway of your sight. Costs stamina."],
      ["reload", "Change Magazine", "Put in a fresh magazine and keep the old one."],
      ["checkmag", "Check Magazine", "See roughly how many rounds are left."],
      ["firemode", "Switch Firing Mode", "Cycle between auto, burst and single shot."],
      ["checkfire", "Check Firing Mode", "See which firing mode is on."],
      ["inspect", "Inspect Weapon", "Look over your weapon."],
      ["tactical", "Tactical Items", "Take out your throwable: grenade, smoke, stun…"],
      ["tacwheel", "Tactical Item Wheel", "Choose which throwable to take out."],
      ["throwhigh", "High Throwable", "With a throwable out: throw it overhand, far."],
      ["throwlow", "Low Throwable", "With a throwable out: toss it underhand, short."],
      ["sightstyle", "Switch Sight Style", "Swap between the sights on your gun, like scope and side red dot."],
      ["sightmag", "Switch Sight/Magnification", "Change the zoom of a variable scope."],
      ["cook", "Cook Grenade", "Pull the pin early so the grenade goes off sooner after you throw it."],
      ["zeroup", "Increase Sight Zero", "Set the sight for farther targets."],
      ["zerodown", "Reduce Sight Zero", "Set the sight for closer targets."],
      ["tacequip", "Tactical Equipment On/Off", "Turn your flashlight, laser or night vision on or off."],
      ["headgear", "Put Down/Lift Head Gear", "Flip a visor, face shield or night vision up or down."],
      ["quickreload", "Quick Reload", "Faster reload that drops the old magazine on the ground."],
      ["reloadwheel", "Reload Wheel", "Choose which magazine or ammo to load."],
    ]],
  ],
  [
    ["Quick Bars & Item Controls", [
      ["primary", "Primary Weapon", "Switch to your main gun."],
      ["secondary", "Secondary Weapon", "Switch to your second long gun."],
      ["pistol", "Pistol", "Switch to your pistol."],
      ["melee", "Melee Weapon", "Switch to your knife or melee weapon."],
      ["qk5", "Quick Key 5", "Use whatever sits in quick slot 5."],
      ["qk6", "Quick Key 6", "Use whatever sits in quick slot 6."],
      ["qk7", "Quick Key 7", "Use whatever sits in quick slot 7."],
      ["qk8", "Quick Key 8", "Use whatever sits in quick slot 8."],
      ["quickheal", "Quick Treatment", "Treat your most urgent injury without opening the inventory."],
      ["medwheel", "Medicine Wheel", "Choose which medicine to use."],
      ["discard", "Discard Backpack Items", "In the inventory: drop the item under the cursor."],
      ["quickdrop", "Quick Drop", "In the inventory: drop the item at once."],
      ["quickloot", "Quick Loot/Equip", "In the inventory: move an item straight to your bag or wear it."],
      ["checkmags", "Check Mags in Backpack", "In the inventory: check the rounds in a magazine."],
      ["rotate", "Rotate Item", "In the inventory: turn the item you are dragging."],
      ["rollup", "Roll Up Backpack/Chest Rig", "In the inventory: roll up a bag or rig so it takes less space."],
    ]],
  ],
];
export const KB_ACTIONS = KB_LAYOUT.flat().flatMap(([, rows]) => rows.map(([id, name, desc]) => ({ id, name, desc })));
export const MODE = { "": "Press", hold: "Hold", dbl: "Double", rel: "Release" };

// built-in game presets (Fandom "Controls"). Newer actions are missing there, so they stay unknown.
export const gameBase = {
  fwd: ["W", "hold"], back: ["S", "hold"], left: ["A", "hold"], right: ["D", "hold"], crouch: ["C", ""], prone: ["Z", ""], creep: ["Caps Lock", ""],
  leanl: ["Q", ""], leanr: ["E", ""], sprint: ["Left Shift", ""], jump: ["Space", ""], interact: ["F", ""], freecam: ["Middle Mouse", "hold"],
  teamvoice: ["Y", "hold"], comms: ["H", "hold"], chat: ["Enter", ""], chatup: ["Page Up", ""], chatdown: ["Page Down", ""], bag: ["Tab", ""], map: ["M", ""], missions: ["J", ""],
  fire: ["Left Mouse", "hold"], aim: ["Right Mouse", ""], breath: ["Left Alt", ""], reload: ["R", ""], checkmag: ["Alt+T", ""], firemode: ["B", ""], checkfire: ["Alt+B", ""],
  inspect: ["U", ""], tactical: ["G", ""], tacwheel: ["G", "hold"], cook: ["R", ""], sightmag: ["Alt+Right Mouse", ""], zeroup: ["Page Up", ""], zerodown: ["Page Down", ""],
  tacequip: ["T", ""], headgear: ["N", ""], primary: ["1", ""], secondary: ["2", ""], pistol: ["3", ""], melee: ["4", ""], qk5: ["5", ""], qk6: ["6", ""], qk7: ["7", ""], qk8: ["8", ""],
  quickheal: ["V", ""], medwheel: ["V", "hold"], discard: ["X", ""], quickdrop: ["X", "dbl"], quickloot: ["F", ""], checkmags: ["Middle Mouse", ""], rotate: ["R", ""], rollup: ["F", ""],
};
export const KB_GAME = [
  { id: "game-default", name: "Default", binds: gameBase },
  { id: "game-survival", name: "Survival", binds: { ...gameBase, creep: ["Caps Lock", "hold"], leanl: ["Q", "hold"], leanr: ["E", "hold"], quickheal: ["X", ""] } },
  { id: "game-tactical", name: "Tactical", binds: { ...gameBase, crouch: ["Left Ctrl", ""], sightmag: ["Alt+Z", ""], quickheal: ["C", ""] } },
];
// the maker's own setup: only his local copy starts with it (kbUserPresets); everyone else starts on the game's presets
export const KB_MINE = {
  fwd: ["W", "hold"], back: ["S", "hold"], left: ["A", "hold"], right: ["D", "hold"], crouch: ["C", ""], prone: ["Z", ""], creep: ["Caps Lock", ""],
  leanl: ["Alt+A", "hold"], leanr: ["Alt+D", "hold"], sprint: ["Left Shift", ""], jump: ["Space", ""], interact: ["F", ""], ability: ["~", ""], freecam: ["Mouse 5", "hold"],
  mark: ["Middle Mouse", ""], teamvoice: ["Mouse 4", "hold"], proxvoice: ["I", "hold"], channel: ["Alt+P", ""], comms: ["H", "hold"], chat: ["Enter", ""],
  chatup: ["Page Up", ""], chatdown: ["Page Down", ""], bag: ["Tab", ""], map: ["M", ""], missions: ["J", ""], tourney: ["~", ""],
  fire: ["Left Mouse", "hold"], aim: ["Right Mouse", ""], breath: ["Left Alt", ""], reload: ["R", ""], checkmag: ["Alt+R", ""], firemode: ["G", ""], checkfire: ["Alt+G", ""],
  inspect: ["B", ""], tactical: ["Q", ""], tacwheel: ["Q", "hold"], throwhigh: ["Left Mouse", "rel"], throwlow: ["Right Mouse", "rel"], sightstyle: ["Alt+Q", ""],
  sightmag: ["Alt+E", ""], cook: ["R", ""], zeroup: ["Wheel Up", ""], zerodown: ["Wheel Down", ""], tacequip: ["E", ""], headgear: ["Alt+1", ""],
  quickreload: ["Alt+V", ""], reloadwheel: ["Alt+V", "hold"],
  primary: ["1", ""], secondary: ["1", "dbl"], pistol: ["2", ""], melee: ["2", "dbl"], qk5: ["3", ""], qk6: ["4", ""], qk7: ["5", ""], qk8: ["6", ""],
  quickheal: ["V", ""], medwheel: ["V", "hold"], discard: ["X", ""], quickdrop: ["X", "dbl"], quickloot: ["F", ""], checkmags: ["Middle Mouse", ""], rotate: ["R", ""], rollup: ["F", ""],
};
export const K_KB = K.kbPreset;
export function kbUserPresets() {
  // everyone starts on the game's presets; the ones you make are yours (only the maker's local copy starts with his)
  if (!data.keybinds || !Array.isArray(data.keybinds.presets)) {
    data.keybinds = { presets: seedMyKeys ? [{ id: "mine", name: "My setup", binds: clone(KB_MINE) }] : [] };
    if (seedMyKeys) { seedDone(); setDirty(); }
  }
  return data.keybinds.presets;
}
export const kbAll = () => [...kbUserPresets(), ...KB_GAME];
export let kbActive = ls.get(K_KB) || "mine";
// the page picks another preset: a module can read kbActive but only this file can change it
export function setKbActive(id) { kbActive = id; ls.set(K_KB, id); }
export const kbCurrent = () => kbAll().find(p => p.id === kbActive) || kbAll()[0];
export const kbEditable = p => !KB_GAME.includes(p);

// turn a key press or click into the game's wording
export function kbLabel(e) {
  if (e.type === "wheel") return e.deltaY < 0 ? "Wheel Up" : "Wheel Down";
  if (e.type === "mousedown") return ["Left Mouse", "Middle Mouse", "Right Mouse", "Mouse 4", "Mouse 5"][e.button] || null;
  const c = e.code;
  const names = { Backquote: "~", CapsLock: "Caps Lock", ShiftLeft: "Left Shift", ShiftRight: "Right Shift", ControlLeft: "Left Ctrl", ControlRight: "Right Ctrl",
    AltLeft: "Left Alt", AltRight: "Right Alt", Space: "Space", Tab: "Tab", Enter: "Enter", Backspace: "Backspace", PageUp: "Page Up", PageDown: "Page Down", Home: "Home", End: "End",
    Insert: "Insert", Delete: "Delete", ArrowUp: "Up", ArrowDown: "Down", ArrowLeft: "Left", ArrowRight: "Right", Minus: "-", Equal: "=", BracketLeft: "[",
    BracketRight: "]", Semicolon: ";", Quote: "'", Comma: ",", Period: ".", Slash: "/", Backslash: "\\" };
  if (names[c]) return names[c];
  if (/^Key[A-Z]$/.test(c)) return c.slice(3);
  if (/^Digit\d$/.test(c)) return c.slice(5);
  if (/^Numpad\d$/.test(c)) return "Num " + c.slice(6);
  if (/^F\d{1,2}$/.test(c)) return c;
  return e.key && e.key.length === 1 ? e.key.toUpperCase() : null;
}

// how many actions a preset binds differently from the game's default (Home shows it)
export function kbChanged(p) { const def = KB_GAME[0].binds; return KB_ACTIONS.filter(a => { const x = p.binds[a.id], d = def[a.id]; return d && (!x || x[0] !== d[0] || x[1] !== d[1]); }).length; }
