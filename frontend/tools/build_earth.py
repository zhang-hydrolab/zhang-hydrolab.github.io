"""Build the Earth data behind the site's 3D views.

Everything the browser draws comes from here, and everything here is measured or computed:

  relief    Land elevation from the 1 km DEM, ocean shade from distance to the coast.
  rivers    A global river network. Water is routed over the DEM by least-cost flow
            (priority flood), with Natural Earth centrelines burned in so the main stems
            keep their true courses. River size is the long-term water balance,
            P - ET, accumulated downstream, using CRU TS precipitation and PML-V2.2 ET.
  scenes    Regional terrain blocks. Rivers are routed over a wider area than the block and
            cut at its edges, so that nothing drains along an edge that is not really there.

The inputs are large and local, so the outputs are committed to frontend/src/public/earth.
Run this only to change them:

    python frontend/tools/build_earth.py

Paths can be changed with --dem, --pml, --cru and --ne. Needs numpy, numba, scipy, xarray,
rasterio, pyshp and Pillow.
"""
import argparse
import glob
import json
import math
import os
import pathlib
import struct
import sys
import time

import numpy as np
import rasterio
import shapefile
import xarray as xr
from numba import njit
from PIL import Image, ImageDraw
from rasterio.enums import Resampling
from rasterio.windows import from_bounds
from scipy import ndimage

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "src" / "public" / "earth"
CACHE = ROOT / ".cache" / "earth"

CELL = 0.1
W, H = 3600, 1800
EARTH_KM = 6371.0
PERIOD = ("2001-01-01", "2020-12-31")

# Regional blocks: (lon0, lat0, lon1, lat1), the width of the height map in cells, and the share
# of cells kept as rivers.
SCENES = {
    "water": ((88.0, 23.0, 128.0, 37.0), 1024, 0.011),
    "hengduan": ((95.5, 24.5, 104.5, 32.0), 768, 0.02),
    "loess": ((104.0, 34.0, 113.5, 41.0), 768, 0.02),
    "qilian": ((95.0, 36.5, 104.0, 41.5), 768, 0.02),
    "gorges": ((105.5, 27.5, 113.5, 33.5), 768, 0.02),
    "snowy": ((144.0, -38.5, 151.5, -33.0), 768, 0.02),
    "alps": ((5.0, 43.5, 15.5, 49.0), 768, 0.02),
}

# Where the world's largest closed basins end. Routing would otherwise spill them over their
# rims and invent rivers. Deep pits in the DEM were checked against this list by hand, because
# a gorge narrower than a cell makes a false pit on a real river, such as the Danube's Iron Gates.
CLOSED_BASINS = {
    "Caspian lowland": (47.0, 45.5),
    "Aral": (59.5, 45.0),
    "Balkhash": (74.1, 45.8),
    "Issyk-Kul": (77.3, 42.4),
    "Ebinur": (83.1, 44.8),
    "Tarim": (89.4, 40.6),
    "Turpan": (94.6, 43.9),
    "Qaidam": (93.8, 37.9),
    "Qinghai": (100.2, 36.9),
    "Alxa": (104.6, 41.4),
    "Gobi": (110.2, 44.3),
    "Uvs": (93.2, 50.3),
    "Sistan": (61.6, 31.2),
    "Lut": (58.6, 30.3),
    "Kavir": (54.2, 34.8),
    "Mashkel": (63.1, 28.2),
    "Dead Sea": (35.5, 31.5),
    "Azraq": (37.4, 31.4),
    "Qattara": (26.7, 29.3),
    "Fezzan": (14.1, 27.4),
    "Algerian Sahara": (1.4, 26.3),
    "Chad": (14.6, 12.9),
    "Bodele": (18.2, 17.0),
    "Turkana": (36.1, 3.5),
    "Okavango": (23.0, -19.5),
    "Eyre": (137.4, -28.4),
    "Great Salt Lake": (-112.4, 40.9),
    "Carson": (-118.0, 39.8),
    "Uyuni": (-67.1, -20.6),
}

