/* Gear and weapons as data: the gear catalogue (ABI Builder), skrux's data sheet, weapon stats, gear stats and maths. */
import { el, icon } from "./base.js";
import { CONDS, latest, marketItemFor } from "./market-data.js";

/* ---------- gear catalogue (ABI Builder game database, S7): [name, tier, picture, short stats] ---------- */
export const CAT_IMG = "https://abibuilder.com/wiki-assets/gear/";
export const CATALOG = {
  helmet: [
    ["03 Heavy Tactical Helmet", 5, "helmets/03_heavy_tactical_helmet.webp", "Composite · 45 durability · -1% speed"],
    ["56K Helicopter Helmet", 4, "helmets/56k_helicopter_helmet.webp", "Aramid · 50 durability · -6% speed"],
    ["6B4 Helmet", 3, "helmets/6b4_helmet.webp", "Aramid · 30 durability · -3% speed"],
    ["6B4 Helmet Squad Camo", 3, "helmets/6b4_helmet_squad_camo.webp", "Aramid · 30 durability · -3% speed"],
    ["IND Tactical Helmet (Snow)", 4, "helmets/ind_tactical_helmet_snow.webp", "Composite · 35 durability · 0% speed"],
    ["6B5 Helmet", 3, "helmets/6b5_helmet.webp", "Polyethylene · 35 durability · -4% speed"],
    ["6BNT Helmet", 6, "helmets/6bnt_helmet.webp", "Hardened Steel · 75 durability · -4% speed"],
    ["AN95 Heavy Blast Helmet", 5, "helmets/an95_heavy_blast_helmet.webp", "Titanium · 55 durability · -5% speed"],
    ["AS200 Heavy Tactical Helmet", 6, "helmets/as200_heavy_tactical_helmet.webp", "Polyethylene · 65 durability · -7% speed"],
    ["Aviator Helmet", 2, "helmets/aviator_helmet.webp", "Polyethylene · 20 durability · 0% speed"],
    ["DOD9 Blast Helmet", 6, "helmets/dod9_blast_helmet.webp", "Composite · 75 durability · -8% speed"],
    ["F70 Tactical Helmet", 3, "helmets/f70_tactical_helmet.webp", "Composite · 25 durability · -1% speed"],
    ["F80 Tactical Helmet", 4, "helmets/f80_tactical_helmet.webp", "Aluminum · 35 durability · -1% speed"],
    ["FA Assault Tactical Helmet", 5, "helmets/fa_assault_tactical_helmet.webp", "Composite · 50 durability · -1% speed"],
    ["HG84 Offensive Helmet", 6, "helmets/hg84_offensive_helmet.webp", "Composite · 70 durability · -4% speed"],
    ["IND Tactical Helmet", 4, "helmets/ind_tactical_helmet.webp", "Composite · 35 durability · -1% speed"],
    ["IND200 Helmet", 4, "helmets/ind200_helmet.webp", "Composite · 40 durability · -1% speed"],
    ["IND50 Heavy Tactical Helmet", 6, "helmets/ind50_heavy_tactical_helmet.webp", "Composite · 60 durability · -1% speed"],
    ["IND70 Tactical Helmet", 6, "helmets/ind70_tactical_helmet.webp", "Polyethylene · 80 durability · -10% speed"],
    ["Kelsey Fire Helmet", 1, "helmets/kelsey_fire_helmet.webp", "Aramid · 10 durability · 0% speed"],
    ["KSS Tactical Helmet", 4, "helmets/kss_tactical_helmet.webp", "Aluminum · 40 durability · -1% speed"],
    ["KSS2 Tactical Helmet", 4, "helmets/kss2_tactical_helmet.webp", "Composite · 45 durability · -3% speed"],
    ["Lightweight Safety Helmet", 1, "helmets/lightweight_safety_helmet.webp", "Aramid · 15 durability · 0% speed"],
    ["Motorcycle Helmet", 1, "helmets/motorcycle_helmet.webp", "Aramid · 15 durability · 0% speed"],
    ["PAS Standard Helmet", 2, "helmets/pas_standard_helmet.webp", "Aramid · 25 durability · 0% speed"],
    ["PAS2 Helmet", 3, "helmets/pas2_helmet.webp", "Hardened Steel · 28 durability · -1% speed"],
    ["Retro Military Helmet", 2, "helmets/retro_military_helmet.webp", "Hardened Steel · 20 durability · 0% speed"],
    ["Retro Steel Helmet", 2, "helmets/retro_steel_helmet.webp", "Hardened Steel · 25 durability · 0% speed"],
    ["RSP Heavy Tactical Helmet", 5, "helmets/rsp_heavy_tactical_helmet.webp", "Composite · 55 durability · -4% speed"],
    ["RST Special Forces Helmet", 6, "helmets/rst_special_forces_helmet.webp", "Aluminum · 75 durability · -6% speed"],
    ["Security Helmet", 2, "helmets/security_helmet.webp", "Polyethylene · 20 durability · 0% speed"],
    ["Security Riot Helmet", 2, "helmets/security_riot_helmet.webp", "Polyethylene · 22 durability · 0% speed"],
    ["SH Matzka 2 Helmet", 5, "helmets/sh_matzka_2_helmet.webp", "Hardened Steel · 65 durability · -4% speed"],
    ["SH12 Military Helmet", 3, "helmets/sh12_military_helmet.webp", "Hardened Steel · 30 durability · -2% speed"],
    ["SH18 Military Helmet", 4, "helmets/sh18_military_helmet.webp", "Titanium · 45 durability · -4% speed"],
    ["SH40 Military Helmet", 4, "helmets/sh40_military_helmet.webp", "Hardened Steel · 50 durability · -3% speed"],
    ["SH50 Military Helmet", 5, "helmets/sh50_military_helmet.webp", "Hardened Steel · 60 durability · -4% speed"],
    ["SH60 Military Helmet", 5, "helmets/sh60_military_helmet.webp", "Composite · 50 durability · -3% speed"],
    ["SH65 Military Helmet", 6, "helmets/sh65_military_helmet.webp", "Composite · 65 durability · -4% speed"],
    ["Tanker Protective Cap", 1, "helmets/tanker_protective_cap.webp", "Aramid · 20 durability · 0% speed"],
  ],
  armor: [
    ["220 Body Armor", 2, "body_armor/220_body_armor.webp", "Aramid · 30 durability · -1% speed"],
    ["6B13 Body Armor", 4, "body_armor/6b13_body_armor.webp", "Composite · 65 durability · -5% speed"],
    ["6B23 Body Armor", 4, "body_armor/6b23_body_armor.webp", "Hardened Steel · 70 durability · -9% speed"],
    ["6B45 Heavy Body Armor", 6, "body_armor/6b45_heavy_body_armor.webp", "Hardened Steel · 120 durability · -18% speed"],
    ["926 Composite Body Armor", 5, "body_armor/926_composite_body_armor.webp", "Composite · 70 durability · -4% speed"],
    ["BT101 Tactical Body Armor", 6, "body_armor/bt101_tactical_body_armor.webp", "Ceramic · 100 durability · -4% speed"],
    ["BT201 Full Body Armor", 6, "body_armor/bt201_full_body_armor.webp", "Aluminum · 125 durability · -18% speed"],
    ["BT6 Heavy Body Armor", 5, "body_armor/bt6_heavy_body_armor.webp", "Titanium · 90 durability · -6% speed"],
    ["Defender M4 Heavy Armor (Officer Skin)", 5, "body_armor/defender_m4_heavy_armor_officer_skin.webp", "Hardened Steel · 80 durability · -10% speed"],
    ["Defender M4 Heavy Body Armor", 5, "body_armor/defender_m4_heavy_body_armor.webp", "Hardened Steel · 80 durability · -11% speed"],
    ["H-LC Lightweight Body Armor", 3, "body_armor/h-lc_lightweight_body_armor.webp", "Composite · 55 durability · -3% speed"],
    ["H-LC Tactical Body Armor", 5, "body_armor/h-lc_tactical_body_armor.webp", "Composite · 70 durability · -5% speed"],
    ["H-Tac SWAT Body Armor", 3, "body_armor/h-tac_swat_body_armor.webp", "Polyethylene · 35 durability · -2% speed"],
    ["IMTV Samurai Assault Body Armor", 5, "body_armor/imtv_samurai_assault_body_armor.webp", "Aluminum · 80 durability · -10% speed"],
    ["IMTV Samurai Full Protection Body Armor", 5, "body_armor/imtv_samurai_full_protection_body_armor.webp", "Aluminum · 90 durability · -14% speed"],
    ["IMTV Samurai Standard Body Armor", 5, "body_armor/imtv_samurai_standard_body_armor.webp", "Aluminum · 70 durability · -9% speed"],
    ["IND401 Body Armor", 4, "body_armor/ind401_body_armor.webp", "Aluminum · 55 durability · -4% speed"],
    ["KN Assault Body Armor", 3, "body_armor/kn_assault_body_armor.webp", "Titanium · 50 durability · -6% speed"],
    ["KN Composite Body Armor", 6, "body_armor/kn_composite_body_armor.webp", "Composite · 110 durability · -7% speed"],
    ["KN Regulation Body Armor", 3, "body_armor/kn_regulation_body_armor.webp", "Aramid · 35 durability · -1% speed"],
    ["Marshal Heavy Body Armor", 6, "body_armor/marshal_heavy_body_armor.webp", "Ceramic · 115 durability · -12% speed"],
    ["Old Security Body Armor", 1, "body_armor/old_security_body_armor.webp", "Aramid · 25 durability · 0% speed"],
    ["PCA350 Body Armor", 3, "body_armor/pca350_body_armor.webp", "Aluminum · 50 durability · -3% speed"],
    ["Retro Bulletproof Vest", 1, "body_armor/retro_bulletproof_vest.webp", "Aramid · 20 durability · 0% speed"],
    ["Retro Infantry Bulletproof Vest", 2, "body_armor/retro_infantry_bulletproof_vest.webp", "Aluminum · 30 durability · -1% speed"],
    ["Retro Sapper Bulletproof Chest Armor", 1, "body_armor/retro_sapper_bulletproof_chest_armor.webp", "Hardened Steel · 25 durability · -1% speed"],
    ["Security Body Armor", 2, "body_armor/security_body_armor.webp", "Aramid · 25 durability · -1% speed"],
    ["SEK Fortress Body Armor", 4, "body_armor/sek_fortress_body_armor.webp", "Aluminum · 50 durability · -3% speed"],
    ["Spartan B Body Armor", 4, "body_armor/spartan_b_body_armor.webp", "Aramid · 50 durability · -4% speed"],
    ["Standard SWAT Armor", 3, "body_armor/standard_swat_armor.webp", "Aramid · 45 durability · -3% speed"],
  ],
  arig: [
    ["6B5 Armored Rig", 3, "armored_rigs/6b5_armored_rig.webp", "Ceramic · 35 durability · 12 slots · -3% speed"],
    ["926 Security Armored Chest Rig", 3, "armored_rigs/926_security_armored_chest_rig.webp", "Aramid · 25 durability · 10 slots · -2% speed"],
    ["AL Assault Armored Rig", 6, "armored_rigs/al_assault_armored_rig.webp", "Composite · 90 durability · 18 slots · -8% speed"],
    ["AL Commander Armored Rig", 6, "armored_rigs/al_commander_armored_rig.webp", "Hardened Steel · 100 durability · 20 slots · -7% speed"],
    ["AL Tactical Armored Rig", 6, "armored_rigs/al_tactical_armored_rig.webp", "Ceramic · 95 durability · 18 slots · -6% speed"],
    ["AVS Heavy Armored Rig", 6, "armored_rigs/avs_heavy_armored_rig.webp", "Ceramic · 90 durability · 20 slots · -10% speed"],
    ["Defender M4 Heavy Armored Rig", 5, "armored_rigs/defender_m4_heavy_armored_rig.webp", "Hardened Steel · 100 durability · 20 slots · -10% speed"],
    ["H-Tac A8 Armored Rig", 5, "armored_rigs/h-tac_a8_armored_rig.webp", "Composite · 60 durability · 18 slots · -4% speed"],
    ["H-Tac A9 Armored Rig", 5, "armored_rigs/h-tac_a9_armored_rig.webp", "Ceramic · 65 durability · 20 slots · -8% speed"],
    ["M1955 Combat Vest", 2, "armored_rigs/m1955_combat_vest.webp", "Aramid · 20 durability · 8 slots · -1% speed"],
    ["Sentry 3 Armored Chest Rig", 3, "armored_rigs/sentry_3_armored_chest_rig.webp", "Polyethylene · 30 durability · 10 slots · -2% speed"],
    ["Sentry 305 Armored Chest Rig", 4, "armored_rigs/sentry_305_armored_chest_rig.webp", "Composite · 50 durability · 16 slots · -3% speed"],
    ["Spartan C Heavy Armored Rig", 6, "armored_rigs/spartan_c_heavy_armored_rig.webp", "Hardened Steel · 100 durability · 23 slots · -18% speed"],
    ["TM1 Armored Rig", 4, "armored_rigs/tm1_armored_rig.webp", "Titanium · 40 durability · 14 slots · -5% speed"],
    ["TM2 Armored Rig", 4, "armored_rigs/tm2_armored_rig.webp", "Aluminum · 45 durability · 16 slots · -4% speed"],
    ["Warrior Heavy Armored Chest Rig", 5, "armored_rigs/warrior_heavy_armored_chest_rig.webp", "Composite · 55 durability · 16 slots · -6% speed"],
  ],
  rig: [
    ["926 Hunter Vest", 0, "chest_rigs/926_hunter_vest.webp", "14 slots · 3 × 4 · 1.5 kg"],
    ["926 Lightweight Chest Rig", 0, "chest_rigs/926_lightweight_chest_rig.webp", "8 slots · 3 × 2 · 0.6 kg"],
    ["926 Premium Field Chest Rig", 0, "chest_rigs/926_premium_field_chest_rig.webp", "24 slots · 4 × 4 · 2 kg"],
    ["ALS Carry Rig", 0, "chest_rigs/als_carry_rig.webp", "6 slots · 2 × 3 · 0.8 kg"],
    ["B3 Universal Chest Rig", 0, "chest_rigs/b3_universal_chest_rig.webp", "16 slots · 3 × 4 · 1.5 kg"],
    ["B4 Tactical Chest Rig", 0, "chest_rigs/b4_tactical_chest_rig.webp", "15 slots · 3 × 4 · 1.7 kg"],
    ["B6 Tactical Chest Rig", 0, "chest_rigs/b6_tactical_chest_rig.webp", "20 slots · 3 × 4 · 1.8 kg"],
    ["BH Infantry Chest Rig", 0, "chest_rigs/bh_infantry_chest_rig.webp", "10 slots · 3 × 3 · 1 kg"],
    ["BH2 Chest Rig", 0, "chest_rigs/bh2_chest_rig.webp", "12 slots · 3 × 3 · 0.9 kg"],
    ["FA Commander Chest Rig", 0, "chest_rigs/fa_commander_chest_rig.webp", "20 slots · 3 × 4 · 1.9 kg"],
    ["FA Multipurpose Chest Rig", 0, "chest_rigs/fa_multipurpose_chest_rig.webp", "18 slots · 3 × 4 · 1.6 kg"],
    ["Hunting Vest", 0, "chest_rigs/hunting_vest.webp", "6 slots · 2 × 3 · 0.4 kg"],
    ["Leather Biker Vest", 0, "chest_rigs/leather_biker_vest.webp", "10 slots · 3 × 3 · 0.9 kg"],
    ["Punk Motorcycle Vest", 0, "chest_rigs/punk_motorcycle_vest.webp", "8 slots · 2 × 3 · 0.8 kg"],
    ["RAP Simple Chest Rig", 0, "chest_rigs/rap_simple_chest_rig.webp", "14 slots · 3 × 3 · 1.3 kg"],
    ["Service Tactical Vest", 0, "chest_rigs/service_tactical_vest.webp", "12 slots · 4 × 3 · 0.7 kg"],
    ["Stormtrooper Type 2 Chest Rig", 0, "chest_rigs/stormtrooper_type_2_chest_rig.webp", "12 slots · 4 × 3 · 1.4 kg"],
    ["Stormtrooper Type 3 Tactical Chest Rig", 0, "chest_rigs/stormtrooper_type_3_tactical_chest_rig.webp", "20 slots · 4 × 4 · 1.9 kg"],
    ["Stormtrooper Type 4 Tactical Chest Rig", 0, "chest_rigs/stormtrooper_type_4_tactical_chest_rig.webp", "22 slots · 4 × 4 · 1.8 kg"],
  ],
  pack: [
    ["926 Field Backpack", 0, "backpacks/926-field-backpack.webp", "40 slots · 5 × 8 · 1.75 kg"],
    ["Amp7 Assault Backpack", 0, "backpacks/Amp7-assault-backpack.webp", "32 slots · 5 × 6 · 1.6 kg"],
    ["Canvas Backpack", 0, "backpacks/Canvas-backpack.webp", "9 slots · 3 × 3 · 0.7 kg"],
    ["Canvas Camping Backpack", 0, "backpacks/Canvas-camping-backpack.webp", "20 slots · 4 × 5 · 0.75 kg"],
    ["Chapman Military Backpack", 0, "backpacks/Chapman-military-backpack.webp", "30 slots · 5 × 6 · 1.3 kg"],
    ["Cowhide Backpack", 0, "backpacks/Cowhide-backpack.webp", "25 slots + 5 bonus · 4 × 5 · 1.5 kg"],
    ["Field Camping Backpack", 0, "backpacks/Field-camping-backpack.webp", "45 slots · 5 × 9 · 1.9 kg"],
    ["Large Camping Backpack", 0, "backpacks/Large-camping-backpack.webp", "28 slots · 4 × 7 · 1.75 kg"],
    ["Lightweight Camping Backpack", 0, "backpacks/Lightweight-camping-backpack.webp", "12 slots · 3 × 4 · 0.9 kg"],
    ["Luc Expanded Tactical Backpack", 0, "backpacks/Luc-expanded-tactical-backpack.webp", "45 slots · 5 × 9 · 2 kg"],
    ["Med Field Backpack", 0, "backpacks/Med-field-backpack.webp", "28 slots · 4 × 7 · 1.15 kg"],
    ["Medium Camping Backpack", 0, "backpacks/Medium-bamping-backpack.webp", "16 slots · 4 × 4 · 0.7 kg"],
    ["Outdoor Travel Backpack", 0, "backpacks/outdoor-travel-backpack.webp", "24 slots · 4 × 6 · 1.1 kg"],
    ["Ral Heavy Military Backpack", 0, "backpacks/Ral-heavy-military-backpack.webp", "50 slots · 5 × 9 · 1.4 kg"],
    ["Retro Marching Backpack", 0, "backpacks/Retro-marching-backpack.webp", "36 slots · 5 × 5 · 1 kg"],
    ["Rush Tactical Backpack", 0, "backpacks/Rush-tactical-backpack.webp", "24 slots + 4 bonus · 4 × 5 · 1.2 kg"],
    ["Simple Backpack", 0, "backpacks/simple-backpack.webp", "8 slots · 2 × 4 · 0.8 kg"],
    ["Sling Bag", 0, "backpacks/sling-bag.webp", "6 slots · 2 × 3 · 0.6 kg"],
    ["Sports Backpack", 0, "backpacks/sports-backpack.webp", "20 slots · 4 × 5 · 0.8 kg"],
    ["Xa4 Tactical Backpack", 0, "backpacks/xa4-tactical-backpack.webp", "32 slots · 5 × 6 · 1.45 kg"],
  ],
  headset: [
    ["Com1 Tactical Headset", 0, "headsets/Com1_Tactical_Headset.webp", "Sound pickup Bad · Noise reduction Bad"],
    ["Commander A Tactical Headset", 0, "headsets/Commander_A_Tactical_Headset.webp", "Sound pickup Medium · Noise reduction Strong"],
    ["GS2 Tactical Headset", 0, "headsets/GS2_Tactical_headset.webp", "Sound pickup Strong · Noise reduction Medium"],
    ["M32 Tactical Headset", 0, "headsets/M32_Tactical_Headset.webp", "Sound pickup Medium · Noise reduction Bad"],
    ["Z038 Tactical Headset", 0, "headsets/Z038_Tactical_Headset.webp", "Sound pickup Medium · Noise reduction Medium"],
  ],
};
export const CAT_BY_NAME = {};
Object.entries(CATALOG).forEach(([kind, list]) => list.forEach(([n, t, img, sub]) => { CAT_BY_NAME[n] = { name: n, kind, tier: t, img: CAT_IMG + img, sub }; }));

