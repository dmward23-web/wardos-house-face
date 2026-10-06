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

  /* Seven ledges. y is the sit line: under the header, above the creature. */
  var LEDGES = [
    { x: 0.20, y: 0.26, depth: 0.12, scale: 0.72 },
    { x: 0.80, y: 0.30, depth: 0.18, scale: 0.68 },
    { x: 0.17, y: 0.40, depth: 0.32, scale: 0.84 },
    { x: 0.83, y: 0.44, depth: 0.38, scale: 0.80 },
    { x: 0.22, y: 0.54, depth: 0.50, scale: 0.92 },
    { x: 0.78, y: 0.58, depth: 0.58, scale: 0.88 },
    { x: 0.48, y: 0.66, depth: 0.74, scale: 1.00 }
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
      stamps: FOREST_ISLAND,
      rays: "art/forest/rays.jpg",
      ground: ["art/forest/near.png", "art/forest/fg.png"],
      landmarks: LEDGES
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
      stamps: FOREST_ISLAND,
      rays: "art/forest/rays.jpg",
      ground: ["art/forest/near.png", "art/forest/fg.png"],
      landmarks: LEDGES
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