# Long-term discharge near the mouth, km3/yr, from the published syntheses of Dai & Trenberth
# (2002) and Milliman & Farnsworth (2011). Only used to report how the network compares.
MOUTHS = {
    "Amazon": (-51.0, -0.5, 6600),
    "Congo": (12.5, -6.0, 1300),
    "Ganges-Brahmaputra": (90.5, 22.5, 1100),
    "Orinoco": (-61.5, 9.0, 1100),
    "Yangtze": (121.0, 31.7, 900),
    "Parana": (-58.5, -34.0, 570),
    "Mississippi": (-89.5, 29.5, 610),
    "Yenisei": (82.5, 71.0, 620),
    "Lena": (127.0, 72.5, 530),
    "Mekong": (106.5, 10.0, 470),
    "Ob": (73.0, 68.0, 410),
    "Danube": (29.5, 45.2, 210),
    "Nile": (31.0, 31.0, 40),
    "Yellow": (119.0, 37.7, 40),
}


# ---- Inputs ---------------------------------------------------------------------------


def log(*args):
    print(f"[{time.strftime('%H:%M:%S')}]", *args, flush=True)


def cached(name, make):
    path = CACHE / f"{name}.npy"
    if path.exists():
        return np.load(path)
    value = make()
    CACHE.mkdir(parents=True, exist_ok=True)
    np.save(path, value)
    return value


def read_dem(path, shape=(H, W), bounds=(-180, -90, 180, 90), how=Resampling.min):
    """Elevation on a regular grid. The block minimum keeps valleys that a mean would close."""
    lon0, lat0, lon1, lat1 = bounds
    with rasterio.open(path) as src:
        window = from_bounds(lon0, lat0, lon1, lat1, src.transform)
        data = src.read(1, window=window, out_shape=shape, resampling=how, boundless=True, masked=True)
    return data.astype("float32").filled(np.nan)


def polygons(shp):
    """Rings of a polygon shapefile, as lists of (lon, lat)."""
    for shape in shapefile.Reader(shp).shapes():
        parts = list(shape.parts) + [len(shape.points)]
        for a, b in zip(parts, parts[1:]):
            yield shape.points[a:b]


def rasterise(rings, shape=(H, W), bounds=(-180, -90, 180, 90), scale=4):
    """Coverage of polygons, 0 to 1. Outer rings fill; holes are handled by the lakes layer."""
    h, w = shape[0] * scale, shape[1] * scale
    lon0, lat0, lon1, lat1 = bounds
    image = Image.new("L", (w, h), 0)
    draw = ImageDraw.Draw(image)
    for ring in rings:
        if signed_area(ring) > 0:  # Natural Earth: outer rings run clockwise, so negative.
            continue
        draw.polygon([((x - lon0) / (lon1 - lon0) * w, (lat1 - y) / (lat1 - lat0) * h) for x, y in ring], fill=255)
    grid = np.asarray(image, dtype="float32") / 255
    return grid.reshape(shape[0], scale, shape[1], scale).mean(axis=(1, 3))


def signed_area(ring):
    return sum(x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(ring, ring[1:]))


def burn_lines(shp, shape=(H, W), bounds=(-180, -90, 180, 90)):
    h, w = shape
    lon0, lat0, lon1, lat1 = bounds
    image = Image.new("L", (w, h), 0)
    draw = ImageDraw.Draw(image)
    for line in shapefile.Reader(shp).shapes():
        parts = list(line.parts) + [len(line.points)]
        for a, b in zip(parts, parts[1:]):
            points = [((x - lon0) / (lon1 - lon0) * w, (lat1 - y) / (lat1 - lat0) * h) for x, y in line.points[a:b]]
            draw.line(points, fill=255, width=1)
    return np.asarray(image) > 0


def climate(args):
    """Mean annual P and ET on the 0.1 degree grid, mm/yr, for the same years."""

    def et():
        total, years = np.zeros((1500, W), "float32"), set()
        for path in sorted(glob.glob(os.path.join(args.pml, "*.nc"))):
            ds = xr.open_dataset(path)
            # Two files repeat another year's data, so go by the time axis and not the name.
            year = int(ds.time.dt.year.values[0])
            if PERIOD[0][:4] <= str(year) <= PERIOD[1][:4] and year not in years:
                years.add(year)
                total += np.nan_to_num(ds.ET.sum("time", min_count=1).values.astype("float32"))
            ds.close()
        log(f"PML-V2.2 ET, {len(years)} years")
        out = np.zeros((H, W), "float32")
        out[:1500] = total / len(years)
        return out

    def precipitation():
        sets = [xr.open_dataset(p) for p in sorted(glob.glob(os.path.join(args.cru, "*.pre.dat.nc")))]
        pre = xr.concat(sets, "time").pre.sel(time=slice(*PERIOD))
        mean = (pre.groupby("time.year").sum("time", min_count=12)).mean("year")
        log(f"CRU TS precipitation, {pre.time.size} months")
        grid = mean.sel(lat=slice(None, None, -1)).values.astype("float32")  # North up.
        mask = np.isfinite(grid)
        # Spread the land values over the coast, so 0.1 degree cells near the sea have a value.
        index = ndimage.distance_transform_edt(~mask, return_distances=False, return_indices=True)
        filled = grid[tuple(index)]
        return ndimage.zoom(filled, 5, order=1, mode="nearest", grid_mode=True).astype("float32")

    return cached("pre", precipitation), cached("et", et)