// ammo by calibre family (skrux's AMMO VS ARMOR sheet), and which family each weapon uses
export const AMMO_FAMILIES = {
  "5.56": ["M855 (T3)", "M855A1 (T4)", "M995 (T5)"],
  "5.45": ["PP (T3)", "BP (T4)", "BS (T5)"],
  "7.62x39": ["PS (T3)", "BP (T4)", "AP (T5)"],
  "7.62x51": ["BPZ (T3)", "M80 (T4)", "M62 (T5)", "M61 (T6)"],
  "5.7": ["L191 (T3)", "SS190 (T4)", "SS198 (T5)"],
  "5.8": ["DBP87 (T3)", "DVP88 (T4)", "DVC12 (T5)"],
  "9x19": ["AP6.3 (T3)", "7N31 (T4)", "Dum-Dum (Leg meta)"],
  ".45": ["AP (T3)"],
  "9x39": ["SP5 (T3)", "SP6 (T4)", "7N9 (T4)", "7N12 (T5)"],
  "7.62x54": ["T46M (T3)", "LPS (T4)", "7BT1 (T5)"],
  ".338": ["UPZ (T4)", "FMJ (T5)"],
  "12x70": ["Type 7 Buckshot (T1)", "Dual Shell (T1)", "Led Slug (T1)", "Grizzly Slug (T1)", "GT Slug (T2)", "Flechette (T3)", "Armor-Piercing Slug (T3)"],
};
// round pictures: ABI Builder's ammo database, Fandom for the few it lacks
export const AMMO_IMG = (() => {
  const ab = "https://abibuilder.com/wiki-assets/ammo/", fd = "https://static.wikia.nocookie.net/arena-breakout-infinite/images/";
  const pre = { "5.56": "5_56x45mm", "5.45": "5_45x39mm", "7.62x39": "7_62x39mm", "7.62x51": "7_62x51mm", "5.7": "5_7x28mm", "5.8": "5_8x42mm", "9x19": "9x19mm", "9x39": "9x39mm", "7.62x54": "7_62x54mm" };
  const out = {};
  Object.entries(AMMO_FAMILIES).forEach(([cal, list]) => list.forEach(a => {
    const n = a.replace(/\s*\(.*\)\s*$/, "");
    if (pre[cal]) out[cal + "|" + n] = ab + pre[cal] + "_" + n.toLowerCase().replace(/\./g, "_").replace("dum-dum", "dumdum") + ".webp";
  }));
  out[".45|AP"] = fd + "5/5e/.45_AP.png/revision/latest/scale-to-width-down/96";
  out[".338|UPZ"] = fd + "5/52/.338_UPZ.png/revision/latest/scale-to-width-down/96";
  out[".338|FMJ"] = fd + "a/a7/.338_FMJ.png/revision/latest/scale-to-width-down/96";
  return out;
})();
export const GUN_CALIBRE = {};
[["5.56", "M4A1 H416 MDR AK-102 F2000 SCAR-L Mini14 M16 MCX AUG SG550 FAMAS"],
 ["5.45", "AK-74N AKS-74U RPK-16 AK12 AN-94 A545"],
 ["7.62x39", "AKM ACE31 AEK SA85M SKS ZC807 AK15SC"],
 ["7.62x51", "FAL M110 M24 M14 BM59 Mk14 G3"],
 ["5.7", "AR-57 P90 F57 Banshee"],
 ["5.8", "T951 T03 T191 T192 U191 T88"],
 ["12x70", "M870 MP-133 S12K USAS-12"],
 ["9x19", "MP5 MPX Uzi Vector 9 PCC-9 PP19"],
 [".45", "UMP45 MAC-10 Vector 45"],
 ["9x39", "VSS AMB-17"],
 ["7.62x54", "SVDS Mosin SVTU"],
 [".338", "SJ16"]].forEach(([cal, guns]) => guns.replace("Vector 9", "Vector_9").replace("Vector 45", "Vector_45").split(" ").forEach(g => { GUN_CALIBRE[g.replace("_", " ")] = cal; }));

