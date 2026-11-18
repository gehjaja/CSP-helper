#!/usr/bin/env bash
# 逐字比对 40 份参考程序与全部样例。
#
# 为什么需要这个脚本：
#   tests/bank.cjs 在设置 CXX 时也会编译并跑样例，但它按空白切分、把 token
#   转成数字后用 1e-4 容差比较。这个比较方式**放过了输出格式上的矛盾**
#   （例如样例期望 "0"、程序实际输出 "0.0000000000"），所以它既无法发现
#   题库版本 2026.11.16.2 里的两处问题，也无法用来证明修补有效。
#
# 比较规则（输入/期望两侧施加完全相同的规范化，没有单侧特例）：
#   1. 删除所有 CR 字符（兼容 CRLF 检出的文件）；
#   2. 删除每行行尾的空白字符（空格与制表符）；
#   3. 忽略文本末尾的空行。
#   规范化之后要求整段字符串相等；行内空白、缩进、空行位置均不忽略。
#
# 用法：
#   bash verify-samples.sh                 # 用 PATH 里的 g++
#   CXX=/path/to/g++ bash verify-samples.sh
#
# 退出码：0 全部通过；1 找不到编译器、编译失败或存在不一致。
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CXX="${CXX:-g++}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# 两侧共用的规范化。注意：这里定义的规则必须与脚本头部注释逐条对应。
normalize() {
  tr -d '\r' | sed -e 's/[[:space:]]*$//'
}

if ! command -v "$CXX" >/dev/null 2>&1; then
  echo "找不到编译器: $CXX" >&2
  exit 1
fi

# 1. 从 index.html 抽出题库，导出每份参考代码与每组样例。
node - "$ROOT" "$WORK" <<'NODE' || exit 1
const fs = require('fs'), vm = require('vm'), path = require('path');
const [root, work] = process.argv.slice(2);
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const ctx = { document: { addEventListener() {} } };
vm.createContext(ctx);
vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], ctx);
let samples = 0;
for (const q of ctx.BANK) {
  fs.writeFileSync(path.join(work, 'q' + q.id + '.cpp'), q.code);
  q.samples.forEach((s, i) => {
    fs.writeFileSync(path.join(work, 'q' + q.id + '_' + i + '.in'), s.in + '\n');
    fs.writeFileSync(path.join(work, 'q' + q.id + '_' + i + '.out'), s.out + '\n');
    samples++;
  });
}
console.log('题库: ' + ctx.BANK.length + ' 道编程题, ' + samples + ' 组样例');
NODE

# 2. 编译全部参考程序。
compile_failed=0
for src in "$WORK"/q*.cpp; do
  if ! "$CXX" -std=c++14 -O2 -Wall -Wextra "$src" -o "${src%.cpp}.exe" 2>"$WORK/err.txt"; then
    echo "编译失败: $(basename "$src")"
    head -5 "$WORK/err.txt"
    compile_failed=$((compile_failed + 1))
  fi
done
if [ "$compile_failed" -ne 0 ]; then
  echo "编译失败 $compile_failed 个程序" >&2
  exit 1
fi

# 3. 逐字比对。两侧都过 normalize，命令替换会顺带去掉末尾空行（规则 3）。
total=0
exact=0
for exe in "$WORK"/q*.exe; do
  base="${exe%.exe}"
  for infile in "${base}"_*.in; do
    total=$((total + 1))
    actual=$("$exe" < "$infile" | normalize)
    expected=$(normalize < "${infile%.in}.out")
    if [ "$actual" = "$expected" ]; then
      exact=$((exact + 1))
    else
      echo "不一致: $(basename "$infile" .in)"
      echo "  期望: $(printf '%s' "$expected" | tr '\n' '|')"
      echo "  实际: $(printf '%s' "$actual" | tr '\n' '|')"
    fi
  done
done

echo "逐字一致: $exact / $total"
[ "$exact" -eq "$total" ] || { echo "存在格式或数值不一致" >&2; exit 1; }