# ---- Routing ----------------------------------------------------------------------------


@njit(cache=True)
def _sift_up(key, item, i):
    k, v = key[i], item[i]
    while i > 0:
        up = (i - 1) >> 1
        if key[up] <= k:
            break
        key[i], item[i] = key[up], item[up]
        i = up
    key[i], item[i] = k, v


@njit(cache=True)
def _sift_down(key, item, n):
    k, v = key[n], item[n]
    i = 0
    while True:
        child = 2 * i + 1
        if child >= n:
            break
        if child + 1 < n and key[child + 1] < key[child]:
            child += 1
        if key[child] >= k:
            break
        key[i], item[i] = key[child], item[child]
        i = child
    key[i], item[i] = k, v


@njit(cache=True)
def route(z, water, sinks, jitter, wrap):
    """Priority flood from every outlet. Each cell drains to the cell that reached it.

    z       elevation, may be NaN on cells that do not take part
    water   cells that receive water but do not drain: the sea
    sinks   extra outlets, such as the floor of an inland basin
    jitter  tiny noise, so that ties on flat ground do not all run in straight lines
    Returns the receiver of each cell (-1 for an outlet), the visiting order, and the fill.
    """
    h, w = z.shape
    n = h * w
    parent = np.full(n, -2, np.int64)
    filled = np.full(n, np.nan, np.float32)
    order = np.empty(n, np.int64)
    key = np.empty(n + 1, np.float64)
    item = np.empty(n + 1, np.int64)
    size = 0
    count = 0
    di = (-1, -1, -1, 0, 0, 1, 1, 1)
    dj = (-1, 0, 1, -1, 1, -1, 0, 1)

    for i in range(h):
        for j in range(w):
            c = i * w + j
            if sinks[i, j]:
                seed = True
            elif water[i, j]:
                continue
            elif np.isnan(z[i, j]):
                continue
            else:
                seed = False
                for d in range(8):
                    ii, jj = i + di[d], j + dj[d]
                    if ii < 0 or ii >= h:
                        continue
                    if jj < 0 or jj >= w:
                        if not wrap:
                            seed = True
                            break
                        jj %= w
                    if water[ii, jj] or np.isnan(z[ii, jj]):
                        seed = True
                        break
            if seed:
                parent[c] = -1
                filled[c] = z[i, j]
                key[size] = z[i, j]
                item[size] = c
                _sift_up(key, item, size)
                size += 1

    while size > 0:
        c = item[0]
        level = float(filled[c])
        size -= 1
        if size > 0:
            key[0], item[0] = key[size], item[size]
            key_top, item_top = key[0], item[0]
            key[size], item[size] = key_top, item_top
            _sift_down(key, item, size)
        order[count] = c
        count += 1
        i, j = c // w, c % w
        for d in range(8):
            ii, jj = i + di[d], j + dj[d]
            if ii < 0 or ii >= h:
                continue
            if jj < 0 or jj >= w:
                if not wrap:
                    continue
                jj %= w
            b = ii * w + jj
            if parent[b] != -2 or water[ii, jj] or np.isnan(z[ii, jj]):
                continue
            parent[b] = c
            filled[b] = max(z[ii, jj], level)
            key[size] = filled[b] + jitter[ii, jj]
            item[size] = b
            _sift_up(key, item, size)
            size += 1
    return parent, order[:count], filled


@njit(cache=True)
def accumulate(parent, order, weight):
    """Sum what enters each cell, working from the headwaters down."""
    total = weight.copy()
    for k in range(len(order) - 1, -1, -1):
        c = order[k]
        p = parent[c]
        if p >= 0:
            total[p] += total[c]
    return total


