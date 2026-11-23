/* WardOS Cinema Phase 1 asset pins.
   This is the only hash list. Wright swaps a final plate by editing the sha256
   here and replacing the file of the same name. Missing files stay pending.
   palette.json keeps the r2 hash and stays pending-confirm until Wright
   confirms it on the box. A file that is present with a different hash fails
   the pin test, except palette.json while its state is pending-confirm.
   UNVERIFIED-ASSETS: the VM does not have Prism's bytes. Do not invent hashes. */
(function (global) {
  "use strict";
  var PINS = [
    {
      file: "xmas-hero-loop-1920x1080-25s.mp4",
      sha256: "1c011db8381484968c58e0b1b3e5f7d520d56d3210eb6fae035c32659d55e59c",
      role: "loop",
      state: "pending-assets"
    },
    {
      file: "xmas-hero-plate-1920x1080-ungraded.png",
      sha256: "f3323f756a02c69b7c4f42a602358539ae9e71b66acb7e936ab4e25e099fd1ae",
      role: "ungraded",
      state: "pending-assets"
    },
    {
      file: "xmas-hero-fallback-1920x1080-graded.png",
      sha256: "f795c1ce37b3155e0e53a8b0348da806ac5b1d7f66ac737dcd6214a9113fce94",
      role: "fallback",
      state: "pending-assets"
    },
    {
      file: "wardos-xmas.cube",
      sha256: "6c0f149a15f0ca2e71d845e4c730c9ba59b1376f407eb5618dc0f13af4f74e0d",
      role: "lut",
      state: "pending-assets"
    },
    {
      file: "palette.json",
      sha256: "a05eae0059eef810a7aab91ff28a56b3a106caf83a456c73a703f4c152b33156",
      role: "palette",
      state: "pending-confirm",
      note: "r2 pin, pending until Wright confirms on the box"
    },
    {
      file: "glass-card-9slice-192.png",
      sha256: "c630f43eec72e392634d936dc55283de4fb997affc5db8c1e59f6f3c0f9d1a39",
      role: "glass",
      state: "pending-assets"
    }
  ];
  var api = { dir: "art/cinema/xmas-2026", status: "pending-assets", pins: PINS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.WARDOS_CINEMA_PINS = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
