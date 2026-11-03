"""
デモ用のイメージ写真（Canva のAIで作成）を、アプリ同梱の public/demo/ に縮小・圧縮して置く。
使い方：python3 scripts/import-demo-photos.py <画像フォルダ>
  フォルダ内のファイル名に yakiniku / ramen / izakaya / cafe / bistro を含めておく。
  横1200px・WebP（画質80）に変換する。表示は店舗の cover_path に /demo/<名前>.webp を入れる。
"""
import sys, glob, os
from PIL import Image

NAMES = ["yakiniku", "ramen", "izakaya", "cafe", "bistro"]
src = sys.argv[1]
os.makedirs("public/demo", exist_ok=True)
for name in NAMES:
    files = [f for f in glob.glob(os.path.join(src, "*")) if name in os.path.basename(f).lower()]
    if not files:
        print("見つかりません:", name); continue
    im = Image.open(files[0]).convert("RGB")
    w = 1200
    im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    out = f"public/demo/{name}.webp"
    im.save(out, "WEBP", quality=80, method=6)
    print(out, im.size, os.path.getsize(out) // 1024, "KB")
