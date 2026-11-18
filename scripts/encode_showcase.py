"""Turns the frames `pnpm showcase` recorded into the README's film.

    python3 scripts/encode_showcase.py

Reads var/showcase/frames.json and writes docs/assets/showcase.avif (1280 px,
25 fps) and docs/assets/showcase.webp (960 px, 20 fps, for browsers without
AVIF) with Pillow 11.3 or later, and var/showcase/showcase.webm (60 fps, VP9)
with the ffmpeg Playwright installs. Frames are taken at an even rate from
the moments Chrome painted them; the read-back plays at three times its speed.
"""

import bisect
import glob
import json
import os
import subprocess

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = os.path.join(ROOT, "var", "showcase")
ASSETS = os.path.join(ROOT, "docs", "assets")
SPEED = 3.0

recorded = json.load(open(os.path.join(SOURCE, "frames.json")))
frames = recorded["frames"]
marks = {mark["name"]: mark["at"] for mark in recorded["marks"]}
times = [frame["at"] for frame in frames]

start, end = marks["overview"] + 0.15, marks["end"] - 0.2
fast_from, fast_to = marks["again"] + 3.6, marks["read"] + 0.2
SEGMENTS = [(start, fast_from, 1.0), (fast_from, fast_to, SPEED), (fast_to, end, 1.0)]
LENGTH = sum((to - since) / speed for since, to, speed in SEGMENTS)


def source_time(at: float) -> float:
    """The moment of the recording shown at `at` seconds into the film."""
    for since, to, speed in SEGMENTS:
        span = (to - since) / speed
        if at <= span:
            return since + at * speed
        at -= span
    return end


def frame_at(at: float) -> str:
    index = max(bisect.bisect_right(times, source_time(at)) - 1, 0)
    return os.path.join(SOURCE, "frames", frames[index]["file"])


def film(path: str, fps: int, width: int, **options) -> None:
    height = round(width * 800 / 1280)
    images, last, current = [], None, None
    for index in range(int(LENGTH * fps)):
        name = frame_at(index / fps)
        if name != last:
            current = Image.open(name).convert("RGB").resize((width, height), Image.LANCZOS)
            last = name
        images.append(current)
    images[0].save(path, save_all=True, append_images=images[1:],
                   duration=round(1000 / fps), loop=0, **options)
    print(f"{path}: {len(images)} frames, {os.path.getsize(path) // 1024} KB")


def webm(path: str, fps: int = 60) -> None:
    ffmpeg = sorted(glob.glob(os.path.expanduser(
        "~/Library/Caches/ms-playwright/ffmpeg-*/ffmpeg-mac")))[-1]
    encoder = subprocess.Popen(
        [ffmpeg, "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", str(fps),
         "-c:v", "mjpeg", "-i", "pipe:0", "-c:v", "libvpx-vp9", "-crf", "20", "-b:v", "0",
         "-deadline", "good", "-cpu-used", "2", "-row-mt", "1", "-pix_fmt", "yuv420p", path],
        stdin=subprocess.PIPE)
    for index in range(int(LENGTH * fps)):
        with open(frame_at(index / fps), "rb") as frame:
            encoder.stdin.write(frame.read())
    encoder.stdin.close()
    encoder.wait()
    print(f"{path}: {os.path.getsize(path) // 1024} KB")


print(f"The film runs {LENGTH:.1f} s.")
film(os.path.join(ASSETS, "showcase.avif"), 25, 1280, quality=70, speed=6)
film(os.path.join(ASSETS, "showcase.webp"), 20, 960, quality=70, method=4, minimize_size=True)
webm(os.path.join(SOURCE, "showcase.webm"))
