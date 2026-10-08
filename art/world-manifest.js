/* One manifest per world. Drop high-res layers in
   plates/2026-10-05/ori-layers/<world>/<portrait|landscape>/<id>.png
   and they replace the stand-in. Real alpha. Original art only. */
(function (global) {
  var ROOT = "plates/2026-10-05/ori-layers";

  function layer(id, parallax, standin, extra) {
    var row = { id: id, parallax: parallax, standin: standin };
    if (extra) {
      for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) row[k] = extra[k];
    }
    return row;
  }

  /* Seven seats across four islands: ledges, a root, and a bridge.
     The creature stands lower-left, so Shower stays off its body. */
  var LEDGES = [
    { x: 0.16, y: 0.32, depth: 0.20, scale: 0.74 },
    { x: 0.80, y: 0.18, depth: 0.08, scale: 0.62 },
    { x: 0.76, y: 0.42, depth: 0.45, scale: 0.88 },
    { x: 0.50, y: 0.48, depth: 0.45, scale: 0.86 },
    { x: 0.46, y: 0.56, depth: 0.56, scale: 0.92 },
    { x: 0.58, y: 0.64, depth: 0.70, scale: 0.98 },
    { x: 0.36, y: 0.68, depth: 0.70, scale: 1.00 }
  ];
  var HAYES_SCENE = [
    { stamp: 1, x: 0.82, y: 0.20, scale: 0.40, depth: 0.08, haze: 0.58, flip: true },
    { stamp: 0, x: 0.16, y: 0.36, scale: 0.74, depth: 0.20, haze: 0.32 },
    { stamp: 2, x: 0.66, y: 0.44, scale: 1.02, depth: 0.45, haze: 0.10 },
    { stamp: 3, x: 0.40, y: 0.60, scale: 1.36, depth: 0.70, haze: 0 }
  ];

  /* Crops of the Hayes stand-in island sheet (1080×1920). A dropped
     plates/.../island-N.png replaces that crop with the whole file. */
  var HAYES_ISLANDS = [
    { id: "island-1", nx: 0.048, ny: 0.015, nw: 0.452, nh: 0.323, ledge: 0.30 },
    { id: "island-2", nx: 0.519, ny: 0.206, nw: 0.444, nh: 0.331, ledge: 0.30 },
    { id: "island-3", nx: 0.048, ny: 0.425, nw: 0.433, nh: 0.329, ledge: 0.30 },
    { id: "island-4", nx: 0.507, ny: 0.631, nw: 0.444, nh: 0.331, ledge: 0.30 }
  ];
  var FOREST_ISLAND = [
    { id: "island-1", nx: 0, ny: 0, nw: 1, nh: 1, ledge: 0.42 }
  ];

  global.HousePlates = {
    root: ROOT,
    hayes: {
      grade: "storm",
      layers: [
        layer("sky", 0.05, "art/hayes/sky.jpg"),
        layer("far", 0.16, "art/hayes/far.png"),
        layer("mid", 0.32, "art/hayes/mid.png"),
        layer("near", 0.52, "art/hayes/near.png"),
        layer("fg", 0.88, "art/hayes/fg.png", { blur: 3 })
      ],
      stamp: "art/hayes/mid.png",
      stamps: HAYES_ISLANDS,
      scene: HAYES_SCENE,
      rays: "art/forest/rays.jpg",
      ground: ["art/forest/near.png", "art/forest/fg.png"],
      landmarks: LEDGES
    },
    harris: {
      grade: "ore",
      layers: [
        layer("sky", 0.04, "art/forest/sky.jpg"),
        layer("far", 0.14, "art/forest/sky-soft.jpg"),
        layer("mid", 0.30, "art/forest/mid.png"),
        layer("near", 0.50, "art/forest/near.png"),
        layer("fg", 0.86, "art/forest/fg.png", { blur: 3 })
      ],
      stamp: "art/forest/island.png",
      stamps: [],
      rays: "art/forest/rays.jpg",
      ground: ["art/forest/near.png", "art/forest/fg.png"],
      landmarks: [
        { x: 0.22, y: 0.30, depth: 0.20, scale: 0.72, kind: "slab" },
        { x: 0.74, y: 0.28, depth: 0.16, scale: 0.68, kind: "crystal" },
        { x: 0.42, y: 0.40, depth: 0.34, scale: 0.82, kind: "cluster" },
        { x: 0.80, y: 0.48, depth: 0.42, scale: 0.86, kind: "geode" },
        { x: 0.18, y: 0.52, depth: 0.50, scale: 0.90, kind: "block" },
        { x: 0.56, y: 0.58, depth: 0.60, scale: 0.94, kind: "shard" },
        { x: 0.34, y: 0.66, depth: 0.72, scale: 1.00, kind: "node" }
      ]
    },
    ainsley: {
      grade: "dusk",
      layers: [
        layer("sky", 0.04, "art/forest/sky-soft.jpg"),
        layer("far", 0.12, "art/forest/sky.jpg"),
        layer("mid", 0.28, "art/forest/mid.png"),
        layer("near", 0.48, "art/forest/near.png"),
        layer("fg", 0.84, "art/forest/fg.png", { blur: 4 })
      ],
      stamp: "art/forest/island.png",
      stamps: [],
      rays: "art/forest/rays.jpg",
      ground: ["art/forest/near.png", "art/forest/fg.png"],
      landmarks: [
        { x: 0.18, y: 0.36, depth: 0.16, scale: 0.70, kind: "water" },
        { x: 0.78, y: 0.34, depth: 0.18, scale: 0.68, kind: "water" },
        { x: 0.46, y: 0.44, depth: 0.30, scale: 0.78, kind: "water" },
        { x: 0.20, y: 0.56, depth: 0.55, scale: 0.90, kind: "dock" },
        { x: 0.48, y: 0.60, depth: 0.62, scale: 0.94, kind: "dock" },
        { x: 0.76, y: 0.58, depth: 0.58, scale: 0.92, kind: "dock" },
        { x: 0.36, y: 0.68, depth: 0.74, scale: 1.00, kind: "dock" }
      ]
    },
    mercury: {
      grade: "grove",
      layers: [
        layer("sky", 0.04, "art/forest/sky.jpg"),
        layer("far", 0.12, "art/forest/sky-soft.jpg"),
        layer("mid", 0.28, "art/forest/mid.png"),
        layer("near", 0.46, "art/forest/near.png"),
        layer("fg", 0.72, "art/forest/fg.png")
      ],
      rays: "art/forest/rays.jpg"
    }
  };

  global.HousePlates.urlFor = function (world, id, orient, standin) {
    var base = ROOT + "/" + world + "/" + (orient || "portrait") + "/" + id + ".png";
    var flat = ROOT + "/" + world + "/" + id + ".png";
    return [base, flat, standin];
  };
})(window);
