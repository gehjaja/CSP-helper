// Keys match the stable programming question IDs in BANK.
const pythonRefs = {
  1: String.raw`target = int(input())
skips = [0] * 4
spoken = number = 0
while spoken < target:
    number += 1
    if number % 7 == 0 or "7" in str(number):
        skips[(number - 1) % 4] += 1
    else:
        spoken += 1
print(*skips, sep="\n")`,
  2: String.raw`n = int(input())
a = list(map(int, input().split()))
twice = a[n // 2] + a[(n - 1) // 2]
median = twice // 2 if twice % 2 == 0 else twice / 2
print(max(a), median, min(a))`,
  3: String.raw`n, m = map(int, input().split())
losses = []
total = 0
for _ in range(n):
    initial, *changes = map(int, input().split())
    loss = -sum(changes)
    losses.append(loss)
    total += initial - loss
largest = max(losses)
print(total, losses.index(largest) + 1, largest)`,
  4: String.raw`n, m, levels = map(int, input().split())
counts = [0] * levels
for _ in range(n):
    for x in map(int, input().split()):
        counts[x] += 1
print(*counts)`,
  5: String.raw`for _ in range(int(input())):
    expr = input().strip()
    terms = []
    sign = 1
    value = int(expr[0])
    for op, digit in zip(expr[1::2], expr[2::2]):
        x = int(digit)
        if op == "x":
            value *= x
        elif op == "/":
            value //= x
        else:
            terms.append(sign * value)
            sign = 1 if op == "+" else -1
            value = x
    print("Yes" if sum(terms) + sign * value == 24 else "No")`,
  6: String.raw`n, m = map(int, input().split())
points = []
for _ in range(n):
    x, y, group = input().split()
    points.append((int(x), int(y), group))
for _ in range(m):
    a, b, c = map(int, input().split())
    sides = {(a + b*x + c*y > 0) == (g == "A") for x, y, g in points}
    print("Yes" if len(sides) == 1 else "No")`,
  7: String.raw`n = int(input())
b = list(map(int, input().split()))
minimum = b[0] + sum(y for x, y in zip(b, b[1:]) if y > x)
print(sum(b))
print(minimum)`,
  8: String.raw`n, levels, r, threshold = map(int, input().split())
prefix = [[0] * (n + 1)]
for _ in range(n):
    row = [0]
    running = 0
    for j, value in enumerate(map(int, input().split()), 1):
        running += value
        row.append(running + prefix[-1][j])
    prefix.append(row)
answer = 0
for i in range(n):
    top, bottom = max(0, i-r), min(n, i+r+1)
    for j in range(n):
        left, right = max(0, j-r), min(n, j+r+1)
        area = (bottom-top) * (right-left)
        total = prefix[bottom][right] - prefix[top][right] - prefix[bottom][left] + prefix[top][left]
        answer += total <= threshold * area
print(answer)`,
  9: String.raw`n, budget, low = map(int, input().split())
fields = [tuple(map(int, input().split())) for _ in range(n)]
high = max(t for t, cost in fields)
while low < high:
    mid = (low + high) // 2
    need = sum(max(0, t-mid) * cost for t, cost in fields)
    if need <= budget:
        high = mid
    else:
        low = mid + 1
print(low)`,
  10: String.raw`n, threshold = map(int, input().split())
reachable = 1
for _ in range(n):
    price = int(input())
    reachable |= reachable << price
above = reachable >> threshold
print(threshold + (above & -above).bit_length() - 1)`,
  11: String.raw`import heapq
n = int(input())
m = int(input())
root = int(input())
graph = [[] for _ in range(n + 1)]
for _ in range(m):
    a, b, cost = map(int, input().split())
    graph[a].append((cost, b))
    graph[b].append((cost, a))
seen = set()
edges = [(0, root)]
answer = 0
while edges and len(seen) < n:
    cost, u = heapq.heappop(edges)
    if u in seen:
        continue
    seen.add(u)
    answer = max(answer, cost)
    for edge in graph[u]:
        if edge[1] not in seen:
            heapq.heappush(edges, edge)
print(answer)`,
  12: String.raw`print(sum(map(int, input().strip())))`,
  13: String.raw`n = int(input())
a = list(map(int, input().split()))
print(1 + sum(x != y for x, y in zip(a, a[1:])))`,
  14: String.raw`n = int(input())
a = list(map(int, input().split()))
print(sum((y-x)*(z-y) < 0 for x, y, z in zip(a, a[1:], a[2:])))`,
  15: String.raw`n = int(input())
a = list(map(int, input().split()))
print(max(abs(x-y) for x, y in zip(a, a[1:])))`,
  16: String.raw`n, target = map(int, input().split())
count = weight = 0
for cake in map(int, input().split()):
    weight += cake
    if weight >= target:
        count += 1
        weight = 0
print(count + (weight > 0))`,
  17: String.raw`import sys
total = streak = 0
for jump in map(int, sys.stdin.read().split()):
    if jump == 0:
        break
    streak = streak + 1 if jump == 2 else 0
    total += 2 * streak if streak else 1
print(total)`,
  18: String.raw`n = int(input())
a = list(map(int, input().split()))
for i in range(n):
    neighbors = a[max(0,i-1):i+2]
    print(sum(neighbors)//len(neighbors), end=" ")`,
  19: String.raw`red, yellow, green = map(int, input().split())
time = 0
for _ in range(int(input())):
    kind, seconds = map(int, input().split())
    if kind in (0, 1):
        time += seconds
    elif kind == 2:
        time += seconds + red
print(time)`,
  20: String.raw`n = int(input())
a = sorted(map(int, input().split()))
print(min(y-x for x, y in zip(a, a[1:])))`,
  21: String.raw`n, x, y = map(int, input().split())
distances = []
for idx in range(1,n+1):
    a, b = map(int, input().split())
    distances.append(((a-x)**2+(b-y)**2, idx))
for distance, idx in sorted(distances)[:3]:
    print(idx)`,
  22: String.raw`points = {tuple(map(int,input().split())) for _ in range(int(input()))}
counts = [0]*5
for x, y in points:
    if all(p in points for p in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]):
        score = sum((x+i,y+j) in points for i in (-1,1) for j in (-1,1))
        counts[score] += 1
print(*counts, sep="\n")`,
  23: String.raw`n, limit = map(int, input().split())
a = [0] + list(map(int, input().split())) + [limit]
print(sum(i*(a[i+1]-a[i]) for i in range(n+1)))`,
  24: String.raw`n, k = map(int, input().split())
seen = {0}
warnings = 0
for _ in range(k):
    x, y = map(int, input().split())
    warnings += y not in seen
    seen.add(x)
print(warnings)`,
  25: String.raw`from bisect import bisect_right, bisect_left
n, m, k = map(int, input().split())
starts, ends = [], []
for _ in range(n):
    t, c = map(int, input().split())
    starts.append(t-k-c+1)
    ends.append(t-k)
starts.sort()
ends.sort()
for _ in range(m):
    q = int(input())
    print(bisect_right(starts,q)-bisect_left(ends,q))`,
  26: String.raw`n = int(input())
a = list(map(int, input().split()))
mean = sum(a)/n
std = (sum((x-mean)**2 for x in a)/n)**0.5
for x in a:
    print((x-mean)/std)`,
  27: String.raw`n, m = map(int, input().split())
digits = []
for base in map(int, input().split()):
    m, digit = divmod(m, base)
    digits.append(digit)
print(*digits)`,
  28: String.raw`n, r = input().split()
rate = float(r)
print(sum(x/(1+rate)**i for i,x in enumerate(map(int,input().split()))))`,
  29: String.raw`n, a, b = map(int, input().split())
area = 0
for _ in range(n):
    x1,y1,x2,y2 = map(int,input().split())
    area += max(0,min(a,x2)-max(0,x1))*max(0,min(b,y2)-max(0,y1))
print(area)`,
  30: String.raw`from collections import Counter
seen = Counter()
for _ in range(int(input())):
    board = tuple(input() for _ in range(8))
    seen[board] += 1
    print(seen[board])`,
  31: String.raw`n,m = map(int,input().split())
dx = dy = 0
for _ in range(n):
    a,b = map(int,input().split())
    dx += a
    dy += b
for _ in range(m):
    x,y = map(int,input().split())
    print(x+dx,y+dy)`,
  32: String.raw`from math import sin, cos
n,m = map(int,input().split())
scale,angle = [1.0],[0.0]
for _ in range(n):
    op,value = input().split()
    scale.append(scale[-1]*(float(value) if op=="1" else 1))
    angle.append(angle[-1]+(float(value) if op=="2" else 0))
for _ in range(m):
    i,j,x,y = map(int,input().split())
    k = scale[j]/scale[i-1]
    t = angle[j]-angle[i-1]
    print(k*(x*cos(t)-y*sin(t)), k*(x*sin(t)+y*cos(t)))`,
  33: String.raw`n,m = map(int,input().split())
codes = [tuple(map(int,input().split())) for _ in range(n)]
for code in codes:
    for idx, other in enumerate(codes,1):
        if all(a < b for a,b in zip(code,other)):
            print(idx)
            break
    else:
        print(0)`,
  34: String.raw`from collections import Counter
n,m = map(int,input().split())
occurrences, documents = Counter(), Counter()
for _ in range(n):
    length,*words = map(int,input().split())
    occurrences.update(words)
    documents.update(set(words))
for i in range(1,m+1):
    print(documents[i],occurrences[i])`,
  35: String.raw`n,m = map(int,input().split())
first = set(input().lower().split())
second = set(input().lower().split())
print(len(first & second))
print(len(first | second))`,
  36: String.raw`n,m,p,q = map(int,input().split())
items = []
for _ in range(n):
    items.extend(map(int,input().split()))
for start in range(0,len(items),q):
    print(*items[start:start+q])`,
  37: String.raw`n,m,t = map(int,input().split())
items = []
for _ in range(n):
    items.extend(map(int,input().split()))
for _ in range(t):
    op,a,b = map(int,input().split())
    if op == 1:
        n,m = a,b
    elif op == 2:
        items = [items[i*m+j] for j in range(m) for i in range(n)]
        n,m = m,n
    else:
        print(items[a*m+b])`,
  38: String.raw`n,a,b = map(int,input().split())
first = dict(tuple(map(int,input().split())) for _ in range(a))
product = 0
for _ in range(b):
    i,x = map(int,input().split())
    product += first.get(i,0)*x
print(product)`,
  39: String.raw`budget = int(input())
groups, rest = divmod(budget, 50)
triples, rest = divmod(rest, 30)
print(7*groups + 4*triples + rest//10)`,
  40: String.raw`n = int(input())
a = list(map(int,input().split()))
middle = sorted(a)[n//2]
print(middle if sum(x<middle for x in a)==sum(x>middle for x in a) else -1)`,
  41: String.raw`n = int(input())
heights = list(map(int,input().split())) + [0]
stack = []
best = 0
for i,height in enumerate(heights):
    while stack and heights[stack[-1]] >= height:
        h = heights[stack.pop()]
        left = stack[-1]+1 if stack else 0
        best = max(best,h*(i-left))
    stack.append(i)
print(best)`,
  42: String.raw`from collections import defaultdict
r,c = map(int,input().split())
board = [input() for _ in range(r)]
graph, reverse = defaultdict(list), defaultdict(list)
for i,row in enumerate(board):
    for j,tile in enumerate(row):
        u = (i,j)
        if tile == "S":
            start = u
        if tile == "T":
            target = u
        for di,dj,allowed in [(-1,0,"ST+|"),(1,0,"ST+|."),(0,-1,"ST+-"),(0,1,"ST+-")]:
            a,b = i+di,j+dj
            if tile in allowed and 0<=a<r and 0<=b<c and board[a][b]!="#":
                graph[u].append((a,b))
                reverse[a,b].append(u)

def visit(edges, origin):
    seen = {origin}
    todo = [origin]
    while todo:
        for v in edges[todo.pop()]:
            if v not in seen:
                seen.add(v)
                todo.append(v)
    return seen

accessible = visit(graph,start)
print(len(accessible-visit(reverse,target)) if target in accessible else "I'm stuck!")`
};