/* ---------- gear tab (data from skrux's data sheet) ---------- */
export const GEAR_SRC = "https://docs.google.com/spreadsheets/d/1jDp7NFIg_mc8NA0oYrVsFkg56-OqVG8LLaJfduk7AmQ/edit";
// [helmet + armor, pro, con]
export const COMBOS = [
  ["Speed", "Light and fast", [
    ["Retro Steel", "KN Regular", "Loot runner", "T3 armor"],
    ["KSS Tact", "SEK Fortress", "T4 face mask", "Low ricochet chance"],
    ["FA Assault / 03 Heavy", "926 Comp", "T5 at max speed", "No face mask"],
    ["IND50", "BT101", "T6 at max speed", "T4 face mask"],
  ]],
  ["Tank", "Most protection", [
    ["SH40 / 56K Heli", "6B13", "Full T4", "-8% speed, low sound blocking"],
    ["KSS Tact", "SEK Fortress", "Full T4 and speed", "Medium ricochet, covers few areas"],
    ["SH Matzka", "Samurai Full", "Full T5", "Very slow (-18%)"],
    ["IND70", "BT201", "Full T6", "Slow (-28%) and expensive"],
  ]],
  ["skrux's picks", "What skrux runs", [
    ["KSS Tact", "SEK Fortress", "Full T4 protection"],
    ["03 Heavy", "926 Comp", "Good T5 with a T4 face mask"],
    ["SH Matzka", "926 Comp", "Full T5 protection, turtle"],
    ["AS200", "BT101", "Good T6, cheap helmet"],
  ]],
];
// name, durability, ergo, speed %, material, ricochet, sound blocking, face mask, headset
export const HELMETS = [
  ["Retro Steel", 25, 0, 0, "Hardened Steel", "High", "None", "None", ""],
  ["F80", 35, 0, -1, "Aluminum", "High", "None", "None", "Yes"],
  ["IND Tact", 35, 0, -1, "Composite", "Medium", "None", "T3 (DK6)", "Yes"],
  ["SH40", 50, -4, -3, "Hardened Steel", "High", "Moderate", "T4 (SH40)", "No"],
  ["IND200", 40, 0, -1, "Composite", "Low", "None", "T3 (DK6)", "Yes"],
  ["SH18", 45, -2, -4, "Titanium", "High", "Low", "None", "No"],
  ["KSS Tact", 40, 0, -1, "Aluminum", "Medium", "None", "T4 (DK8)", "Yes"],
  ["KSS2 Tact", 45, 0, -3, "Composite", "Low", "None", "T4 (DK8)", "Yes"],
  ["56K Heli", 50, -5, -6, "Aramid", "Low", "None", "T4", "Bad"],
  ["FA Assault", 50, -2, -1, "Composite", "Medium", "None", "None", "Yes"],
  ["03 Heavy", 45, 0, -1, "Composite", "Medium", "None", "T4 (DK8)", "Yes"],
  ["RSP Heavy", 55, -2, -4, "Composite", "Low", "Low", "T4 (DK8)", "No"],
  ["SH50", 60, -7, -4, "Hardened Steel", "High", "Low", "T3 (SH UNI)", "No"],
  ["SH Matzka", 65, -10, -4, "Hardened Steel", "High", "Severe", "T5", "No"],
  ["SH 60", 50, -9, -3, "Composite", "Medium", "Low", "T4 (SH 60)", "Yes"],
  ["AN95", 55, -5, -5, "Titanium", "Medium", "None", "T4 (AN95)", "Commander only"],
  ["6BNT", 75, -9, -4, "Hardened Steel", "High", "Severe", "T6 (6BNT)", "No"],
  ["IND50", 60, 0, -1, "Composite", "Medium", "None", "T4 (DK8)", "Yes"],
  ["SH65 MIL", 65, -7, -4, "Composite", "High", "Low", "T6 (SH65)", "No"],
  ["RST Spec", 75, -10, -6, "Aluminum", "High", "Moderate", "T6 (RST)", "No"],
  ["HG84", 70, -3, -4, "Composite", "Low", "Moderate", "None", "No"],
  ["DOD9 Blast", 75, -10, -8, "Composite", "High", "Severe", "T6 (closed)", "No"],
  ["AS200", 65, 0, -7, "Polyethylene", "Medium", "None", "T4 (DK7)", "Yes"],
  ["IND70 (moto)", 80, -5, -10, "Polyethylene", "High", "Low", "T6 (closed)", "Yes"],
];
// name, durability, ergo, speed %, material, protected areas
export const ARMORS = [
  ["KN Regular", 35, -1, -1, "Aramid", "C"],
  ["SEK Fortress", 50, 0, -3, "Aluminum", "C"],
  ["6B23", 70, -6, -9, "Hardened Steel", "C UA LA"],
  ["6B13", 65, -5, -5, "Composite", "C UA"],
  ["IND401", 55, -2, -4, "Aluminum", "C UA"],
  ["Spartan B", 50, -2, -4, "Aramid", "C UA"],
  ["H-LC", 70, -1, -5, "Composite", "C"],
  ["BT6", 90, -4, -6, "Titanium", "C UA"],
  ["Samurai", 70, -3, -9, "Aluminum", "C UA LA"],
  ["Samurai Off", 80, -7, -10, "Aluminum", "C S UA"],
  ["Samurai Full", 90, -8, -14, "Aluminum", "C S UA LA"],
  ["926 Comp", 70, -3, -4, "Composite", "C"],
  ["Defender", 80, -5, -11, "Hardened Steel", "C UA LA"],
  ["Brown Def", 80, -5, -10, "Hardened Steel", "C UA LA"],
  ["Marshall", 115, -7, -12, "Ceramic", "C S UA"],
  ["BT101", 100, 0, -4, "Ceramic", "C"],
  ["KN Comp", 110, -3, -7, "Ceramic", "C UA"],
  ["6B45", 120, -10, -18, "Hardened Steel", "C S UA LA"],
  ["BT201", 125, -10, -18, "Aluminum", "C S UA LA"],
];
export const AREAS = { C: "Chest", UA: "Upper abdomen", LA: "Lower abdomen", S: "Shoulders" };
// pictures (wiki) and full in-game names, by the short names above
export const WIKI_IMG = "https://static.wikia.nocookie.net/arena-breakout-infinite/images/";
export const GEAR_ITEMS = {
  "Retro Steel": ["e/e0/Retro_Steel_Helmet.png", "Retro Steel Helmet"],
  "F80": ["9/90/F80_Tactical_Helmet.png", "F80 Tactical Helmet"],
  "IND Tact": ["2/24/IND_Tactical_Helmet.png", "IND Tactical Helmet"],
  "SH40": ["5/59/SH40_Military_Helmet.png", "SH40 Military Helmet"],
  "IND200": ["3/3a/IND200_Helmet.png", "IND200 Helmet"],
  "SH18": ["1/14/SH18_Military_Helmet.png", "SH18 Military Helmet"],
  "KSS Tact": ["b/bf/KSS_Tactical_Helmet.png", "KSS Tactical Helmet"],
  "KSS2 Tact": ["a/a1/KSS2_Tactical_Helmet.png", "KSS2 Tactical Helmet"],
  "56K Heli": ["0/07/56K_Helicopter_Helmet.png", "56K Helicopter Helmet"],
  "FA Assault": ["7/70/FA_Assault_Tactical_Helmet.png", "FA Assault Tactical Helmet"],
  "03 Heavy": ["6/67/03_Heavy_Tactical_Helmet.png", "03 Heavy Tactical Helmet"],
  "RSP Heavy": ["a/a7/RSP_Heavy_Tactical_Helmet.png", "RSP Heavy Tactical Helmet"],
  "SH50": ["3/38/SH50_Military_Helmet.png", "SH50 Military Helmet"],
  "SH Matzka": ["d/d7/SH_Matzka_2_Helmet.png", "SH Matzka 2 Helmet"],
  "SH 60": ["b/b3/SH60_Military_Helmet.png", "SH60 Military Helmet"],
  "AN95": ["8/8f/AN95_Heavy_Blast_Helmet.png", "AN95 Heavy Blast Helmet"],
  "6BNT": ["5/5f/6BNT_Helmet.png", "6BNT Helmet"],
  "IND50": ["8/87/IND50_Heavy_Tactical_Helmet.png", "IND50 Heavy Tactical Helmet"],
  "SH65 MIL": ["4/4f/SH65_Military_Helmet.png", "SH65 Military Helmet"],
  "RST Spec": ["7/7c/RST_Special_Forces_Helmet.png", "RST Special Forces Helmet"],
  "HG84": ["4/44/HG84_Offensive_Helmet.png", "HG84 Offensive Helmet"],
  "DOD9 Blast": ["4/43/DOD9_Blast_Helmet.png", "DOD9 Blast Helmet"],
  "AS200": ["e/e5/AS200_Heavy_Tactical_Helmet.png", "AS200 Heavy Tactical Helmet"],
  "IND70 (moto)": ["0/05/IND70_Tactical_Helmet.png", "IND70 Tactical Helmet"],
  "KN Regular": ["f/f2/KN_Regulation_Body_Armor.png", "KN Regulation Body Armor"],
  "SEK Fortress": ["a/ae/SEK_Fortress_Body_Armor.png", "SEK Fortress Body Armor"],
  "6B23": ["9/93/6B23_Body_Armor.png", "6B23 Body Armor"],
  "6B13": ["3/34/6B13_Body_Armor.png", "6B13 Body Armor"],
  "IND401": ["f/f9/IND401_Body_Armor.png", "IND401 Body Armor"],
  "Spartan B": ["b/bc/Spartan_B_Body_Armor.png", "Spartan B Body Armor"],
  "H-LC": ["", "H-LC Tactical Body Armor"],
  "BT6": ["4/44/BT6_Heavy_Body_Armor.png", "BT6 Heavy Body Armor"],
  "Samurai": ["2/29/IMTV_Samurai_Standard_Body_Armor.png", "IMTV Samurai Standard Body Armor"],
  "Samurai Off": ["0/0e/IMTV_Samurai_Offensive_Body_Armor.png", "IMTV Samurai Assault Body Armor"],
  "Samurai Full": ["1/16/IMTV_Samurai_Full_Protection_Body_Armor.png", "IMTV Samurai Full Protection Body Armor"],
  "926 Comp": ["b/b6/926_Composite_Body_Armor.png", "926 Composite Body Armor"],
  "Defender": ["e/ea/Defender_M4_Heavy_Body_Armor.png", "Defender M4 Heavy Body Armor"],
  "Brown Def": ["d/dc/Defender_L4_Heavy_Armor_%28Officer_Camo%29.png", "Defender M4 Heavy Armor (Officer Skin)"],
  "Marshall": ["3/3f/Marshal_Heavy_Body_Armor.png", "Marshal Heavy Body Armor"],
  "BT101": ["b/bd/BT101_Tactical_Body_Armor.png", "BT101 Tactical Body Armor"],
  "KN Comp": ["6/67/KN_Composite_Body_Armor.png", "KN Composite Body Armor"],
  "6B45": ["6/6f/6B45_Heavy_Body_Armor.png", "6B45 Heavy Body Armor"],
  "BT201": ["7/7b/BT201_Full_Body_Armor.png", "BT201 Full Body Armor"],
  "Defender M4": ["a/a3/Defender_M4_Heavy_Armored_Rig.png", "Defender M4 Heavy Armored Rig"],
  "Warrior": ["4/44/Warrior_Heavy_Armored_Chest_Rig.png", "Warrior Heavy Armored Chest Rig"],
  "H-TAC A8": ["0/0a/H-Tac_A8_Armored_Rig.png", "H-Tac A8 Armored Rig"],
  "H-TAC A9": ["a/ae/H-Tac_A9_Armored_Rig.png", "H-Tac A9 Armored Rig"],
  "Spartan C": ["0/0b/Spartan_C_Heavy_Armored_Rig.png", "Spartan C Heavy Armored Rig"],
  "AL Command": ["d/db/AL_Commander_Armored_Rig.png", "AL Commander Armored Rig"],
  "AL Assault": ["3/33/AL_Assault_Armored_Rig.png", "AL Assault Armored Rig"],
  "AVS Heavy": ["8/84/AVS_Heavy_Armored_Rig.png", "AVS Heavy Armored Rig"],
  "AL Tactical": ["a/a8/AL_Tactical_Armored_Rig.png", "AL Tactical Armored Rig"],
};
GEAR_ITEMS["IND70"] = GEAR_ITEMS["IND70 (moto)"];
// any gear name (short name from skrux or full in-game name) -> catalogue entry
export const fullName = n => (GEAR_ITEMS[n] ? GEAR_ITEMS[n][1] : n);
export const catOf = n => CAT_BY_NAME[fullName(n)] || null;
export function gearImg(name, cls = "") {
  const box = el("span", "g-img " + cls);
  const fallback = () => { box.textContent = ""; box.append(el("b", null, name.replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase())); };
  const c = catOf(name), it = GEAR_ITEMS[name];
  const srcs = [c && c.img, it && it[0] && WIKI_IMG + it[0] + "/revision/latest/scale-to-width-down/160"].filter(Boolean);
  if (!srcs.length) { fallback(); return box; }
  const img = new Image(); img.alt = ""; img.loading = "lazy"; img.decoding = "async"; img.referrerPolicy = "no-referrer";
  img.addEventListener("load", () => img.classList.add("ok"));
  img.addEventListener("error", () => { srcs.shift(); if (srcs.length) img.src = srcs[0]; else fallback(); });
  img.src = srcs[0];
  box.append(img);
  return box;
}
// tier, as skrux groups them in the value tables (everything else is T4 or lower)
// real armor class from the catalogue
export const tierOf = n => { const c = catOf(n); return c ? c.tier : 0; };
export function nameCell(td, name) {
  td.className = "g-name";
  const it = GEAR_ITEMS[name];
  const txt = el("span", "g-label"); txt.append(el("b", null, name));
  if (it && it[1].toLowerCase() !== name.toLowerCase()) txt.append(el("small", null, it[1]));
  const box = el("div", "g-namebox"); box.append(gearImg(name), txt);
  td.append(box);
}