@njit(cache=True)
def distance_to_mouth(parent, order, w, lat, cell_km):
    """Length of the path to the outlet, km, from the outlet up."""
    out = np.zeros(len(parent), np.float32)
    for k in range(len(order)):
        c = order[k]
        p = parent[c]
        if p < 0:
            continue
        i0, j0 = c // w, c % w
        i1, j1 = p // w, p % w
        dj = abs(j0 - j1)
        if dj > w // 2:
            dj = w - dj
        dx = dj * cell_km * np.cos(np.deg2rad(lat[i0]))
        dy = abs(i0 - i1) * cell_km
        out[c] = out[p] + np.sqrt(dx * dx + dy * dy)
    return out


def closed_basins():
    """Terminal lakes and pans, which take the water of inland basins."""
    sinks = np.zeros((H, W), bool)
    for lon, lat in CLOSED_BASINS.values():
        sinks[int((90 - lat) / CELL), int((lon + 180) / CELL)] = True
    return sinks


# ---- Network ----------------------------------------------------------------------------


def smooth(points, passes=2):
    """Take the stair steps out of a grid path, keeping its two ends."""
    points = np.asarray(points, float)
    for _ in range(passes):
        if len(points) < 3:
            break
        inner = (points[:-2] + 2 * points[1:-1] + points[2:]) / 4
        points = np.vstack([points[0], inner, points[-1]])
    return points


def simplify(points, tolerance):
    """Douglas-Peucker, returning the indices kept."""
    keep = np.zeros(len(points), bool)
    keep[[0, -1]] = True
    stack = [(0, len(points) - 1)]
    while stack:
        a, b = stack.pop()
        if b <= a + 1:
            continue
        chord = points[b] - points[a]
        length = math.hypot(*chord) or 1e-9
        offsets = np.abs(chord[0] * (points[a + 1:b, 1] - points[a, 1]) - chord[1] * (points[a + 1:b, 0] - points[a, 0])) / length
        worst = int(np.argmax(offsets))
        if offsets[worst] > tolerance:
            cut = a + 1 + worst
            keep[cut] = True
            stack += [(a, cut), (cut, b)]
    return np.flatnonzero(keep)


def extract(parent, flow, dist, shape, threshold, to_lonlat, tolerance, passes=2):
    """Cut the kept cells into polylines that run downstream, from a head to a junction."""
    h, w = shape
    kept = flow >= threshold
    ups = np.zeros(h * w, np.int32)
    cells = np.flatnonzero(kept)
    receivers = parent[cells]
    good = receivers >= 0
    np.add.at(ups, receivers[good], 1)
    junction = (ups != 1) & kept

    lines = []
    for start in cells[(ups[cells] == 0) | (ups[cells] > 1)]:
        path = [int(start)]
        c = int(parent[start])
        while c >= 0 and kept[c]:
            path.append(c)
            if junction[c]:
                break
            c = int(parent[c])
        if len(path) < 2:
            continue
        ids = np.array(path)
        xy = to_lonlat(ids)
        # A path across the date line stays continuous in longitude until it is written out.
        xy[:, 0] = np.rad2deg(np.unwrap(np.deg2rad(xy[:, 0])))
        d = dist[ids].astype(float)
        xy = smooth(xy, passes)
        keep = simplify(xy, tolerance)
        lines.append((float(flow[ids].max()), xy[keep], d[keep]))
    lines.sort(key=lambda item: -item[0])
    return lines


def varint(value):
    value = (value << 1) ^ (value >> 63)  # Zigzag
    out = bytearray()
    while True:
        byte = value & 0x7F
        value >>= 7
        if value:
            out.append(byte | 0x80)
        else:
            out.append(byte)
            return out


def encode_lines(lines, grade, header=b""):
    """Rivers as a compact stream: largest first, so a part of the file is already a map.

    Each line is its point count, its grade (1 to 255), then lon, lat and distance as
    differences from the previous point, in 0.01 degrees and km.
    """
    body = bytearray()
    points = 0
    for flow, xy, d in lines:
        body += varint(len(xy))
        body.append(grade(flow))
        last = [0, 0, 0]
        for (lon, lat), km in zip(xy, d):
            now = [round(lon * 100), round(lat * 100), round(km)]
            for a, b in zip(now, last):
                body += varint(a - b)
            last = now
        points += len(xy)
    return struct.pack("<II", len(lines), points) + header + bytes(body), points


# ---- Outputs ----------------------------------------------------------------------------