Object.assign(pythonRefs, {
  43: String.raw`fmt = input()
for case in range(1, int(input()) + 1):
    words = iter(input().split()[1:])
    found = {}
    for word in words:
        if len(word) != 2 or word[0] != "-" or not word[1].islower() or word[1] not in fmt:
            break
        needs_arg = fmt.startswith(word[1] + ":", fmt.index(word[1]))
        arg = next(words, None) if needs_arg else ""
        if arg is None:
            break
        found[word] = arg
    parts = [f"Case {case}:"]
    for key in sorted(found):
        parts.append(key)
        if found[key]:
            parts.append(found[key])
    print(*parts)`,
  44: String.raw`import sys
from collections import defaultdict
orders = [None]
for line in sys.stdin:
    fields = line.split()
    if fields[0] == "cancel":
        orders[int(fields[1])] = None
        orders.append(None)
    else:
        orders.append((fields[0], int(fields[1].replace(".", "")), int(fields[2])))
book = defaultdict(lambda: [0, 0])
buyers = 0
for row in filter(None, orders):
    kind, price, shares = row
    book[price][kind == "sell"] += shares
    if kind == "buy":
        buyers += shares
best, chosen, sellers = -1, 0, 0
for price, (buy, sell) in sorted(book.items()):
    sellers += sell
    volume = min(buyers, sellers)
    if volume >= best:
        best, chosen = volume, price
    buyers -= buy
print(f"{chosen//100}.{chosen%100:02d}", max(0,best))`,
  45: String.raw`import calendar
a, b, c, start, end = map(int, input().split())
for year in range(start, end+1):
    first, length = calendar.monthrange(year, a)
    day = 1 + (c-1-first)%7 + 7*(b-1)
    print(f"{year}/{a:02d}/{day:02d}" if day <= length else "none")`,
  46: String.raw`import re
m,n = map(int,input().split())
lines = [input() for _ in range(m)]
values = {}
for _ in range(n):
    key, quoted = input().split(" ",1)
    values[key] = quoted[1:-1]
for line in lines:
    print(re.sub(r"\{\{ (\w+) \}\}", lambda m: values.get(m[1], ""), line))`,
  47: String.raw`w,h,q = map(int,input().split())
grid = [["."] * w for _ in range(h)]
for _ in range(q):
    op,x,y,*rest = input().split()
    x,y = int(x),int(y)
    if op == "0":
        a,b = map(int,rest)
        pen,other = ("|","-") if a == x else ("-","|")
        for j in range(min(y,b), max(y,b)+1):
            for i in range(min(x,a), max(x,a)+1):
                grid[j][i] = "+" if grid[j][i] in (other,"+") else pen
    else:
        todo,seen = [(x,y)],{(x,y)}
        while todo:
            i,j = todo.pop()
            grid[j][i] = rest[0]
            for a,b in [(i-1,j),(i+1,j),(i,j-1),(i,j+1)]:
                if 0<=a<w and 0<=b<h and (a,b) not in seen and grid[b][a] not in "-|+":
                    todo.append((a,b))
                    seen.add((a,b))
for row in reversed(grid):
    print("".join(row))`,
  48: String.raw`n = int(input())
cwd = input()
for _ in range(n):
    path = input()
    if not path.startswith("/"):
        path = cwd + "/" + path
    stack = []
    for name in path.split("/"):
        if name in ("", "."):
            continue
        if name == "..":
            if stack:
                stack.pop()
        else:
            stack.append(name)
    print("/" + "/".join(stack))`,
  49: String.raw`from collections import defaultdict
n,m,q = map(int,input().split())
ops,kinds,names,subjects = [defaultdict(int) for _ in range(4)]
roles = {}
any_name = 0
for i in range(n):
    fields = iter(input().split())
    bit = 1 << i
    roles[next(fields)] = bit
    for table in (ops,kinds,names):
        count = int(next(fields))
        if table is names and count == 0:
            any_name |= bit
        for _ in range(count):
            table[next(fields)] |= bit
for _ in range(m):
    fields = iter(input().split())
    bit = roles[next(fields)]
    for _ in range(int(next(fields))):
        subjects[next(fields),next(fields)] |= bit
for _ in range(q):
    user,count,*rest = input().split()
    allowed = subjects.get(("u",user),0)
    for group in rest[:int(count)]:
        allowed |= subjects.get(("g",group),0)
    op,kind,name = rest[-3:]
    allowed &= ops.get(op,0) | ops.get("*",0)
    allowed &= kinds.get(kind,0) | kinds.get("*",0)
    allowed &= names.get(name,0) | any_name
    print(int(bool(allowed)))`,
  50: String.raw`import sys
size = int(input())
data = bytes.fromhex(sys.stdin.read())
pos = 0
while data[pos] & 128:
    pos += 1
pos += 1
out = bytearray()
while pos < size:
    tag = data[pos]
    pos += 1
    kind, high = tag & 3, tag >> 2
    if kind == 0:
        length = high + 1
        if high >= 60:
            width = high - 59
            length = int.from_bytes(data[pos:pos+width], "little") + 1
            pos += width
        out.extend(data[pos:pos+length])
        pos += length
    else:
        if kind == 1:
            offset = ((tag >> 5) << 8) + data[pos]
            pos += 1
            length = 4 + (high & 7)
        else:
            offset = int.from_bytes(data[pos:pos+2], "little")
            pos += 2
            length = high + 1
        for _ in range(length):
            out.append(out[-offset])
for i in range(0,len(out),8):
    print(out[i:i+8].hex())`,
  51: String.raw`import re
from math import gcd
from functools import reduce
for _ in range(int(input())):
    size,*formulas = input().split()
    m = int(size)
    rows = {}
    for col,formula in enumerate(formulas):
        for name,count in re.findall(r"([a-z]+)([0-9]+)", formula):
            rows.setdefault(name, [0]*m)[col] = int(count)
    a = list(rows.values())
    rank = 0
    for col in range(m):
        pivot = next((i for i in range(rank,len(a)) if a[i][col]), None)
        if pivot is None:
            break
        a[pivot],a[rank] = a[rank],a[pivot]
        for i in range(rank+1,len(a)):
            factor = a[i][col]
            if factor:
                row = [x*a[rank][col]-y*factor for x,y in zip(a[i],a[rank])]
                divisor = reduce(gcd,row) or 1
                a[i] = [x//divisor for x in row]
        rank += 1
    print("N" if rank == m else "Y")`
});

Object.assign(pythonRefs, {
  52: String.raw`from collections import OrderedDict
n, count, q = map(int, input().split())
groups = {}
for _ in range(q):
    op, block = map(int, input().split())
    index = (block // n) % count
    if index not in groups:
        groups[index] = OrderedDict()
    group = groups[index]
    if block in group:
        group[block] |= op
        group.move_to_end(block)
        continue
    if len(group) == n:
        old, dirty = group.popitem(last=False)
        if dirty:
            print(1, old)
    print(0, block)
    group[block] = op`,
  53: String.raw`import sys
sys.setrecursionlimit(6000)
mod = 10**9 + 7
defs = {}

def length(expr, memo):
    total, refs = expr
    for key in refs:
        if key not in memo:
            memo[key] = length(defs.get(key, (0, ())), memo)
        total += memo[key]
    return total % mod

for _ in range(int(input())):
    op, name, *words = input().split()
    if op == "3":
        print(length(defs.get(name, (0, ())), {}))
        continue
    refs = [word[1:] for word in words if word.startswith("$")]
    literal = sum(len(word) for word in words if not word.startswith("$"))
    expr = literal, refs
    defs[name] = (length(expr, {}), ()) if op == "1" else expr`
});
