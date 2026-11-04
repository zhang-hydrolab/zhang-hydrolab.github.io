"""Build the land outlines of the flat world map on the collaboration page.

The map is an Equal Earth projection centred on the Pacific (150° E), so that Beijing, Europe,
North America and Australia all fall inside the frame and no line to a collaborator crosses the
edge. This script cuts Natural Earth's 1:110 m land polygons at 30° W, the edge of that frame,
shifts the western part by 360°, simplifies them a little and writes longitude and latitude
pairs. The page projects them at build time (src/lib/equal-earth.mjs).

Coastlines only: the map draws no country borders.

    python frontend/tools/build_worldmap.py [--ne path/to/ne_110m_land.shp]

Needs pyshp and shapely. The output is committed, so run this only to change the map.
"""
import argparse
import json
import pathlib

import shapefile
from shapely.geometry import box, shape
from shapely.ops import unary_union
from shapely.affinity import translate

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE.parent / "src" / "data" / "land.json"
DEFAULT_NE = pathlib.Path.home() / ".local/share/cartopy/shapefiles/natural_earth/physical/ne_110m_land.shp"

CENTRE = 150.0
EDGE = CENTRE - 180.0  # 30° W
TOLERANCE = 0.12  # degrees
MIN_AREA = 0.6  # square degrees; drops the smallest islands


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--ne", type=pathlib.Path, default=DEFAULT_NE)
    args = parser.parse_args()

    land = unary_union([shape(s.__geo_interface__) for s in shapefile.Reader(str(args.ne)).shapes()])
    west = land.intersection(box(-180, -90, EDGE, 90))
    east = land.intersection(box(EDGE, -90, 180, 90))
    land = unary_union([east, translate(west, xoff=360)]).simplify(TOLERANCE, preserve_topology=True)

    rings = []
    polygons = getattr(land, "geoms", [land])
    for polygon in polygons:
        if polygon.area < MIN_AREA:
            continue
        for ring in [polygon.exterior, *polygon.interiors]:
            flat = []
            for lon, lat in ring.coords:
                flat += [round(lon, 2), round(lat, 2)]
            rings.append(flat)

    OUT.write_text(
        json.dumps(
            {
                "source": "Natural Earth 1:110m land, public domain",
                "centre": CENTRE,
                "rings": rings,
            },
            separators=(",", ":"),
        ),
        encoding="utf-8",
    )
    print(f"{OUT}: {len(rings)} rings, {sum(len(r) for r in rings) // 2} points, {OUT.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
