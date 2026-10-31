"""MAA の battle_data.json から名前表 data/names.json を生成する。

使い方: python -I tools/build_name_table.py <battle_data.json> --source "MAA v6.20.1 d94dd00"
"""
import argparse
import json
import sys

sys.stdout.reconfigure(encoding="utf-8")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("battle_data")
    parser.add_argument("--source", required=True)
    parser.add_argument("--out", default="data/names.json")
    args = parser.parse_args()

    with open(args.battle_data, encoding="utf-8") as f:
        chars = json.load(f)["chars"]

    # trap_ / token_ は配置できないので使わない
    rows = []
    for char_id in sorted(chars):
        if not char_id.startswith("char_"):
            continue
        c = chars[char_id]
        rows.append([
            char_id,
            c["name"],
            c["name_jp"],
            c["rarity"],
            not c.get("name_jp_unavailable", False),
        ])

    with open(args.out, "w", encoding="utf-8", newline="\n") as f:
        f.write("{\n")
        f.write('  "source": %s,\n' % json.dumps(args.source, ensure_ascii=False))
        f.write('  "chars": [\n')
        f.write(",\n".join("    " + json.dumps(r, ensure_ascii=False) for r in rows))
        f.write("\n  ]\n}\n")
    print("wrote %d chars to %s" % (len(rows), args.out))


main()