/* ---------- weapon stats, without attachments (ABI Builder wiki, read 29 Oct 2026) ---------- */
// [vertical recoil control, horizontal recoil control, ergonomics, stability, accuracy, hip-fire stability, effective range m, muzzle velocity m/s, rate of fire rpm, firing modes, firing power]
export const WEAPON_SRC = "https://abibuilder.com/wiki/weapons";
export const WEAPON_STATS = {
  "A545": [77, 63, 70, 60, 65, 61, 48, 880, 900, "Semi, 2 Round Burst, Full", "Ultra High"],
  "ACE31": [54, 32, 59, 48, 48, 74, 58, 800, 650, "Semi, Full", "Medium"],
  "AEK": [57, 38, 59, 48, 42, 70, 59, 800, 800, "Semi, Full", "Medium"],
  "AK-102": [67, 50, 50, 50, 38, 77, 50, 850, 600, "Semi, Full", "Medium"],
  "AK12": [69, 50, 60, 47, 43, 79, 55, 880, 730, "3 Round Burst, Semi, Full", "Mid-High"],
  "AK15SC": [65, 56, 72, 46, 44, 66, 44, 710, 730, "Semi, Full", "Medium"],
  "AK-74N": [60, 47, 48, 52, 39, 71, 42, 900, 550, "Semi, Full", "Medium"],
  "AKM": [50, 47, 44, 50, 38, 71, 54, 715, 600, "Semi, Full", "Medium"],
  "AKS-74U": [52, 36, 44, 50, 29, 72, 33, 735, 500, "Semi, Full", "Low"],
  "AMB-17": [75, 63, 61, 51, 49, 64, 37, 310, 730, "Semi, Full", "Medium"],
  "AN-94": [60, 44, 59, 48, 72, 75, 57, 900, 680, "2 Round Burst, Semi, Full", "Mid-High"],
  "AR-57": [69, 55, 57, 50, 41, 69, 51, 800, 850, "Semi, Full", "Mid-High"],
  "AUG": [77, 69, 68, 51, 59, 81, 46, 970, 750, "Semi, Full", "High"],
  "Banshee": [70, 58, 69, 55, 23, 75, 33, 720, 750, "Semi, Full", "Mid-High"],
  "BM59": [34, 25, 48, 55, 60, 46, 62, 823, 300, "Semi", "Medium"],
  "CZ 52": [55, 26, 77, 48, 13, 61, 16, 500, 325, "Semi", "Low"],
  "Deagle": [40, 24, 65, 46, 30, 58, 31, 470, 300, "Semi", "Medium"],
  "F2000": [80, 74, 67, 51, 39, 83, 48, 900, 850, "Semi, Full", "Mid-High"],
  "F57": [60, 25, 83, 53, 22, 62, 20, 650, 400, "Semi", "Mid-High"],
  "FAL": [52, 43, 43, 48, 42, 57, 51, 820, 630, "Semi, Full", "Mid-Low"],
  "FAMAS": [73, 42, 51, 51, 45, 70, 40, 850, 900, "3 Round Burst, Semi, Full", "Medium"],
  "G17": [56, 23, 73, 51, 15, 65, 14, 375, 400, "Semi", "Low"],
  "G18C": [57, 24, 73, 43, 16, 65, 12, 375, 1000, "Semi, Full", "Low"],
  "G3": [54, 29, 53, 47, 38, 65, 39, 790, 460, "Semi, Full", "Medium"],
  "G-Deagle": [66, 35, 88, 46, 30, 58, 31, 470, 300, "Semi", "Medium"],
  "H416": [72, 51, 73, 48, 39, 74, 32, 910, 860, "Semi, Full", "Mid-High"],
  "M110": [58, 51, 58, 66, 91, 48, 80, 783, 300, "Semi", "Mid-High"],
  "M14": [44, 39, 45, 63, 76, 61, 66, 853, 350, "Semi", "Mid-High"],
  "M16": [64, 39, 53, 48, 43, 72, 73, 875, 660, "Semi, 3 Round Burst", "Mid-High"],
  "M1911": [54, 26, 77, 51, 14, 63, 16, 251, 350, "Semi", "Mid-High"],
  "M24": [7, 12, 39, 68, 90, 10, 120, 853, 30, "Bolt-Action", "High"],
  "M3A1": [68, 50, 60, 40, 19, 40, 34, 274, 450, "Fully Automatic", "Mid-Low"],
  "M45A1": [58, 28, 84, 50, 15, 76, 12, 310, 250, "Semi", "Mid-High"],
  "M4A1": [71, 55, 57, 50, 41, 72, 49, 900, 750, "Semi, Full", "Mid-High"],
  "M870": [14, 15, 44, 43, 9, 50, 12, 403, 70, "Pump-Action", "High"],
  "M96": [59, 35, 50, 60, 55, 60, 57, 960, 400, "3 Round Burst", "Mid-High"],
  "M9A3": [46, 27, 81, 50, 14, 61, 17, 372, 600, "Semi", "Low"],
  "MAC-10": [70, 50, 74, 41, 25, 41, 33, 366, 745, "Semi, Full", "Medium"],
  "MCX": [77, 69, 80, 46, 30, 71, 30, 820, 700, "Semi, Full", "Mid-High"],
  "MDR": [75, 25, 66, 51, 42, 74, 51, 960, 700, "Semi, Full", "High"],
  "Mini14": [72, 52, 60, 67, 70, 55, 67, 990, 400, "Semi", "High"],
  "Mk14": [57, 54, 59, 54, 69, 48, 55, 853, 700, "Semi, Full", "Mid-High"],
  "ML Rifle": [37, 29, 62, 65, 86, 85, 64, 457, 75, "Semi", "Medium"],
  "Mosin": [9, 12, 22, 64, 87, 10, 100, 830, 28, "Bolt-Action", "Low"],
  "MP 40": [68, 42, 65, 40, 17, 61, 28, 400, 500, "Fully Automatic", "Mid-High"],
  "MP-133": [7, 6, 47, 41, 5, 51, 11, 337, 60, "Pump-Action", "Medium"],
  "MP5": [70, 50, 74, 42, 22, 76, 28, 400, 750, "Semi, Full", "Medium"],
  "MP9": [69, 42, 69, 44, 13, 72, 11, 400, 750, "Semi, Full", "Medium"],
  "MPF45": [56, 37, 71, 42, 15, 42, 26, 235, 700, "Semi, Full", "Mid-Low"],
  "MPX": [68, 48, 81, 45, 25, 74, 33, 390, 850, "Semi, Full", "Mid-High"],
  "P90": [73, 69, 72, 43, 20, 73, 36, 715, 1000, "Semi, Full", "Mid-Low"],
  "PCC-9": [72, 49, 78, 55, 28, 73, 36, 396, 600, "Semi", "Mid-High"],
  "PP19": [68, 58, 79, 41, 38, 60, 26, 380, 750, "Semi, Full", "Medium"],
  "QC61": [61, 41, 69, 42, 19, 42, 33, 490, 700, "Semi, Full", "Mid-Low"],
  "RPK-16": [73, 58, 51, 55, 57, 66, 53, 890, 750, "Semi, Full", "High"],
  "S12K": [30, 32, 66, 41, 10, 51, 14, 396, 200, "Semi", "Mid-High"],
  "SA85M": [51, 46, 42, 60, 62, 70, 54, 716, 300, "Semi", "Mid-Low"],
  "SCAR-L": [66, 44, 70, 52, 50, 73, 46, 875, 550, "Semi, Full", "Medium"],
  "SG550": [49, 27, 46, 50, 32, 61, 41, 760, 525, "Semi, Full", "Low"],
  "SJ16": [11, 15, 32, 65, 90, 10, 125, 1300, 26, "Bolt-Action", "Mid-High"],
  "SKS": [42, 39, 46, 65, 77, 50, 58, 735, 300, "Semi", "Mid-High"],
  "SPR310": [25, 24, 49, 38, 10, 50, 10, 410, 300, "Semi", "Medium"],
  "SVDS": [43, 44, 44, 64, 91, 22, 83, 815, 225, "Semi", "High"],
  "SVTU": [30, 25, 30, 50, 35, 42, 66, 640, 200, "Semi", "Low"],
  "T03": [77, 37, 57, 49, 45, 72, 53, 930, 700, "Semi, Full", "Mid-High"],
  "T05": [41, 22, 77, 50, 11, 58, 14, 300, 300, "Semi", "Low"],
  "T191": [64, 42, 73, 60, 80, 72, 48, 930, 750, "Semi, Full", "Mid-High"],
  "T192": [66, 42, 84, 76, 60, 80, 41, 900, 750, "Semi, Full", "Mid-High"],
  "T54": [52, 23, 71, 50, 15, 64, 12, 420, 325, "Semi", "Low"],
  "T79": [65, 48, 67, 43, 17, 43, 33, 515, 750, "Semi, Full", "Mid-Low"],
  "T85": [75, 74, 70, 42, 23, 71, 39, 500, 780, "Semi, Full", "Mid-Low"],
  "T88": [76, 61, 64, 55, 88, 55, 82, 895, 400, "Semi", "Ultra High"],
  "T951": [70, 40, 57, 51, 42, 68, 45, 930, 650, "Semi, Full", "Medium"],
  "U191": [63, 49, 46, 72, 90, 51, 64, 950, 750, "Semi, Full", "High"],
  "UMP45": [65, 47, 66, 43, 20, 63, 34, 285, 600, "Semi, Full", "Medium"],
  "USAS-12": [37, 42, 53, 40, 12, 50, 12, 400, 275, "Semi, Full", "Mid-High"],
  "Uzi": [64, 43, 68, 40, 18, 65, 29, 400, 700, "Semi, Full", "Medium"],
  "Vector 45": [62, 47, 71, 41, 21, 79, 25, 270, 1100, "2 Round Burst, Semi, Full", "Low"],
  "Vector 9": [58, 40, 74, 41, 20, 77, 25, 300, 950, "2 Round Burst, Semi, Full", "Medium"],
  "VSS": [65, 45, 57, 55, 44, 71, 26, 287, 850, "Semi, Full", "Medium"],
  "ZC807": [66, 50, 74, 48, 37, 60, 49, 760, 750, "Semi, Full", "Medium"],
};
// what each number means, for the tooltips; the 0-100 ones also get a bar
export const WEAPON_STAT_INFO = [
  ["V. recoil", "How well it holds down the up-kick. Higher is steadier", 100],
  ["H. recoil", "How well it holds the side-to-side shake. Higher is steadier", 100],
  ["Ergonomics", "How fast you aim and handle it. Higher is faster", 100],
  ["Stability", "How still it stays while you aim. Higher is steadier", 100],
  ["Accuracy", "How tight the shots group. Higher is tighter", 100],
  ["Hip fire", "How steady it is without aiming. Higher is steadier", 100],
  ["Range", "Effective range: past it the bullets lose damage", 0, " m"],
  ["Velocity", "Muzzle velocity: faster bullets drop less and reach sooner", 0, " m/s"],
  ["Fire rate", "Rounds per minute", 0, " rpm"],
];
// a build's stats with its attachments, the first eight numbers above (null: the site's number looked wrong).
// Only builds posted on ABI Builder have them (read 29 Oct 2026); keyed by the code without its "Mod Gun-" part
export const BUILD_STATS = {
  "3f62634OOqVoxP4C4": [66, 60, 43, 54, 43, 58, 58, 820],
  "3fgQPrj4qSQY2P4yb": [80, 67, 49, 61, 39, 75, 57, 850],
  "3fd9f8aszpOKEP4P4": [62, 51, 42, 59, 27, 72, 38, 735],
  "3fgQPrj4qSQY2P4yf": [89, 65, 57, 51, 55, 81, 54, 850],
  "3fgQPrj4qSQY2P4hb": [88, 63, 56, 59, 43, 72, 61, 930],
  "3fOZqUARWtIZPP4Tf": [76, 73, 32, 52, 51, 60, 59, 760],
  "3frmQU2ebDVDlP4gb": [74, 56, 34, 53, 40, 69, 48, 790],
  "3f6OqLuOsvbODP444": [85, 80, 74, 64, 36, 77, 40, 820],
  "3fDpOsLUB7ntiP494": [88, 78, 66, 58, 28, 76, 43, 396],
  "3f8rANjfri8IXP4i4": [77, 66, 68, 48, 24, 62, 45, null],
  "3fOZqUARWtIZPP4rf": [71, 60, 64, 43, 19, 63, 34, 285],
  "3fDug6dSNLS1EP494": [83, 72, 71, 41, 28, 71, 41, 366],
  "3f4Ecdz4IwZP2P4P4": [73, 60, 68, 43, 17, 63, 38, 515],
  "3fOZqUARWtIZPP46f": [82, 78, 74, 43, 17, 63, 33, 515],
  "3fgkjvhg2lexbP4C4": [68, 42, 46, 40, 17, 61, 32, 500],
  "3fgQPrj4qSQY2P4ko": [70, 58, 69, 55, 23, 75, 38, 720],
  "3frmQU2ebDVDlP4Xb": [81, 79, 68, 41, 37, 60, 26, 377],
  "3fOZqUARWtIZPP4Rf": [59, 61, 34, 60, 60, 70, 61, 716],
  "3fOZqUARWtIZPP4Cf": [48, 48, 38, 70, 74, 59, 58, 738],
  "3fImPeCki97plP4C4": [37, 30, 33, 55, 57, 46, 62, 823],
  "3fOZqUARWtIZPP4s4": [38, 32, 32, 55, 57, 46, 62, 823],
  "3fOZqUARWtIZPP4Jf": [36, 35, 12, 50, 32, 42, 66, 640],
  "3frmQU2ebDVDlP4Wb": [70, 78, 51, 54, 68, 48, 60, 853],
  "3fOZqUARWtIZPP45P": [10, 11, 56, 46, 1, 51, 10, 337],
  "3frmQU2ebDVDlP4rb": [42, 49, 52, 41, 7, 60, 20, 396],
  "3fgQPrj4qSQY2P4mb": [43, 52, 55, 51, 9, 55, 16, 396],
  "3frmQU2ebDVDlP4co": [37, 42, 41, 40, 12, 55, 14, 400],
  "3f6dzPgTF3EabP4A4": [46, 56, 56, 46, 12, 63, 14, 400],
  "3fJUGFzqthP0fP4A4": [50, 62, 30, 40, 10, 61, 12, 400],
  "3fOZqUARWtIZPP4I4": [59, 29, 63, 51, 14, 65, 14, 375],
  "3fVg5IZHgwKBoP464": [61, 31, 61, 51, 12, 66, 14, 375],
  "3fVg5IZHgwKBoP4G4": [49, 32, 72, 50, 11, 61, 17, 372],
  "3fVPqMG61iBwhP4y4": [57, 24, 70, 43, 16, 65, 12, 375],
  "3fVg5IZHgwKBoP4r4": [57, 24, 64, 43, 16, 75, 12, 375],
  "3fsY7WrCzfZCOP4w4": [57, 24, 68, 43, 16, 65, 14, 375],
  "3fOZqUARWtIZPP4g4": [40, 24, 61, 46, 30, 58, 31, 470],
  "3ftIOVzMbPCajP4qb": [40, 24, 61, 46, 30, 58, 31, 470],
  "3fsD2XuKgGHqLP4NP": [55, 28, 72, 51, 14, 63, 18, 251],
  "3fVg5IZHgwKBoP4e4": [55, 28, 72, 51, 14, 63, 16, 251],
  "3fOZqUARWtIZPP4VP": [72, 47, 63, 44, 12, 74, 11, 400],
  "3fVg5IZHgwKBoP454": [72, 47, 65, 44, 12, 74, 11, 400],
  "3ftIOVzMbPCajP4Ob": [66, 35, 84, 46, 30, 58, 31, 470],
  "3fqvBR3GveekqP4L4": [61, 27, 72, 53, 21, 71, 23, 650],
  "3fsD2XuKgGHqLP47P": [61, 27, 74, 53, 21, 62, 23, 650],
};
export const buildStats = code => BUILD_STATS[String(code || "").split("-").pop().trim()] || null;
// the build's numbers, each with how far the attachments moved it from the bare weapon: green better, red worse
export function buildStatsRow(g, b) {
  const st = buildStats(b.code); if (!st) return null;
  const base = WEAPON_STATS[g.name], row = el("div", "b-stats");
  const short = ["V.Rec", "H.Rec", "Ergo", "Stab", "Acc", "Hip", "Range", "Vel"];
  st.forEach((v, i) => {
    const s = el("span"), d = base && v != null ? v - base[i] : 0, val = el("b", null, v == null ? "—" : String(v));
    if (d) val.append(el("i", null, (d > 0 ? "+" : "") + d));
    s.append(el("small", null, short[i]), val);
    if (d > 0) s.classList.add("up"); else if (d < 0) s.classList.add("down");
    row.append(s);
  });
  return row;
}
// only some builds have these (the ones from ABI Builder), so the card shows a small "Stats" that opens them on hover;
// the box floats over everything (fixed), placed above the word, or under it when there's no room
export function buildStatsChip(g, b) {
  const row = buildStatsRow(g, b); if (!row) return null;
  const chip = el("span", "b-statchip"); chip.tabIndex = 0; chip.append(icon("chart")); chip.setAttribute("aria-label", "Stats");
  const pop = el("span", "b-pop"); pop.append(row, el("small", null, "With its attachments. The small number is the change from the bare weapon."));
  chip.append(pop);
  const place = () => {
    pop.classList.add("on");
    const r = chip.getBoundingClientRect(), top = r.top - pop.offsetHeight - 6 < 8 ? r.bottom + 6 : r.top - pop.offsetHeight - 6, left = Math.max(8, Math.min(r.left, innerWidth - pop.offsetWidth - 8));
    Object.assign(pop.style, { left: left + "px", top: top + "px" });
    const m = pop.getBoundingClientRect(); // a parent with a transform moves "fixed": correct by that much
    Object.assign(pop.style, { left: 2 * left - m.left + "px", top: 2 * top - m.top + "px" });
  };
  const hide = () => pop.classList.remove("on");
  chip.addEventListener("mouseenter", place); chip.addEventListener("focus", place);
  chip.addEventListener("mouseleave", hide); chip.addEventListener("blur", hide);
  return chip;
}

