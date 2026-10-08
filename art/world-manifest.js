/* Painted layers live in assets/ori/<world>/<portrait|landscape>/<id>.webp.
   Sky is an opaque matte. far/mid/near/fg are transparent.
   The old plates path stays as a fallback. Original art only. */
(function (global) {
  var ROOT = "plates/2026-10-05/ori-layers";

  function layer(id, parallax, standin, extra) {
    var row = { id: id, parallax: parallax, standin: standin };
    if (extra) {
      for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) row[k] = extra[k];
    }
    return row;
  }

  /* Seats are viewport fractions on painted mid/near land, spread
     in both axes. Depth matches the layer they sit on. */
  var LEDGES = [
    { x: 0.18, y: 0.26, depth: 0.35, scale: 1 },
    { x: 0.46, y: 0.34, depth: 0.35, scale: 1 },
    { x: 0.16, y: 0.42, depth: 0.35, scale: 1 },
    { x: 0.82, y: 0.46, depth: 0.35, scale: 1 },
    { x: 0.62, y: 0.52, depth: 0.35, scale: 1 },
    { x: 0.86, y: 0.58, depth: 0.35, scale: 1 },
    { x: 0.14, y: 0.70, depth: 0.60, scale: 1 }
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
        layer("far", 0.15, "art/hayes/far.png"),
        layer("mid", 0.35, "art/hayes/mid.png"),
        layer("near", 0.6, "art/hayes/near.png"),
        layer("fg", 1.0, "art/hayes/fg.png")
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
        layer("sky", 0.05, "art/forest/sky.jpg"),
        layer("far", 0.15, "art/forest/sky-soft.jpg"),
        layer("mid", 0.35, "art/forest/mid.png"),
        layer("near", 0.6, "art/forest/near.png"),
        layer("fg", 1.0, "art/forest/fg.png")
      ],
      stamp: "art/forest/island.png",
      stamps: [],
      rays: "art/forest/rays.jpg",
      ground: ["art/forest/near.png", "art/forest/fg.png"],
      landmarks: [
        { x: 0.34, y: 0.22, depth: 0.35, scale: 1, kind: "slab" },
        { x: 0.16, y: 0.32, depth: 0.35, scale: 1, kind: "crystal" },
        { x: 0.40, y: 0.30, depth: 0.35, scale: 1, kind: "cluster" },
        { x: 0.26, y: 0.38, depth: 0.35, scale: 1, kind: "geode" },
        { x: 0.84, y: 0.42, depth: 0.35, scale: 1, kind: "block" },
        { x: 0.72, y: 0.54, depth: 0.35, scale: 1, kind: "shard" },
        { x: 0.86, y: 0.58, depth: 0.35, scale: 1, kind: "node" }
      ]
    },
    ainsley: {
      grade: "dusk",
      layers: [
        layer("sky", 0.05, "art/forest/sky-soft.jpg"),
        layer("far", 0.15, "art/forest/sky.jpg"),
        layer("mid", 0.35, "art/forest/mid.png"),
        layer("near", 0.6, "art/forest/near.png"),
        layer("fg", 1.0, "art/forest/fg.png")
      ],
      stamp: "art/forest/island.png",
      stamps: [],
      rays: "art/forest/rays.jpg",
      ground: ["art/forest/near.png", "art/forest/fg.png"],
      landmarks: [
        { x: 0.60, y: 0.40, depth: 0.35, scale: 1, kind: "dock" },
        { x: 0.86, y: 0.46, depth: 0.35, scale: 1, kind: "dock" },
        { x: 0.50, y: 0.48, depth: 0.35, scale: 1, kind: "dock" },
        { x: 0.74, y: 0.54, depth: 0.35, scale: 1, kind: "dock" },
        { x: 0.18, y: 0.58, depth: 0.35, scale: 1, kind: "dock" },
        { x: 0.40, y: 0.58, depth: 0.35, scale: 1, kind: "dock" },
        { x: 0.86, y: 0.64, depth: 0.35, scale: 1, kind: "dock" }
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
    var o = orient || "portrait";
    var painted = "assets/ori/" + world + "/" + o + "/" + id + ".webp";
    var base = ROOT + "/" + world + "/" + o + "/" + id + ".png";
    var flat = ROOT + "/" + world + "/" + id + ".png";
    return [painted, base, flat, standin];
  };
})(window);