def to_gray(value, path, quality=90):
    Image.fromarray(np.uint8(np.clip(value, 0, 1) * 255 + 0.5), "L").save(path, "WEBP", quality=quality, method=6)
    return os.path.getsize(path)


def relief_texture(dem, land, lakes, shape=(1024, 2048)):
    """One channel holds both surfaces, split at 0.38 so the browser can find the coast.

    Land runs from 0.46 upward with the square root of elevation. Water runs from 0.30 at the
    shore to 0 at 1500 km offshore, which is what shades the sea.
    """
    height, width = shape
    # Small islands would ring themselves with pale water, so only large coasts shade the sea.
    coasts = ndimage.binary_opening(land >= 0.5, structure=np.ones((3, 3)), iterations=9)
    water_km = ndimage.distance_transform_edt(~coasts) * CELL * 111.2
    ocean = np.clip(1 - water_km / 1500, 0, 1) ** 1.5 * 0.30

    # The DEM ends at 55.6 S, and everything south of that is Antarctic ice.
    ground = np.nan_to_num(dem, nan=0)
    south = np.arange(H) * CELL - 90 + CELL / 2 > 55.6
    ground[south] = 2200
    elevated = 0.46 + 0.54 * np.sqrt(np.clip(ground, 0, 7000) / 7000)

    def block(grid):
        return np.asarray(Image.fromarray(grid.astype("float32"), "F").resize((width, height), Image.BOX))

    coverage = block(np.clip(land - lakes, 0, 1))
    return (1 - coverage) * block(ocean) + coverage * block(elevated)


def map_layer(value, name, ramp=((1, 1, 1), (0.82, 0.90, 0.96), (0.42, 0.66, 0.86), (0.06, 0.30, 0.51)), mask=None):
    """A world map in the site's blues, 720 by 280, from 60 S to 80 N."""
    top, bottom = int((90 - 80) / CELL), int((90 + 60) / CELL)
    grid = np.clip(value[top:bottom], 0, 1)
    stops = np.linspace(0, 1, len(ramp))
    rgb = np.stack([np.interp(grid, stops, [c[k] for c in ramp]) for k in range(3)], axis=-1)
    if mask is not None:
        rgb[~mask[top:bottom]] = (0.955, 0.972, 0.986)
    image = Image.fromarray(np.uint8(rgb * 255 + 0.5), "RGB").resize((720, 280), Image.LANCZOS)
    image.save(OUT / f"layer-{name}.webp", "WEBP", quality=82, method=6)


def build_layers(dem, land, pre, et, lines):
    on_land = land >= 0.5
    map_layer(np.sqrt(np.clip(np.nan_to_num(dem), 0, 6500) / 6500), "dem", mask=on_land)
    map_layer(np.sqrt(np.clip(pre, 0, 3200) / 3200), "pre", mask=on_land)
    map_layer(np.clip(et, 0, 1500) / 1500, "et", mask=on_land)

    # Rivers are drawn at twice the size and reduced, so thin ones stay as fine lines.
    scale = 2
    width, height = 720 * scale, 280 * scale
    image = Image.new("L", (width, height), 0)
    draw = ImageDraw.Draw(image)
    for flow, xy, _ in reversed(lines):
        points = [((((lon + 180) % 360) / 360 * width), ((80 - lat) / 140 * height)) for lon, lat in xy]
        for a, b in zip(points, points[1:]):
            if abs(a[0] - b[0]) < width / 2:
                draw.line([a, b], fill=255, width=max(1, round(math.log10(flow / 1.2) * 1.15)))
    ink = np.asarray(image.resize((720, 280), Image.LANCZOS), "float32") / 255
    paper = np.asarray(Image.fromarray(np.uint8(on_land[100:1500] * 255)).resize((720, 280), Image.BOX), "float32") / 255
    base = np.stack([0.955 + 0.04 * paper, 0.972 + 0.025 * paper, 0.986 + 0.014 * paper], axis=-1)
    colour = np.array([0.06, 0.30, 0.51])
    rgb = base * (1 - ink[..., None]) + colour * ink[..., None]
    Image.fromarray(np.uint8(rgb * 255 + 0.5), "RGB").save(OUT / "layer-river.webp", "WEBP", quality=82, method=6)