/* ---------- gear stats (ABI Builder game database, S7) + skrux's maths ---------- */
// [name, class, material, durability, ergonomics, speed %, weight kg, ricochet (helmets) / storage slots (rigs), protected areas]
export const GEAR_STATS = {
  helmet: [
    ["03 Heavy Tactical Helmet",5,"Composite",45,0,-1,2.1,"Medium","H"],
    ["56K Helicopter Helmet",4,"Aramid",50,-5,-6,2.2,"Low","H E F"],
    ["6B4 Helmet",3,"Aramid",30,-2,-3,2.2,"Medium","H E"],
    ["6B4 Helmet Squad Camo",3,"Aramid",30,-2,-3,2.2,"Medium","H E"],
    ["6B5 Helmet",3,"Polyethylene",35,0,-4,1.3,"Medium","H E"],
    ["6BNT Helmet",6,"Hardened Steel",75,-9,-4,4.1,"High","H E"],
    ["AN95 Heavy Blast Helmet",5,"Titanium",55,-5,-5,3.1,"Medium","H E"],
    ["AS200 Heavy Tactical Helmet",6,"Polyethylene",65,0,-7,1.6,"Medium","H E"],
    ["Aviator Helmet",2,"Polyethylene",20,0,0,1.2,"Low","H E"],
    ["DOD9 Blast Helmet",6,"Composite",75,-10,-8,3.5,"High","H E F"],
    ["F70 Tactical Helmet",3,"Composite",25,0,-1,1.4,"Low","H"],
    ["F80 Tactical Helmet",4,"Aluminum",35,0,-1,2,"High","H"],
    ["FA Assault Tactical Helmet",5,"Composite",50,-2,-1,2.1,"Medium","H"],
    ["HG84 Offensive Helmet",6,"Composite",70,-3,-4,2.7,"Low","H E"],
    ["IND Tactical Helmet",4,"Composite",35,0,-1,2,"Medium","H"],
    ["IND Tactical Helmet (Snow)",4,"Composite",35,0,0,2,"Low","H"],
    ["IND200 Helmet",4,"Composite",40,0,-1,2.2,"Low","H"],
    ["IND50 Heavy Tactical Helmet",6,"Composite",60,-1,-1,2.3,"Medium","H"],
    ["IND70 Tactical Helmet",6,"Polyethylene",80,-5,-10,2.1,"High","H E F"],
    ["Kelsey Fire Helmet",1,"Aramid",10,0,0,1,"Low","H"],
    ["KSS Tactical Helmet",4,"Aluminum",40,0,-1,1.9,"Medium","H"],
    ["KSS2 Tactical Helmet",4,"Composite",45,0,-3,2.4,"Low","H E"],
    ["Lightweight Safety Helmet",1,"Aramid",15,0,0,1,"High","H"],
    ["Motorcycle Helmet",1,"Aramid",15,0,0,1.2,"Medium","H E"],
    ["PAS Standard Helmet",2,"Aramid",25,-3,0,3.2,"Low","H E"],
    ["PAS2 Helmet",3,"Hardened Steel",28,0,-1,2.8,"Medium","H"],
    ["Retro Military Helmet",2,"Hardened Steel",20,0,0,2.6,"High","H"],
    ["Retro Steel Helmet",2,"Hardened Steel",25,0,0,2.6,"High","H"],
    ["RSP Heavy Tactical Helmet",5,"Composite",55,-2,-4,2.5,"Low","H E"],
    ["RST Special Forces Helmet",6,"Aluminum",75,-10,-6,2.6,"High","H E"],
    ["Security Helmet",2,"Polyethylene",20,0,0,1.1,"Low","H"],
    ["Security Riot Helmet",2,"Polyethylene",22,0,0,1.2,"Medium","H E"],
    ["SH Matzka 2 Helmet",5,"Hardened Steel",65,-10,-4,3.9,"High","H E"],
    ["SH12 Military Helmet",3,"Hardened Steel",30,-6,-2,3.4,"High","H E"],
    ["SH18 Military Helmet",4,"Titanium",45,-2,-4,2.9,"High","H E"],
    ["SH40 Military Helmet",4,"Hardened Steel",50,-4,-3,3.6,"High","H E"],
    ["SH50 Military Helmet",5,"Hardened Steel",60,-7,-4,3.2,"High","H E"],
    ["SH60 Military Helmet",5,"Composite",50,-9,-3,3.2,"Medium","H E"],
    ["SH65 Military Helmet",6,"Composite",65,-7,-4,3.7,"High","H E"],
    ["Tanker Protective Cap",1,"Aramid",20,0,0,1.3,"Low","H E"],
  ],
  armor: [
    ["220 Body Armor",2,"Aramid",30,0,-1,4.4,0,"C UA"],
    ["6B13 Body Armor",4,"Composite",65,-5,-5,7,0,"C UA"],
    ["6B23 Body Armor",4,"Hardened Steel",70,-6,-9,11.2,0,"C UA LA"],
    ["6B45 Heavy Body Armor",6,"Hardened Steel",120,-10,-18,14,0,"C UA LA S"],
    ["926 Composite Body Armor",5,"Composite",70,-3,-4,6.2,0,"C"],
    ["BT101 Tactical Body Armor",6,"Ceramic",100,0,-4,5.5,0,"C"],
    ["BT201 Full Body Armor",6,"Aluminum",125,-10,-18,15,0,"C UA LA S"],
    ["BT6 Heavy Body Armor",5,"Titanium",90,-4,-6,8.6,0,"C UA"],
    ["Defender M4 Heavy Armor (Officer Skin)",5,"Hardened Steel",80,-5,-10,11.8,0,"C UA LA"],
    ["Defender M4 Heavy Body Armor",5,"Hardened Steel",80,-5,-11,11.8,0,"C UA LA"],
    ["H-LC Lightweight Body Armor",3,"Composite",55,0,-3,4.5,0,"C"],
    ["H-LC Tactical Body Armor",5,"Composite",70,-1,-5,5.9,0,"C"],
    ["H-Tac SWAT Body Armor",3,"Polyethylene",35,0,-2,4.1,0,"C"],
    ["IMTV Samurai Assault Body Armor",5,"Aluminum",80,-7,-10,10,0,"C UA S"],
    ["IMTV Samurai Full Protection Body Armor",5,"Aluminum",90,-8,-14,11,0,"C UA LA S"],
    ["IMTV Samurai Standard Body Armor",5,"Aluminum",70,-3,-9,9.6,0,"C UA LA"],
    ["IND401 Body Armor",4,"Aluminum",55,-2,-4,6.8,0,"C UA"],
    ["KN Assault Body Armor",3,"Titanium",50,-3,-6,5,0,"C UA LA"],
    ["KN Composite Body Armor",6,"Composite",110,-3,-7,6.9,0,"C UA"],
    ["KN Regulation Body Armor",3,"Aramid",35,-1,-1,4,0,"C"],
    ["Marshal Heavy Body Armor",6,"Ceramic",115,-7,-12,7.8,0,"C UA S"],
    ["Old Security Body Armor",1,"Aramid",25,0,0,3.7,0,"C"],
    ["PCA350 Body Armor",3,"Aluminum",50,-2,-3,6.5,0,"C UA"],
    ["Retro Bulletproof Vest",1,"Aramid",20,0,0,3.5,0,"C UA"],
    ["Retro Infantry Bulletproof Vest",2,"Aluminum",30,-2,-1,3,0,"C UA"],
    ["Retro Sapper Bulletproof Chest Armor",1,"Hardened Steel",25,-3,-1,6,0,"C UA LA"],
    ["Security Body Armor",2,"Aramid",25,0,-1,3.8,0,"C"],
    ["SEK Fortress Body Armor",4,"Aluminum",50,0,-3,5.6,0,"C"],
    ["Spartan B Body Armor",4,"Aramid",50,-2,-4,5.4,0,"C UA"],
    ["Standard SWAT Armor",3,"Aramid",45,-1,-3,4.6,0,"C UA"],
  ],
  arig: [
    ["6B5 Armored Rig",3,"Ceramic",35,-4,-3,6.5,12,"C UA LA"],
    ["926 Security Armored Chest Rig",3,"Aramid",25,-2,-2,4.6,10,"C UA"],
    ["AL Assault Armored Rig",6,"Composite",90,-3,-8,6.8,18,"C UA"],
    ["AL Commander Armored Rig",6,"Hardened Steel",100,-5,-7,8.6,20,"C UA"],
    ["AL Tactical Armored Rig",6,"Ceramic",95,-5,-6,7.2,18,"C UA"],
    ["AVS Heavy Armored Rig",6,"Ceramic",90,-6,-10,6.9,20,"C UA LA"],
    ["Defender M4 Heavy Armored Rig",5,"Hardened Steel",100,-7,-10,12,20,"C UA LA"],
    ["H-Tac A8 Armored Rig",5,"Composite",60,-5,-4,5.9,18,"C"],
    ["H-Tac A9 Armored Rig",5,"Ceramic",65,-5,-8,6.6,20,"C UA LA"],
    ["M1955 Combat Vest",2,"Aramid",20,0,-1,4.4,8,"C UA"],
    ["Sentry 3 Armored Chest Rig",3,"Polyethylene",30,0,-2,3.7,10,"C"],
    ["Sentry 305 Armored Chest Rig",4,"Composite",50,-1,-3,10,16,"C"],
    ["Spartan C Heavy Armored Rig",6,"Hardened Steel",100,-10,-18,14.4,23,"C UA LA S"],
    ["TM1 Armored Rig",4,"Titanium",40,-2,-5,8.2,14,"C UA"],
    ["TM2 Armored Rig",4,"Aluminum",45,-1,-4,10,16,"C UA"],
    ["Warrior Heavy Armored Chest Rig",5,"Composite",55,-7,-6,7.4,16,"C UA"],
  ],
};
// skrux: real durability = durability × how well the material resists wear
export const MAT_FACTOR = { Composite: 1.2, Aramid: 1.6, Polyethylene: 1.55, Titanium: 1.45, Aluminum: 1.4, "Hardened Steel": 1.15, Ceramic: 1.15 };
export const AREA_NAME = { C: "Chest", UA: "Upper abdomen", LA: "Lower abdomen", S: "Shoulders", H: "Head", E: "Ears", F: "Face" };
// market names that differ from the database
export const MARKET_ALIAS = { "6B4 Helmet Squad Camo": "6B4 Helmet (Squad S…" };
// skrux's extra helmet notes, by full name: [sound blocking, face mask, headset]
export const HELMET_NOTES = {};
HELMETS.forEach(r => { HELMET_NOTES[fullName(r[0])] = [r[6], r[7], r[8]]; });

