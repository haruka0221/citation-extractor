#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

# 1) 触らない保護パターン（必要に応じて追加）
PROTECT_REGEX='(^|/)(\.git|old_cache)(/|$)|(^|/)(index\.html|index\.htm)$|(^|/)(app\.js)$|(^|/)(styles\.css)$|(^|/)(full-text-viewer\.(js|css))$|(^|/)(citation-.*\.js)$|(^|/)(csv-catalog-system\.js)$|(^|/)(ExtendedCSVCatalogSystem\.js)$|(^|/)(gutenberg-config\.js)$|(^|/)(gutenberg_feeds/pg_catalog\.csv)$'

# 2) 全ファイル一覧（.git と old_cache は除外）
mapfile -t ALL < <(find . -type f -not -path "./.git/*" -not -path "./old_cache/*" | sed 's|^\./||')

# 3) 参照インデックス作成：コード中の参照文字列（パス/ベース名/import/fetch/src/href 等）を抽出
#    ripgrepが無くても動くように grep -r を使用
REF_TMP="$(mktemp)"
# よくある参照トークンを全部拾う（ゆるめ）
grep -RInE --exclude-dir=".git|old_cache" \
  -e 'src=["'\'']([^"'\'']+)["'\'']' \
  -e 'href=["'\'']([^"'\'']+)["'\'']' \
  -e 'fetch\(["'\'']([^"'\'']+)["'\'']' \
  -e 'import .* from ["'\'']([^"'\'']+)["'\'']' \
  -e 'Papa\.parse\(["'\'']([^"'\'']+)["'\'']' \
  -e 'open\(["'\'']([^"'\'']+)["'\'']' \
  -n . 2>/dev/null \
| sed -E 's/.*["'\'']([^"'\'']+)["'\''].*/\1/' \
| sed 's|^[./]*||' \
| sort -u > "$REF_TMP"

# ベースネーム（ファイル名だけ）も参照対象とみなす
BN_TMP="$(mktemp)"
awk -F/ '{print $NF}' "$REF_TMP" | sort -u > "$BN_TMP"

# 4) 候補抽出：どのファイル名（相対パス or ベース名）でも一度も出現しないもの
CANDIDATES=()
for p in "${ALL[@]}"; do
  # 保護対象はスキップ
  if [[ "$p" =~ $PROTECT_REGEX ]]; then
    continue
  fi
  bn="$(basename "$p")"
  path_ref=$(grep -F -x -i -- "$p" "$REF_TMP" || true)
  bn_ref=$(grep -F -x -i -- "$bn" "$BN_TMP" || true)
  if [[ -z "$path_ref" && -z "$bn_ref" ]]; then
    CANDIDATES+=("$p")
  fi
done

mode="${1:-dry-run}"
stamp="$(date +%Y%m%d-%H%M%S)"
bucket="old_cache/pruned-$stamp"

case "$mode" in
  dry-run)
    echo "=== 参照なし候補（ドライラン）==="
    printf '%s\n' "${CANDIDATES[@]}" | sort
    echo "-----------------------------------"
    echo "対象数: ${#CANDIDATES[@]}"
    echo "※ 実際には移動しません。問題なければ 'bash safe_prune.sh move' を実行してください。"
    ;;
  move)
    mkdir -p "$bucket"
    for p in "${CANDIDATES[@]}"; do
      dir="$(dirname "$p")"
      mkdir -p "$bucket/$dir"
      git mv -f "$p" "$bucket/$p" 2>/dev/null || mv -f "$p" "$bucket/$p"
    done
    echo "=== 隔離完了 ==="
    echo "移動先: $bucket"
    echo "問題があれば 'bash safe_prune.sh restore last' で直前の隔離分を戻せます。"
    ;;
  restore)
    target="${2:-last}"
    if [[ "$target" == "last" ]]; then
      last="$(ls -1dt old_cache/pruned-* 2>/dev/null | head -n1 || true)"
      [[ -z "$last" ]] && { echo "復元対象が見つかりません"; exit 1; }
      restore_dir="$last"
    else
      restore_dir="$target"
    fi
    echo "復元: $restore_dir → プロジェクト直下"
    shopt -s dotglob
    # 中身を元の場所へ
    for f in "$restore_dir"/*; do
      # ディレクトリ構造を保って戻す
      rel="${f#"$restore_dir/"}"
      dest_dir="$(dirname "$rel")"
      mkdir -p "$dest_dir"
      git mv -f "$f" "$rel" 2>/dev/null || mv -f "$f" "$rel"
    done
    rmdir "$restore_dir" 2>/dev/null || true
    echo "復元完了"
    ;;
  *)
    echo "使い方: bash safe_prune.sh [dry-run|move|restore [last|DIR]]"
    exit 1
    ;;
esac

rm -f "$REF_TMP" "$BN_TMP"
