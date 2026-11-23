/* WardOS Cinema Phase 1 asset pins.
   This is the only hash list. Wright swaps a final plate by editing the sha256
   here and replacing the file of the same name. Missing files stay pending.
   palette.json keeps the r2 hash and stays pending-confirm until Wright
   confirms it on the box. A file that is present with a different hash fails
   the pin test, except palette.json while its state is pending-confirm.
   Nov 23 2026: Prism FINAL bytes added on the box by Wright; every pin verified. */
(function (global) {
  "use strict";
  var PINS = [
    {
      file: "xmas-hero-loop-1920x1080-25s.mp4",
      sha256: "1c011db8381484968c58e0b1b3e5f7d520d56d3210eb6fae035c32659d55e59c",
      role: "loop",
      state: "verified"
    },
    {
      file: "xmas-hero-plate-1920x1080-ungraded.png",
      sha256: "f3323f756a02c69b7c4f42a602358539ae9e71b66acb7e936ab4e25e099fd1ae",
      role: "ungraded",
      state: "verified"
    },
    {
      file: "xmas-hero-fallback-1920x1080-graded.png",
      sha256: "f795c1ce37b3155e0e53a8b0348da806ac5b1d7f66ac737dcd6214a9113fce94",
      role: "fallback",
      state: "verified"
    },
    {
      file: "wardos-xmas.cube",
      sha256: "5bd8ac9135fc12099aa18863e5e6f32b6a02a99ee20d2368b333c30f17e4e518",
      role: "lut",
      state: "verified"
    },
    {
      file: "palette.json",
      sha256: "a05eae0059eef810a7aab91ff28a56b3a106caf83a456c73a703f4c152b33156",
      role: "palette",
      state: "verified",
      note: "confirmed unchanged in Prism FINAL by Wright on the box, Nov 23 2026"
    },
    {
      file: "glass-card-9slice-192.png",
      sha256: "c630f43eec72e392634d936dc55283de4fb997affc5db8c1e59f6f3c0f9d1a39",
      role: "glass",
      state: "verified"
    },
    {
      file: "window-pane-alpha-1920x1080.png",
      sha256: "41280f2f4ff3f6731ecf270193339638a0d5b8bff15c5d94e557ff0a3322829c",
      role: "paneMask",
      state: "verified",
      note: "Prism pane alpha (white = glass), Nov 23 2026; drives cinema GL and coat snow"
    }
  ];
  var api = { dir: "art/cinema/xmas-2026", status: "verified", pins: PINS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.WARDOS_CINEMA_PINS = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