// every condition the market sells an item in: [{ cond, label, price, cur, max, real, ppd }]
export function gearOffers(g) {
  const it = marketItemFor(g.name, GEAR_CAT[g.kind]);
  const l = it && latest(it.id);
  if (!l) return [];
  const all = typeof l.all === "object" ? l.all : { new: l.all };
  return CONDS.filter(([k]) => all[k] != null).map(([k, label]) => {
    const d = all[k + "Dur"], cur = d ? +String(d).split("/")[0] : g.dur;
    const real = cur * g.factor;
    return { cond: k, label, price: all[k], cur, max: g.dur, real, ppd: real > 0 ? Math.round(all[k] / real) : null, date: l.date };
  });
}
export const GEAR_KIND = { helmet: "Helmet", armor: "Body armor", arig: "Armored rig" };
export const GEAR_PLURAL = { helmet: "Helmets", armor: "Body armor", arig: "Armored rigs" };
export const GEAR = Object.entries(GEAR_STATS).flatMap(([kind, rows]) => rows.map(([name, tier, mat, dur, ergo, spd, w, extra, areas]) =>
  ({ name, kind, tier, mat, dur, ergo, spd, w, extra, areas, factor: MAT_FACTOR[mat] || 1 })));
export const gearByName = n => GEAR.find(g => g.name === fullName(n)) || null;