def build_global(args, pre, et):
    dem = cached("dem", lambda: read_dem(args.dem))
    land = cached("land", lambda: rasterise(polygons(f"{args.ne}/ne_50m_land.shp")))
    lakes = cached("lakes", lambda: rasterise(polygons(f"{args.ne}/ne_50m_lakes.shp")))
    burn = burn_lines(f"{args.ne}/ne_50m_rivers_lake_centerlines.shp")
    log("inputs ready")

    sea = land < 0.5
    ground = np.where(sea, np.nan, np.nan_to_num(dem, nan=0)).astype("float32")
    ground[burn & ~sea] -= 1000.0
    jitter = np.random.default_rng(7).random((H, W), "float32") * 0.6

    parent, order, _ = route(ground, sea, closed_basins(), jitter, True)

    lat = 90 - (np.arange(H) + 0.5) * CELL
    cell_km = EARTH_KM * math.radians(CELL)
    area = (cell_km * cell_km * np.cos(np.deg2rad(lat)))[:, None] * np.ones((1, W))
    runoff = np.clip(pre - et, 0, None)
    runoff[sea] = 0
    runoff[:, :][np.arange(H) >= 1500] = 0  # PML-V2.2 stops at 60 S; there are no rivers there.
    km3 = (runoff * area * 1e-6).astype("float64").ravel()  # mm km2 to km3

    flow = accumulate(parent, order, km3)
    dist = distance_to_mouth(parent, order, W, lat, cell_km)
    total = km3.sum()
    log(f"global land P-ET: {total / 1000:.1f} thousand km3/yr, on land {land.mean() * 510:.0f} M km2")

    report = {}
    for name, (lon, lat0, reference) in MOUTHS.items():
        j, i = int((lon + 180) / CELL), int((90 - lat0) / CELL)
        box = flow.reshape(H, W)[max(i - 25, 0) : i + 25, max(j - 25, 0) : j + 25]
        report[name] = (round(float(box.max())), reference)
    log("river mouths, network vs published km3/yr:", report)

    def to_lonlat(ids):
        i, j = ids // W, ids % W
        return np.column_stack([-180 + (j + 0.5) * CELL, 90 - (i + 0.5) * CELL])

    lines = extract(parent, flow, dist, (H, W), args.threshold, to_lonlat, args.tolerance)
    top = max(math.log10(line[0]) for line in lines)
    low = math.log10(args.threshold)
    grade = lambda f: int(1 + 254 * (math.log10(f) - low) / (top - low))
    blob, points = encode_lines(lines, grade)
    (OUT / "rivers.bin").write_bytes(blob)
    log(f"rivers: {len(lines)} lines, {points} points, {len(blob) / 1024:.0f} KB")

    build_layers(dem, land, pre, et, lines)
    size = to_gray(relief_texture(dem, land, lakes), OUT / "relief.webp", 96)
    log(f"relief: {size / 1024:.0f} KB")
    return {"rivers": {"lines": len(lines), "points": points}, "total_p_et": round(total / 1000, 1), "mouths": report}


