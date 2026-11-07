from PIL import Image, ImageDraw
import math
import os

out = os.path.join(os.path.dirname(__file__), "fixtures")
os.makedirs(out, exist_ok=True)

for name, color, label in [
    ("fan-on.png", "#42e6bc", "RUNNING"),
    ("fan-off.png", "#ff7f89", "STOPPED"),
]:
    image = Image.new("RGB", (320, 200), "#0a1620")
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((8, 8, 311, 191), radius=18, outline="#29465c", width=2)
    cx, cy = 160, 88
    draw.ellipse((cx - 50, cy - 50, cx + 50, cy + 50), outline=color, width=4)
    draw.ellipse((cx - 16, cy - 16, cx + 16, cy + 16), fill=color)
    for angle in (0, 90, 180, 270):
        rad = math.radians(angle)
        x = cx + math.cos(rad) * 30
        y = cy + math.sin(rad) * 30
        draw.ellipse((x - 14, y - 14, x + 14, y + 14), fill=color)
    draw.text((22, 164), label, fill=color)
    image.save(os.path.join(out, name))
    print(os.path.join(out, name))