/* other equipment (ABI Builder database): masks, gas masks, headsets, chest rigs, backpacks */
export const LAYOUT_IMG = CAT_IMG; // same folder tree: <kind>_layouts/<file>
// [name, class, material, durability, weight kg, ricochet, helmets it fits on, picture]
export const MASK_STATS = [
  ["6BNT Blast Mask", 6, "Hardened Steel", 70, 2.3, "Low", ["6BNT Helmet"], "6bnt_blast_mask"],
  ["AN95 Military Bulletproof Mask", 4, "Glass", 50, 1.4, "Medium", ["AN95 Heavy Blast Helmet"], "an95_military_bulletproof_mask"],
  ["DK5 Universal Bulletproof Mask", 2, "Glass", 40, 1.2, "Low", ["IND50 Heavy Tactical Helmet", "03 Heavy Tactical Helmet", "RSP Heavy Tactical Helmet", "KSS Tactical Helmet", "KSS2 Tactical Helmet", "IND200 Helmet", "IND Tactical Helmet", "F70 Tactical Helmet"], "dk5_universal_bulletproof_mask"],
  ["DK6 Security Ballistic Mask", 3, "Glass", 45, 1, "Medium", ["IND50 Heavy Tactical Helmet", "03 Heavy Tactical Helmet", "RSP Heavy Tactical Helmet", "KSS Tactical Helmet", "KSS2 Tactical Helmet", "IND200 Helmet", "IND Tactical Helmet", "F70 Tactical Helmet"], "dk6_security_ballistic_mask"],
  ["DK7 Premium Bulletproof Mask", 4, "Glass", 50, 1.8, "High", ["AS200 Heavy Tactical Helmet"], "dk7_premium_bulletproof_mask"],
  ["DK8 Military Bulletproof Mask", 4, "Glass", 45, 1.5, "Medium", ["IND50 Heavy Tactical Helmet", "03 Heavy Tactical Helmet", "RSP Heavy Tactical Helmet", "KSS Tactical Helmet", "KSS2 Tactical Helmet"], "dk8_military_bulletproof_mask"],
  ["RST Special Forces Mask", 6, "Aluminum", 70, 1.4, "Medium", ["RST Special Forces Helmet"], "rst_special_forces_mask"],
  ["SH Matzka Mask", 5, "Hardened Steel", 50, 2, "High", ["SH Matzka 2 Helmet"], "sh_matzka_mask"],
  ["SH Universal Bulletproof Mask", 3, "Glass", 30, 0.7, "Medium", ["SH50 Military Helmet"], "sh_universal_bulletproof_mask"],
  ["SH60 Mask", 4, "Composite", 35, 1.5, "Medium", ["SH40 Military Helmet", "SH60 Military Helmet"], "sh60_mask"],
  ["SH65 Military Mask A", 5, "Glass", 55, 0.7, "High", ["SH65 Military Helmet"], "sh65_military_mask_a"],
  ["SH65 Military Mask B", 6, "Composite", 65, 0.8, "Medium", ["SH65 Military Helmet"], "sh65_military_mask_b"],
];
// [name, durability, weight kg, anti-flash, anti-poison, picture]
export const GAS_STATS = [
  ["RAL Full Gas Mask", 45, 0.5, "—", "Medium", "RAL_Full"], ["RAL Goggle Gas Mask", 55, 0.7, "Medium", "Strong", "RAL_Goggle"],
  ["RAL10 Universal Gas Mask", 35, 0.4, "Medium", "Bad", "RAL_10_Universal"], ["RAL20 Field Gas Mask", 35, 0.6, "Bad", "Bad", "RAL20_Field"],
  ["RAL40 Premium Gas Mask", 60, 0.8, "Strong", "Strong", "RAL40_Premium"], ["SH-3 Gas Mask", 30, 0.5, "—", "Bad", "SH-3"],
  ["SH-4 Gas Mask", 45, 0.5, "Strong", "Medium", "SH-4"],
];
// [name, weight kg, sound pickup, noise reduction]
export const HEADSET_STATS = [
  ["Com1 Tactical Headset", 0.4, "Bad", "Bad"], ["Commander A Tactical Headset", 0.7, "Medium", "Strong"], ["GS2 Tactical Headset", 0.8, "Strong", "Medium"],
  ["M32 Tactical Headset", 0.6, "Medium", "Bad"], ["Z038 Tactical Headset", 0.65, "Medium", "Medium"],
];
// [name, slots, bonus slots, grid, weight kg, layout picture] — layouts the database reuses from another item are left out
export const PACK_STATS = [
  ["926 Field Backpack", 40, 0, "5 × 8", 1.75, "926_Field_Backpack_layout"], ["Amp7 Assault Backpack", 32, 0, "5 × 6", 1.6, "AMP7_Assault_Backpack_layout"],
  ["Canvas Backpack", 9, 0, "3 × 3", 0.7, "Canvas_Backpack_layout"], ["Canvas Camping Backpack", 20, 0, "4 × 5", 0.75, "Canvas_Camping_Backpack_Layout"],
  ["Chapman Military Backpack", 30, 0, "5 × 6", 1.3, "Chapman_Military_Backpack_layout"], ["Cowhide Backpack", 25, 5, "4 × 5", 1.5, "Cowhide_Backpack_Layout"],
  ["Field Camping Backpack", 45, 0, "5 × 9", 1.9, "Field_Camping_Backpack_layout"], ["Large Camping Backpack", 28, 0, "4 × 7", 1.75, "Large_Camping_Backpack_Layout"],
  ["Lightweight Camping Backpack", 12, 0, "3 × 4", 0.9, "Lightweight_Camping_Backpack_layout"], ["Luc Expanded Tactical Backpack", 45, 0, "5 × 9", 2, "LUC_Expanded_Tactical_Backpack_Layout"],
  ["Med Field Backpack", 28, 0, "4 × 7", 1.15, "Med_Field_Backpack_layout"], ["Medium Camping Backpack", 16, 0, "4 × 4", 0.7, "Medium_Camping_Backpack_layout"],
  ["Outdoor Travel Backpack", 24, 0, "4 × 6", 1.1, "Outdoor_Travel_Backpack_layout"], ["Ral Heavy Military Backpack", 50, 0, "5 × 9", 1.4, "RAL_Heavy_Military_Backpack_Layout"],
  ["Retro Marching Backpack", 36, 0, "5 × 5", 1, "Retro_Marching_Backpack_Layout"], ["Rush Tactical Backpack", 24, 4, "4 × 5", 1.2, "RUSH_Tactical_Backpack_layout"],
  ["Simple Backpack", 8, 0, "2 × 4", 0.8, "Simple_Backpack_layout"], ["Sling Bag", 6, 0, "2 × 3", 0.6, "Sling_Backpack_layout"],
  ["Sports Backpack", 20, 0, "4 × 5", 0.8, "Sports_Backpack_layout"], ["Xa4 Tactical Backpack", 32, 0, "5 × 6", 1.45, "XA4_Tactical_Backpack_Layout"],
];
export const RIG_STATS = [
  ["926 Hunter Vest", 14, 0, "3 × 4", 1.5, "926_Hunter_Vest_Layout"], ["926 Lightweight Chest Rig", 8, 0, "3 × 2", 0.6, "926_Lightweight_Chest_Rig_Layout"],
  ["926 Premium Field Chest Rig", 24, 0, "4 × 4", 2, "926_Premium_Field_Chest_Rig_Layout"], ["ALS Carry Rig", 6, 0, "2 × 3", 0.8, "ALS_Carry_Rig_Layout"],
  ["B3 Universal Chest Rig", 16, 0, "3 × 4", 1.5, "B3_Universal_Chest_Rig_Layout"], ["B4 Tactical Chest Rig", 15, 0, "3 × 4", 1.7, "B4_Tactical_Chest_Rig_Layout"],
  ["B6 Tactical Chest Rig", 20, 0, "3 × 4", 1.8, "B6_Tactical_Chest_Rig_Layout"], ["BH Infantry Chest Rig", 10, 0, "3 × 3", 1, ""],
  ["BH2 Chest Rig", 12, 0, "3 × 3", 0.9, ""], ["FA Commander Chest Rig", 20, 0, "3 × 4", 1.9, "FA_Commander_Chest_Rig_Layout"],
  ["FA Multipurpose Chest Rig", 18, 0, "3 × 4", 1.6, "FA_Multipurpose_Chest_Rig_Layout"], ["Hunting Vest", 6, 0, "2 × 3", 0.4, ""],
  ["Leather Biker Vest", 10, 0, "3 × 3", 0.9, ""], ["Punk Motorcycle Vest", 8, 0, "2 × 3", 0.8, "Punk_Motorcycle_Vest_Layout"],
  ["RAP Simple Chest Rig", 14, 0, "3 × 3", 1.3, "RAP_Simple_Chest_Rig_Layout"], ["Service Tactical Vest", 12, 0, "4 × 3", 0.7, ""],
  ["Stormtrooper Type 2 Chest Rig", 12, 0, "4 × 3", 1.4, "Stormtrooper_Type_2_Chest_Rig_Layout"], ["Stormtrooper Type 3 Tactical Chest Rig", 20, 0, "4 × 4", 1.9, "Stormtrooper_Type_3_Tactical_Chest_Rig_Layout"],
  ["Stormtrooper Type 4 Tactical Chest Rig", 22, 0, "4 × 4", 1.8, "Stormtrooper_Type_4_Tactical_Chest_Rig_Layout"],
];
export const ARIG_LAYOUT = {
  "6B5 Armored Rig": "6B5_Armored_Rig_Layout", "926 Security Armored Chest Rig": "926_Security_Armored_Chest_Rig_Layout", "AL Assault Armored Rig": "AL_Assault_Armored_Rig_Layout",
  "AL Commander Armored Rig": "AL_Commander_Armored_Rig_Layout", "AL Tactical Armored Rig": "AL_Tactical_Armored_Rig_Layout", "AVS Heavy Armored Rig": "avs_heavy_armored_rig_layout",
  "Defender M4 Heavy Armored Rig": "Defender_M4_Heavy_Armored_Rig_Layout", "H-Tac A8 Armored Rig": "H-Tac_A8_Armored_Rig_Layout", "H-Tac A9 Armored Rig": "H-Tac_A9_Armored_Rig_Layout",
  "M1955 Combat Vest": "M1955_Combat_Vest_Layout", "Sentry 3 Armored Chest Rig": "Sentry_3_Armored_Chest_Rig_Layout", "Sentry 305 Armored Chest Rig": "Sentry_305_Armored_Chest_Rig_Layout",
  "Spartan C Heavy Armored Rig": "Spartan_C_Heavy_Armored_Rig_Layout", "TM1 Armored Rig": "TM1_Armored_Rig_Layout", "TM2 Armored Rig": "TM2_Armored_Rig_Layout",
  "Warrior Heavy Armored Chest Rig": "Warrior_Heavy_Armored_Chest_Rig_Layout",
};
export const layoutUrl = (kind, file) => file ? `${CAT_IMG}${kind}_layouts/${file}.webp` : null;
// masks and gas masks get pictures like the rest of the catalogue
MASK_STATS.forEach(([n, t, , , , , , img]) => { CAT_BY_NAME[n] = { name: n, kind: "mask", tier: t, img: CAT_IMG + "face_covers/" + img + ".webp", sub: "" }; });
GAS_STATS.forEach(([n, , , , , img]) => { CAT_BY_NAME[n] = { name: n, kind: "gas", tier: 0, img: CAT_IMG + "gas_masks/" + img + ".webp", sub: "" }; });
export const EXTRA = [
  ...MASK_STATS.map(([name, tier, mat, dur, w, ric, fits]) => ({ name, kind: "mask", cat: "Mask", tier, mat, dur, w, ric, fits, factor: MAT_FACTOR[mat] || 1 })),
  ...GAS_STATS.map(([name, dur, w, flash, poison]) => ({ name, kind: "gas", cat: "Gas Mask", dur, w, flash, poison })),
  ...HEADSET_STATS.map(([name, w, pickup, noise]) => ({ name, kind: "headset", cat: "Headset", w, pickup, noise })),
  ...PACK_STATS.map(([name, slots, bonus, grid, w, lay]) => ({ name, kind: "pack", cat: "Backpack", slots: slots + bonus, bonus, grid, w, layout: layoutUrl("backpack", lay) })),
  ...RIG_STATS.map(([name, slots, bonus, grid, w, lay]) => ({ name, kind: "rig", cat: "Unarmored Chest Rigs", slots, grid, w, layout: layoutUrl("chest_rig", lay) })),
];
export const extraByName = n => EXTRA.find(x => x.name === n) || null;