def build_scene(args, name, bounds, width, density, pre, et):
    lon0, lat0, lon1, lat1 = bounds
    height = round(width * (lat1 - lat0) / (lon1 - lon0) / math.cos(math.radians((lat0 + lat1) / 2)))
    if height % 2:
        height += 1
    shape = (height, width)
    mean = read_dem(args.dem, shape, bounds, Resampling.average)
    land = rasterise(polygons(f"{args.ne}/ne_50m_land.shp"), shape, bounds, 3)
    lakes = rasterise(polygons(f"{args.ne}/ne_50m_lakes.shp"), shape, bounds, 3)
    sea = land < 0.5

    # Water is routed over a wider area than the block shows. Otherwise everything near an edge
    # would drain to that edge and run along it.
    pad_x, pad_y = round(width * 0.2), round(height * 0.2)
    dlat = (lat1 - lat0) / height
    dlon = (lon1 - lon0) / width
    wide = (lon0 - pad_x * dlon, lat0 - pad_y * dlat, lon1 + pad_x * dlon, lat1 + pad_y * dlat)
    wide_shape = (height + 2 * pad_y, width + 2 * pad_x)
    low = read_dem(args.dem, wide_shape, wide, Resampling.min)
    wide_sea = rasterise(polygons(f"{args.ne}/ne_50m_land.shp"), wide_shape, wide, 3) < 0.5
    ground = np.where(wide_sea, np.nan, np.nan_to_num(low, nan=0)).astype("float32")
    jitter = np.random.default_rng(11).random(wide_shape, "float32") * 0.5
    parent, order, _ = route(ground, wide_sea, np.zeros(wide_shape, bool), jitter, False)

    lats = wide[3] - (np.arange(wide_shape[0]) + 0.5) * dlat
    lons = wide[0] + (np.arange(wide_shape[1]) + 0.5) * dlon
    i = np.clip(((90 - lats) / CELL).astype(int), 0, H - 1)
    j = np.clip(((lons + 180) / CELL).astype(int), 0, W - 1)
    runoff = np.clip(pre - et, 0, None)[np.ix_(i, j)]
    cell_km = EARTH_KM * math.radians(dlat)
    area = cell_km * cell_km * (dlon / dlat) * np.cos(np.deg2rad(lats))[:, None]
    weight = (np.maximum(runoff, 30) * area * 1e-6).astype("float64").ravel()
    weight[wide_sea.ravel()] = 0
    flow = accumulate(parent, order, weight)
    dist = distance_to_mouth(parent, order, wide_shape[1], lats, cell_km)

    def to_lonlat(ids):
        return np.column_stack([lons[ids % wide_shape[1]], lats[ids // wide_shape[1]]])

    inside = np.zeros(wide_shape, bool)
    inside[pad_y : pad_y + height, pad_x : pad_x + width] = True
    threshold = float(np.quantile(flow[inside.ravel() & (flow > 0)], 1 - density))
    routed = extract(parent, flow, dist, wide_shape, threshold, to_lonlat, dlat * 0.7, passes=6)

    # Only the reaches on the block are kept, cut where they leave it.
    lines = []
    for peak, xy, d in routed:
        on = (xy[:, 0] >= lon0) & (xy[:, 0] <= lon1) & (xy[:, 1] >= lat0) & (xy[:, 1] <= lat1)
        start = None
        for k, here in enumerate(list(on) + [False]):
            if here and start is None:
                start = k
            elif not here and start is not None:
                if k - start >= 2:
                    lines.append((peak, xy[start:k], d[start:k]))
                start = None
    top = max(math.log10(line[0]) for line in lines)
    base = math.log10(threshold)
    grade = lambda f: int(1 + 254 * (math.log10(f) - base) / (top - base))

    surface = np.nan_to_num(mean, nan=0)
    surface[sea] = 0
    h_min, h_max = float(surface[~sea].min()), float(np.percentile(surface, 99.98))
    scale = np.sqrt(np.clip(surface - h_min, 0, None) / (h_max - h_min))
    coast = np.clip(land - lakes, 0, 1)
    packed = 0.04 + 0.96 * scale
    packed = packed * coast  # Zero on the sea and on lakes.
    size = to_gray(packed, OUT / f"{name}.webp", args.quality)

    header = struct.pack("<6f", lon0, lat0, lon1, lat1, h_min, h_max)
    blob, points = encode_lines(lines, grade, header)
    (OUT / f"{name}.bin").write_bytes(blob)
    log(f"scene {name}: {width}x{height}, {size / 1024:.0f} KB height, {len(lines)} rivers, {points} points, {len(blob) / 1024:.0f} KB")


def main():
    home = pathlib.Path.home() / ".local/share/cartopy/shapefiles/natural_earth/physical"
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dem", default="G:/DEM/dem_1000m_epsg4326.tif")
    parser.add_argument("--pml", default="G:/PML_v2_0.1deg")
    parser.add_argument("--cru", default="G:/CRU_TS_4.09")
    parser.add_argument("--ne", default=str(home))
    parser.add_argument("--threshold", type=float, default=1.2, help="smallest river kept, km3/yr")
    parser.add_argument("--tolerance", type=float, default=0.045, help="line simplification, degrees")
    parser.add_argument("--quality", type=int, default=90)
    parser.add_argument("--only", nargs="*", help="build only these: global, or scene names")
    args = parser.parse_args()

    OUT.mkdir(parents=True, exist_ok=True)
    pre, et = climate(args)
    log(f"mean over land cells: P {np.nanmean(pre):.0f}, ET {np.nanmean(et):.0f}")
    wanted = args.only
    if not wanted or "global" in wanted:
        summary = build_global(args, pre, et)
        print(json.dumps(summary, ensure_ascii=False))
    for name, (bounds, width, density) in SCENES.items():
        if not wanted or name in wanted:
            build_scene(args, name, bounds, width, density, pre, et)


if __name__ == "__main__":
    sys.exit(main())