// masks, gas masks, headsets, chest rigs and backpacks
export const EXTRA_KIND = { mask: "Face mask", gas: "Gas mask", headset: "Headset", pack: "Backpack", rig: "Chest rig" };
export const GEAR_CAT = { helmet: "Helmet", armor: "Body Armor", arig: "Armored Rig" };

// material, armor damage reduction %, durability lost on repair %
export const MATERIALS = [
  ["Aramid", 60, 4.5], ["Polyethylene", 55, 6], ["Titanium", 45, 8.5], ["Aluminum", 40, 8.9],
  ["Composite", 20, 11.9], ["Hardened Steel", 15, 14.5], ["Ceramic", 15, 18],
];
// name, durability in game, real durability, price (k)
export const VALUE = {
  T5: {
    Helmets: [["FA Assault", 50, 60, 242], ["03 Heavy", 45, 54, 365], ["SH 60", 50, 60, 152], ["SH Matzka", 65, 75, 304], ["AN95", 55, 80, 466], ["SH50", 60, 69, 145], ["RSP Heavy", 55, 66, 263]],
    "Armor rigs": [["Defender M4", 100, 115, 388], ["Warrior", 55, 66, 241], ["H-TAC A8", 60, 72, 205], ["H-TAC A9", 65, 75, 243]],
    Armor: [["H-LC", 70, 84, 339], ["926 Comp", 70, 84, 314], ["BT6", 90, 131, 699], ["Samurai", 70, 98, 380], ["Samurai Off", 80, 112, 500], ["Samurai Full", 90, 126, 457], ["Defender", 80, 92, 321], ["Brown Def", 80, 92, 326]],
  },
  T6: {
    Helmets: [["SH65 MIL", 65, 78, 718], ["HG84", 70, 84, 350], ["IND50", 60, 72, 662], ["DOD9 Blast", 75, 90, 845], ["AS200", 65, 101, 600], ["IND70 (moto)", 80, 124, 1326], ["RST Spec", 75, 105, 716], ["6BNT", 75, 87, 674]],
    "Armor rigs": [["Spartan C", 100, 115, 748], ["AL Command", 100, 115, 1014], ["AL Assault", 90, 108, 1039], ["AVS Heavy", 90, 104, 805], ["AL Tactical", 95, 110, 800]],
    Armor: [["BT201", 125, 175, 1420], ["6B45", 120, 138, 1200], ["Marshall", 115, 133, 1239], ["BT101", 100, 115, 1359], ["KN Comp", 110, 127, 1747]],
  },
};
