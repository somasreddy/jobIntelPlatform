// ─── Comprehensive Interview Question Bank ────────────────────────────────────
// Covers: DSA, System Design, CI/CD DevOps, B2B Integration (webMethods),
// EDI / Trading Networks, BPM, API Management, Databases, Cloud, QA, Behavioral

export interface QuestionBankItem {
  id: string;
  domain: string;
  type: "behavioral" | "technical" | "situational" | "leadership";
  difficulty: "Easy" | "Medium" | "Hard";
  question: string;
  hint: string;
  keyPoints: string[];
  modelAnswer?: string;
  starTemplate?: { situation: string; task: string; action: string; result: string };
}

// ─── DSA & Algorithms ─────────────────────────────────────────────────────────
export const DSA_QUESTIONS: QuestionBankItem[] = [
  {
    id: "dsa1", domain: "DSA", type: "technical", difficulty: "Easy",
    question: "Explain the difference between an Array and a Linked List. When would you use each?",
    hint: "Think about access patterns (random vs sequential), memory allocation, and insertion/deletion cost.",
    keyPoints: ["O(1) random access vs O(n)", "Contiguous vs non-contiguous memory", "Cache locality", "Practical use cases"],
    modelAnswer: `**Array**: Contiguous memory, O(1) index access, O(n) insertion/deletion in the middle. Best when you need fast random access and the size is known upfront (e.g., lookup tables, buffers, matrix operations).

**Linked List**: Non-contiguous nodes with pointers, O(n) access, O(1) insertion/deletion at the head. Best when size is dynamic and you mostly insert/delete at known positions (e.g., LRU cache implementation, undo stacks, OS process queues).

**Key trade-off**: Arrays benefit from CPU cache locality (sequential memory reads are fast). Linked lists have pointer overhead (8 bytes per node on 64-bit systems) and cause cache misses. In practice, arrays (or ArrayList/dynamic arrays) outperform linked lists in most real workloads due to cache effects.`,
  },
  {
    id: "dsa2", domain: "DSA", type: "technical", difficulty: "Medium",
    question: "How does a HashMap work internally? What happens during a hash collision and how is it resolved?",
    hint: "Cover hash function, bucket array, load factor, and the two main collision resolution strategies.",
    keyPoints: ["Hash function & modulo", "Bucket array", "Chaining vs open addressing", "Load factor & rehashing", "O(1) average vs O(n) worst"],
    modelAnswer: `**Internals**: A HashMap maintains an array of buckets. When you call \`put(key, value)\`, it computes \`hash(key) % capacity\` to determine the bucket index, then stores the entry there.

**Collision Resolution**:
- **Chaining (Java HashMap)**: Each bucket holds a linked list (or a Red-Black tree when chain length > 8, since Java 8). Multiple entries with the same bucket index are stored in the chain. Lookup traverses the chain: O(1) average, O(n) worst case.
- **Open Addressing (Python dict)**: On collision, probe for the next empty slot using linear, quadratic, or double-hashing probing. No extra pointer overhead but clusters can form.

**Load Factor**: Default 0.75 in Java. When (entries/capacity) > 0.75, the map rehashes — doubles the array and reinserts all entries. This is O(n) but amortized O(1) over many inserts.

**Good hash functions** minimise collisions by distributing keys uniformly (Java's \`hashCode()\` uses the key's bits to compute a 32-bit integer, then applies bitwise mixing).`,
  },
  {
    id: "dsa3", domain: "DSA", type: "technical", difficulty: "Medium",
    question: "Explain BFS vs DFS. Give a real-world use case where you'd prefer each.",
    hint: "Cover data structures used, traversal order, space complexity, and practical applications.",
    keyPoints: ["Queue (BFS) vs Stack/Recursion (DFS)", "Shortest path (unweighted)", "Memory trade-offs", "Cycle detection", "Topological sort"],
    modelAnswer: `**BFS (Breadth-First Search)**:
- Uses a **Queue**. Explores all neighbours at depth d before going to depth d+1.
- Finds the **shortest path** in an unweighted graph.
- Space: O(V) for the frontier (can be large for wide graphs).
- Use cases: Social network "degrees of separation", web crawler level-by-level, GPS shortest route (unweighted).

**DFS (Depth-First Search)**:
- Uses a **Stack** (or recursion). Goes as deep as possible before backtracking.
- Space: O(H) where H = height of tree/graph — better for deep, narrow structures.
- Use cases: Maze solving, detecting cycles, topological sorting (dependency resolution), finding connected components.

**Real examples**:
- **BFS**: LinkedIn "People you may know" at 2nd degree — BFS from your node up to depth 2.
- **DFS**: Detecting circular dependencies in a build system (Maven/Gradle) — DFS + track visited + recursion stack.`,
  },
  {
    id: "dsa4", domain: "DSA", type: "technical", difficulty: "Hard",
    question: "Design an LRU (Least Recently Used) Cache with O(1) get and O(1) put operations. Explain your data structure choice.",
    hint: "The key insight is combining a HashMap with a Doubly Linked List to achieve O(1) for both operations.",
    keyPoints: ["HashMap for O(1) lookup", "Doubly Linked List for O(1) move-to-front", "Sentinel head/tail nodes", "Capacity eviction logic"],
    modelAnswer: `**Data Structures**: HashMap<Key, Node> + Doubly Linked List.

**Why both?**
- HashMap gives O(1) access to any node by key.
- Doubly Linked List maintains usage order (most-recent at head, least-recent at tail) with O(1) insertion and removal.

\`\`\`
class LRUCache {
  capacity: number
  map: Map<number, DListNode>  // key → node
  head: DListNode  // most recent (sentinel)
  tail: DListNode  // least recent (sentinel)

  get(key):
    if not in map → return -1
    move node to head (remove + addFront)
    return node.value

  put(key, value):
    if key in map → update value, move to head
    else:
      if size == capacity → remove tail.prev, delete from map
      create new node, addFront, add to map
\`\`\`

**Sentinel nodes** (dummy head/tail) eliminate null checks during insertions/deletions.

**Time**: O(1) get, O(1) put. **Space**: O(capacity).

Used in: OS page replacement, CPU caches, HTTP response caches (Redis with maxmemory-policy=allkeys-lru), CDN edge caches.`,
  },
  {
    id: "dsa5", domain: "DSA", type: "technical", difficulty: "Hard",
    question: "Explain Dynamic Programming. What is memoisation vs tabulation? Give an example with the Fibonacci sequence.",
    hint: "Define overlapping subproblems and optimal substructure. Show both approaches and their space trade-offs.",
    keyPoints: ["Overlapping subproblems", "Optimal substructure", "Top-down (memo) vs Bottom-up (tab)", "Space optimisation"],
    modelAnswer: `**Dynamic Programming** solves problems by breaking them into overlapping subproblems and caching results.

**Two conditions for DP**:
1. **Optimal Substructure**: Optimal solution built from optimal subsolutions.
2. **Overlapping Subproblems**: Same subproblems solved multiple times (unlike divide-and-conquer).

**Memoisation (Top-Down)**: Recursive solution with a cache. Compute only what's needed.
\`\`\`
memo = {}
def fib(n):
  if n <= 1: return n
  if n in memo: return memo[n]
  memo[n] = fib(n-1) + fib(n-2)
  return memo[n]
// Time: O(n), Space: O(n) call stack + memo
\`\`\`

**Tabulation (Bottom-Up)**: Fill a table iteratively from base cases.
\`\`\`
def fib(n):
  dp = [0, 1]
  for i in range(2, n+1):
    dp.append(dp[i-1] + dp[i-2])
  return dp[n]
// Time: O(n), Space: O(n) — optimise to O(1) with two variables
\`\`\`

**Space optimised**:
\`\`\`
a, b = 0, 1
for _ in range(n): a, b = b, a+b
return a  // O(1) space
\`\`\`

Real-world DP: Shortest path (Dijkstra/Bellman-Ford), text diff (edit distance), knapsack (resource allocation), sequence alignment (bioinformatics).`,
  },
  {
    id: "dsa6", domain: "DSA", type: "technical", difficulty: "Medium",
    question: "What is the time complexity of QuickSort best, average, and worst case? How does pivot selection affect performance?",
    hint: "Discuss partitioning, pivot strategies (last element, random, median-of-three), and why random pivot avoids O(n²).",
    keyPoints: ["O(n log n) avg, O(n²) worst", "Pivot selection strategies", "In-place vs not", "Compared to MergeSort"],
    modelAnswer: `**QuickSort Complexity**:
- **Best/Average**: O(n log n) — balanced partitions, depth log n
- **Worst**: O(n²) — pivot always smallest/largest (sorted array with last-element pivot)
- **Space**: O(log n) average (recursion stack), O(n) worst

**Pivot Strategies**:
1. **Last element** (naive): O(n²) on sorted input — common in practice, bad for already-sorted data.
2. **Random pivot**: Eliminates adversarial inputs. Expected O(n log n) regardless of input.
3. **Median-of-three**: Take median of first, middle, last. Good balance in practice.
4. **Introselect / PDQ sort**: Modern implementations (e.g., C++ std::sort) switch to HeapSort when recursion depth exceeds 2·log n, guaranteeing O(n log n) worst case.

**vs MergeSort**: QuickSort is in-place (O(log n) space) and cache-friendly but has O(n²) worst case. MergeSort is stable with guaranteed O(n log n) but needs O(n) auxiliary space — better for linked lists and external sorting.

**In practice**: Most library sorts (Timsort in Python/Java, IntroSort in C++) combine algorithms for real-world performance guarantees.`,
  },
  {
    id: "dsa7", domain: "DSA", type: "technical", difficulty: "Medium",
    question: "Explain Binary Search Trees (BST). What problem does a Balanced BST (AVL/Red-Black Tree) solve?",
    hint: "Show how BST degrades to O(n) without balancing, and how rotations keep height O(log n).",
    keyPoints: ["BST property", "O(n) degenerate case", "AVL vs Red-Black", "Rotation mechanics", "Real-world use in TreeMap/TreeSet"],
    modelAnswer: `**BST Property**: Left subtree < node < right subtree. Enables O(log n) search, insert, delete on a balanced tree.

**Problem with naive BST**: If you insert sorted data (1,2,3,4,5), the tree becomes a linked list — O(n) for all operations.

**Balanced BSTs** maintain height ≤ 2·log n via rotations after insertions/deletions:

**AVL Tree**: Height balance factor |left.height - right.height| ≤ 1. Stricter balance → faster lookups (better for read-heavy workloads). More rotations on insert.

**Red-Black Tree**: Weaker balance (height ≤ 2·log n). Fewer rotations on insert/delete (better for write-heavy). Used in: Java TreeMap/TreeSet, C++ std::map, Linux kernel's CFS scheduler.

**Operations**: All O(log n) guaranteed — search, min, max, predecessor, successor, insert, delete.

**vs Hash Map**: HashMap = O(1) average but unordered. Red-Black Tree = O(log n) but **ordered** — supports range queries, in-order traversal, floor/ceiling. Use TreeMap when you need sorted order or range lookups.`,
  },
  {
    id: "dsa8", domain: "DSA", type: "technical", difficulty: "Hard",
    question: "Given an unsorted array, find the kth largest element. What are your approaches and their complexities?",
    hint: "Discuss sort O(n log n), min-heap O(n log k), and QuickSelect O(n) average. Which is best for different constraints?",
    keyPoints: ["Sort approach", "Min-heap of size k", "QuickSelect (partition-based)", "O(n) average vs guaranteed"],
    modelAnswer: `**Approach 1 — Sort**: Sort descending, return index k-1. O(n log n) time, O(1) extra space. Simple but overkill.

**Approach 2 — Min-Heap of size k**: Maintain a min-heap of the k largest elements seen. For each new element, if it's > heap.min, pop and push. Return heap.min at the end.
- Time: O(n log k). Space: O(k). Excellent for **streaming** data or very large arrays.

**Approach 3 — QuickSelect** (optimal):
1. Pick a pivot, partition array into [< pivot | pivot | > pivot].
2. If pivot index = n-k, that's the answer.
3. Otherwise recurse only into the relevant half.
- **Average**: O(n). **Worst**: O(n²) with bad pivot (use random pivot to mitigate).
- Used in: Python's \`heapq.nlargest\`, many interview-optimal solutions.

**When to use which**:
- Small k → Min-heap (O(n log k), clean to implement)
- General case → QuickSelect (O(n) average, in-place)
- Streaming / unknown n → Min-heap
- Guaranteed O(n) → Median-of-medians algorithm (complex, constant factor is high)

\`\`\`python
import random
def quickselect(arr, k):
    if len(arr) == 1: return arr[0]
    pivot = random.choice(arr)
    greater = [x for x in arr if x > pivot]
    equal   = [x for x in arr if x == pivot]
    lesser  = [x for x in arr if x < pivot]
    if k <= len(greater): return quickselect(greater, k)
    elif k <= len(greater) + len(equal): return pivot
    else: return quickselect(lesser, k - len(greater) - len(equal))
\`\`\``,
  },
  {
    id: "dsa9", domain: "DSA", type: "technical", difficulty: "Medium",
    question: "What is a Trie? Where would you use it over a HashMap for string operations?",
    hint: "Focus on prefix matching, autocomplete, and the space trade-off vs HashMap.",
    keyPoints: ["Prefix tree structure", "O(L) operations", "Autocomplete / spell check", "vs HashMap for prefix queries"],
    modelAnswer: `**Trie (Prefix Tree)**: A tree where each node represents a character. Root = empty string. Each path from root to a marked node = a word.

**Operations**: Insert, Search, StartsWith — all O(L) where L = string length.

**vs HashMap for strings**:
- HashMap: O(L) for hash + store, but **no prefix support**. Querying all words with prefix "app" requires full scan.
- Trie: O(L) to navigate to the prefix node, then traverse subtree to get all matches. Perfect for autocomplete, IP routing, spell correction.

**Space trade-off**: Trie can use O(ALPHABET_SIZE × N × L) nodes — worse than HashMap for sparse dictionaries. Compressed Trie (Patricia/Radix Tree) merges single-child chains to reduce space.

**Real uses**:
- **Autocomplete**: Google Search suggestions — trie with frequency scores
- **DNS lookup**: Hierarchical domain names navigated as a trie
- **IP routing**: Longest prefix matching in routers (CIDR blocks)
- **Spell checker**: Dictionary stored as trie for fast prefix validation
- **Boggle solver**: Word existence checked in O(L) during DFS on game board

\`\`\`python
class TrieNode:
    def __init__(self): self.children = {}; self.is_end = False

class Trie:
    def insert(self, word):
        node = self.root
        for ch in word:
            node = node.children.setdefault(ch, TrieNode())
        node.is_end = True
\`\`\``,
  },
  {
    id: "dsa10", domain: "DSA", type: "technical", difficulty: "Hard",
    question: "Explain Dijkstra's algorithm. What are its limitations and when would you use Bellman-Ford instead?",
    hint: "Cover the greedy approach, priority queue, negative weight handling, and time complexity with different data structures.",
    keyPoints: ["Greedy + priority queue", "O((V+E) log V)", "No negative weights", "Bellman-Ford for negative edges", "Real-world routing"],
    modelAnswer: `**Dijkstra's Algorithm** finds the shortest path from a source to all vertices in a weighted graph with **non-negative edge weights**.

**How it works**:
1. Initialise dist[source] = 0, all others = ∞.
2. Use a min-priority queue. Extract the vertex u with minimum dist.
3. For each neighbour v: if dist[u] + weight(u,v) < dist[v], update dist[v] and push to queue (relaxation).
4. Repeat until queue is empty.

**Time complexity**:
- With binary heap: O((V + E) log V)
- With Fibonacci heap: O(E + V log V) — used in dense graphs
- Simple array: O(V²) — acceptable for dense graphs where E ≈ V²

**Limitation**: **Fails with negative edge weights**. A negative edge can make a "settled" vertex's distance shorter, but Dijkstra never revisits settled vertices.

**Bellman-Ford**: Relaxes all edges V-1 times. O(VE) time. Handles negative weights and **detects negative cycles** (if dist still decreases on Vth iteration).

**When to use what**:
- GPS/Google Maps (non-negative distances) → Dijkstra with A* heuristic
- Financial arbitrage detection (negative log-weights) → Bellman-Ford
- Dense graphs with negative weights → SPFA (queue-based Bellman-Ford variant)

**Real usage**: OSPF routing protocol uses Dijkstra. Border Gateway Protocol (BGP) uses path-vector (not Dijkstra).`,
  },
  {
    id: "dsa11", domain: "DSA", type: "technical", difficulty: "Medium",
    question: "Explain the Sliding Window technique. Solve: find the maximum sum subarray of size k.",
    hint: "The key insight: instead of re-summing each window from scratch, slide the window by adding the new element and removing the leftmost element in O(1).",
    keyPoints: ["O(n) single pass", "Fixed vs variable window", "Two-pointer variant for dynamic window", "Applications: strings, arrays, streams"],
    modelAnswer: `**Sliding Window** maintains a contiguous window over a sequence, updating incrementally instead of recomputing from scratch. Reduces O(n×k) brute force to O(n).

**Fixed Window — Max Sum Subarray of size k**:
\`\`\`python
def max_sum_subarray(arr, k):
    window_sum = sum(arr[:k])   # initial window
    max_sum = window_sum
    for i in range(k, len(arr)):
        window_sum += arr[i] - arr[i - k]  # slide: add new, drop old
        max_sum = max(max_sum, window_sum)
    return max_sum
# Time: O(n), Space: O(1)
\`\`\`

**Variable Window** (two-pointer variant): Used when the window size isn't fixed.
Example: Longest substring with at most k distinct characters.
\`\`\`python
left = 0; freq = {}
for right in range(len(s)):
    freq[s[right]] = freq.get(s[right], 0) + 1
    while len(freq) > k:
        freq[s[left]] -= 1
        if freq[s[left]] == 0: del freq[s[left]]
        left += 1
    result = max(result, right - left + 1)
\`\`\`

**Common patterns**:
- Fixed size: max/min/average of subarray, DNA sequence matching
- Variable size: longest/shortest substring satisfying a condition
- Two strings: minimum window substring, permutation in string`,
  },
  {
    id: "dsa12", domain: "DSA", type: "technical", difficulty: "Medium",
    question: "What is the Two Pointers technique? Solve: given a sorted array, find all pairs that sum to a target.",
    hint: "Place one pointer at the start, one at the end. If sum > target, move right pointer left. If sum < target, move left pointer right.",
    keyPoints: ["O(n) for sorted arrays", "Replaces O(n²) nested loops", "In-place, O(1) space", "Variants: fast-slow pointers for cycle detection"],
    modelAnswer: `**Two Pointers** uses two indices moving toward or away from each other to eliminate nested loops. Requires sorted array for the pair-sum problem.

\`\`\`python
def two_sum_sorted(arr, target):
    left, right = 0, len(arr) - 1
    pairs = []
    while left < right:
        s = arr[left] + arr[right]
        if s == target:
            pairs.append((arr[left], arr[right]))
            left += 1; right -= 1
        elif s < target:
            left += 1   # need larger sum
        else:
            right -= 1  # need smaller sum
    return pairs
# Time: O(n), Space: O(1) [excluding output]
\`\`\`

**Why it works**: In a sorted array, if sum is too small, only moving left pointer right can increase it. If too large, only moving right pointer left can decrease it. Each iteration eliminates a pair in O(1).

**Variants**:
- **Three Sum**: Fix one element, run two-pointer on the rest. O(n²).
- **Fast-Slow Pointers** (Floyd's cycle detection): detect cycle in linked list in O(n) space O(1). Slow moves 1 step, fast moves 2 steps. They meet if there's a cycle.
- **Container with most water**: two pointers from ends, move the shorter side inward.
- **Palindrome check**: left and right from ends toward middle.`,
  },
  {
    id: "dsa13", domain: "DSA", type: "technical", difficulty: "Medium",
    question: "Explain Binary Search and its variants. How would you find the first and last occurrence of a target in a sorted array?",
    hint: "Standard binary search finds a target. For first/last occurrence, don't stop when you find it — keep narrowing toward the left (or right) boundary.",
    keyPoints: ["O(log n) on sorted arrays", "Boundary-finding variants", "Rotated array search", "Search on answer space (not just arrays)"],
    modelAnswer: `**Standard Binary Search**: O(log n).
\`\`\`python
def binary_search(arr, target):
    lo, hi = 0, len(arr) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if arr[mid] == target: return mid
        elif arr[mid] < target: lo = mid + 1
        else: hi = mid - 1
    return -1
\`\`\`

**First Occurrence** (left boundary):
\`\`\`python
def first_occurrence(arr, target):
    lo, hi, result = 0, len(arr) - 1, -1
    while lo <= hi:
        mid = (lo + hi) // 2
        if arr[mid] == target:
            result = mid
            hi = mid - 1   # don't stop — keep searching left
        elif arr[mid] < target: lo = mid + 1
        else: hi = mid - 1
    return result
\`\`\`

**Last Occurrence**: same but \`lo = mid + 1\` when found.

**Search in Rotated Sorted Array** (LeetCode 33): One half is always sorted. Check which half is sorted, then determine which half the target falls in.

**Binary Search on Answer Space**: Don't just search in arrays.
- Minimum days to ship packages (search in [max_weight, sum_weights])
- Square root of N (search in [0, N])
- Capacity to ship within D days
Pattern: define a monotonic predicate, binary search for the boundary.`,
  },
  {
    id: "dsa14", domain: "DSA", type: "technical", difficulty: "Medium",
    question: "What is a Heap (Priority Queue)? How would you find the top-k frequent elements in an array?",
    hint: "Build a frequency map first, then use a min-heap of size k. For each new element, if its frequency > heap minimum, swap it in.",
    keyPoints: ["Min-heap vs max-heap", "O(log k) insert/extract", "Top-k pattern", "Merge k sorted lists", "Heap sort"],
    modelAnswer: `**Heap**: A complete binary tree satisfying the heap property. Min-heap: parent ≤ children (root = minimum). Max-heap: parent ≥ children (root = maximum).

**Operations**: insert O(log n), extract-min/max O(log n), peek O(1), heapify O(n).

**Top-K Frequent Elements** using min-heap of size k:
\`\`\`python
import heapq
from collections import Counter

def top_k_frequent(nums, k):
    freq = Counter(nums)          # O(n)
    # min-heap of (count, num) — keeps k largest frequencies
    heap = []
    for num, count in freq.items():
        heapq.heappush(heap, (count, num))
        if len(heap) > k:
            heapq.heappop(heap)   # remove smallest frequency
    return [num for count, num in heap]
# Time: O(n log k), Space: O(n + k)
\`\`\`

**Why min-heap, not max-heap?** We want to evict the SMALLEST frequency to keep the top-k. A min-heap of size k holds the k largest seen so far.

**Merge K Sorted Lists**: Push first element from each list into a min-heap. Extract min, push next element from that list. O(N log k) where N = total elements, k = number of lists.

**Heap Sort**: Heapify array O(n), extract-max n times O(n log n). In-place but not stable.

**Real uses**: Dijkstra's shortest path (priority queue), task scheduling (process with highest priority), median of stream (two heaps: max-heap for lower half, min-heap for upper half).`,
  },
];

// ─── System Design ────────────────────────────────────────────────────────────
export const SYSTEM_DESIGN_QUESTIONS: QuestionBankItem[] = [
  {
    id: "sd1", domain: "System Design", type: "technical", difficulty: "Hard",
    question: "Design a URL shortener like bit.ly. Walk through your complete architecture.",
    hint: "Cover hashing strategy, storage, redirection, analytics, and scalability to billions of URLs.",
    keyPoints: ["Base62 encoding", "Hash collision handling", "KV store for redirects", "CDN + caching", "Analytics pipeline"],
    modelAnswer: `**Requirements**: Shorten URLs, redirect users, 100M URLs created/day, 10B redirects/day (100:1 read:write).

**Core Algorithm**:
- Generate a unique 7-character Base62 ID (62^7 = 3.5 trillion combinations).
- Option A: MD5(url) → take first 7 chars — risk of collision, check DB.
- Option B: Auto-increment ID → convert to Base62 — no collision, but sequential (guessable).
- Option C: Distributed ID generator (Snowflake) → Base62 — unique, no collision, not sequential.

**Storage**:
- Write: Store {shortId → longUrl, createdAt, userId} in a KV store (DynamoDB, Cassandra) — optimised for point lookups by shortId.
- 7 bytes ID + 2KB avg URL = ~200GB/day → use S3/Cassandra for long-term storage.

**Redirection**:
- HTTP 301 (permanent, browser caches) vs **302** (temporary, every redirect hits server for analytics). Choose 302 for analytics.
- Cache hot URLs in Redis with TTL. LRU eviction. 80/20 rule: 20% of URLs = 80% of traffic.

**Scale**:
- Read: CDN (Cloudflare) → Redis cache → DynamoDB. Target p99 < 20ms.
- Write: API servers → message queue (Kafka) → async persist.
- Database: Cassandra partitioned by shortId — consistent hash ring.

**Analytics**: Async — write click events to Kafka → Spark Streaming → ClickHouse/BigQuery for dashboards.`,
  },
  {
    id: "sd2", domain: "System Design", type: "technical", difficulty: "Hard",
    question: "How would you design a distributed message queue like Kafka? Explain producers, brokers, consumers, and durability guarantees.",
    hint: "Cover partitioning, replication, consumer groups, offset management, and delivery semantics.",
    keyPoints: ["Partitioned log", "Replication factor", "Consumer groups & offset", "At-least-once vs exactly-once", "Retention policy"],
    modelAnswer: `**Core Design — Partitioned Commit Log**:
- Topic split into N **partitions** (ordered, immutable logs). Each message gets an offset within its partition.
- Partitions distributed across brokers — enables horizontal scaling. A topic with 100 partitions across 10 brokers = 10 partitions/broker.

**Producers**:
- Choose partition via round-robin, key hash, or custom partitioner.
- Batching + compression (LZ4/Snappy) before sending — reduces network I/O by 5-10x.
- **Acks**: acks=0 (fire and forget), acks=1 (leader only), acks=all (all in-sync replicas) — durability vs latency trade-off.

**Brokers**:
- Each partition has a **leader** and N **followers** (replication factor). Followers replicate from leader.
- ZooKeeper (legacy) / KRaft (Kafka 3.x) manages leader election.
- Data stored as segment files on disk. **Sequential writes** (OS page cache) give near-RAM throughput.

**Consumers**:
- Consumer Group: each partition consumed by exactly one member → horizontal scaling of consumers.
- Offset tracked in __consumer_offsets topic (or externally for exactly-once semantics).
- **At-least-once**: commit after processing — re-read on failure, idempotent consumers needed.
- **Exactly-once**: Kafka Transactions — producer + consumer in atomic transaction.

**Retention**: Time-based (7 days default) or size-based. Compacted topics keep latest value per key (useful for CDC / event sourcing).`,
  },
  {
    id: "sd3", domain: "System Design", type: "technical", difficulty: "Hard",
    question: "Design a real-time notification system that delivers push notifications to 100M users within 5 seconds.",
    hint: "Cover fan-out strategies, WebSocket vs SSE vs polling, device token management, and failure handling.",
    keyPoints: ["Fan-out on write vs read", "WebSocket / SSE connection management", "APNs/FCM integration", "Message deduplication", "Delivery receipts"],
    modelAnswer: `**Delivery Channels**:
- **Mobile push**: APNs (iOS) / FCM (Android) — device tokens stored in DB.
- **Web push**: WebSocket (bidirectional) or SSE (server-sent, simpler for notifications).
- **Email/SMS**: Async via SendGrid / Twilio for non-real-time.

**Fan-out Problem** (sending to followers of a popular user):
- **Fan-out on Write**: When user A posts, immediately push to all A's followers' inboxes. Fast reads, slow writes for celebrities (1M followers = 1M writes). Use a threshold — celebrities use fan-out on read.
- **Fan-out on Read**: Store one copy, readers fetch at read time. Slower reads but cheap writes.

**Architecture**:
1. Event → Kafka topic (partitioned by user_id)
2. Notification Service consumers → look up user preferences + device tokens
3. For small follower counts: fan-out directly via APNs/FCM
4. For large: enqueue to SQS per device, Lambda sends push
5. WebSocket connections maintained per-device in a stateful Connection Service (backed by Redis for routing — which server holds which connection)

**Scale**:
- 100M users, avg 2 devices = 200M connections. Use connection multiplexing. Nginx + WebSocket, sticky load balancing.
- APNs/FCM batch sending — up to 500 notifications/request.
- Rate limit: token bucket per user to prevent notification spam.

**Reliability**: At-least-once delivery. Track sent status in Redis (TTL 24h). Retry with exponential backoff. Dead-letter queue for failed deliveries.`,
  },
  {
    id: "sd4", domain: "System Design", type: "technical", difficulty: "Hard",
    question: "Design a Rate Limiter. What algorithms would you consider and how would you implement it in a distributed system?",
    hint: "Cover Token Bucket, Leaky Bucket, Fixed Window Counter, Sliding Window Log, and Sliding Window Counter. Then address distributed rate limiting with Redis.",
    keyPoints: ["Token Bucket vs Leaky Bucket", "Fixed vs Sliding window", "Redis atomic operations (INCR + EXPIRE, Lua)", "Rate limit headers", "Per-user vs per-IP vs per-API-key"],
    modelAnswer: `**Rate Limiting Algorithms**:

**1. Token Bucket** (most common):
- Bucket holds max N tokens. Tokens added at rate R/sec. Each request consumes 1 token.
- Allows bursts up to N, smoothed by rate R. Implementation: track (tokens, lastRefillTime).
- Used by: AWS API Gateway, Stripe.

**2. Fixed Window Counter**:
- Count requests in a fixed time window (e.g., 1-min slots). Reset counter at window boundary.
- Problem: boundary burst — 100 req in last second of window + 100 req in first second of next window = 200 req in 2 seconds.

**3. Sliding Window Log**:
- Store timestamp of each request in a sorted set. On new request, remove entries older than window, count remaining.
- Accurate but O(requests) memory per user.

**4. Sliding Window Counter** (hybrid, best balance):
- Use two fixed window counters. Estimate: previous_count × (1 - elapsed/window) + current_count.
- O(1) memory, ~0.1% error rate at boundary. Used by Cloudflare.

**Distributed Rate Limiting with Redis**:
\`\`\`lua
-- Atomic Lua script (executes atomically in Redis)
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local current = redis.call('INCR', key)
if current == 1 then
  redis.call('EXPIRE', key, window)
end
if current > limit then
  return 0  -- rate limited
end
return 1  -- allowed
\`\`\`

**Architecture**:
- Rate limiter as middleware (API Gateway layer or sidecar).
- Redis Cluster for distributed counter storage. Use pipeline for low latency.
- Response headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After.
- HTTP 429 Too Many Requests on limit exceeded.
- Multi-tier: per-IP (DDoS protection) + per-API-key (quota) + per-endpoint (protection).`,
  },
  {
    id: "sd5", domain: "System Design", type: "technical", difficulty: "Hard",
    question: "Design a distributed cache system like Redis. What are the key architectural decisions?",
    hint: "Cover eviction policies, data structures, persistence, replication, clustering (consistent hashing), and cache invalidation strategies.",
    keyPoints: ["Eviction policies (LRU, LFU, TTL)", "Consistent hashing for sharding", "Replication (leader-follower)", "Cache-aside vs write-through vs write-behind", "Hot key problem"],
    modelAnswer: `**Core Data Structures**: Strings, Hashes, Lists, Sets, Sorted Sets, HyperLogLog, Streams. Each optimised in memory with ziplist/listpack encoding for small sizes.

**Eviction Policies** (when memory full):
- **LRU** (Least Recently Used): evict item not accessed longest. Good for general workloads.
- **LFU** (Least Frequently Used): evict item accessed fewest times. Better for skewed access patterns.
- **TTL-based**: set expiry per key. Active expiry on access + passive lazy expiry background thread.

**Persistence**:
- **RDB** (snapshot): periodic point-in-time dump. Fast restart, potential data loss.
- **AOF** (Append-Only File): log every write command. Durable but slower. Best: AOF with fsync every second.

**Clustering — Consistent Hashing**:
- Hash key → position on ring → nearest node clockwise.
- Adding/removing a node only redistributes keys from/to adjacent nodes (~1/n of keys).
- Redis Cluster: 16,384 hash slots distributed across nodes. Each node handles a slot range.

**Replication**: Leader-follower. Leader handles writes, followers replicate async. Sentinel for automatic failover. Redis Cluster has built-in replication (1 primary + N replicas per shard).

**Caching Patterns**:
- **Cache-aside** (lazy loading): App checks cache, on miss fetches from DB and populates cache. Most common.
- **Write-through**: Write to cache and DB synchronously. Consistent but slower writes.
- **Write-behind**: Write to cache, async flush to DB. Fast writes, risk of data loss.

**Problems & Solutions**:
- **Cache avalanche**: Many keys expire at once → DB overload. Add random jitter to TTLs.
- **Cache penetration**: Non-existent keys miss cache every time → cache null results with short TTL, or Bloom Filter.
- **Hot key**: One key gets millions of requests/sec → replicate hot keys across multiple instances, local in-process cache.`,
  },
  {
    id: "sd6", domain: "System Design", type: "technical", difficulty: "Hard",
    question: "Design a Search Autocomplete (typeahead) system like Google Search suggestions. Handle 10M queries/day.",
    hint: "Cover data collection (query log aggregation), Trie vs inverted index for prefix matching, ranking by frequency/personalisation, and low-latency serving.",
    keyPoints: ["Trie for prefix matching", "Top-k per prefix caching", "Query log aggregation pipeline", "Debounce on client", "Personalisation layer"],
    modelAnswer: `**Requirements**: Return top-5 suggestions for a prefix within 100ms. 10M queries/day = ~115 QPS average, peak 3×.

**Data Collection Pipeline**:
- Log all search queries with timestamps to Kafka.
- Spark/Flink aggregation job (hourly/daily): count query frequencies, compute trending score.
- Store in: {prefix → [(query, score), ...]} materialised in a fast KV store.

**Core Data Structure — Trie with Top-k Cache**:
\`\`\`
TrieNode {
  children: Map<char, TrieNode>
  topK: [(query, score)]  ← top 5 queries for this prefix
}
\`\`\`
Each node caches the top-5 queries for its prefix. Insert is O(L), lookup is O(L), topK access is O(1). Rebuild trie periodically from aggregated query data.

**Alternative — Inverted Index approach**: Elasticsearch/OpenSearch with prefix query. Easier to operate but higher latency. Use for personalised suggestions.

**Read Path** (hot path, must be <100ms):
1. Client debounces input (300ms) — reduces API calls by 70%.
2. Client-side cache of recent prefix results.
3. CDN caches top N prefix responses (covers 80% of traffic).
4. Autocomplete service reads from pre-built trie in memory.

**Scale**:
- Trie for 1M queries ≈ 1GB RAM. Shard by first character (26 shards).
- 5 read replicas per shard, load balanced.
- Rebuild trie in background, hot-swap atomically.

**Personalisation** (optional): Blend global score with user's own search history using weighted sum. Stored in user profile cache (Redis).`,
  },
  {
    id: "sd7", domain: "System Design", type: "technical", difficulty: "Hard",
    question: "Design a chat system like WhatsApp. How do you handle real-time message delivery, storage, and offline users?",
    hint: "Cover WebSocket connections, message queuing for offline delivery, chat storage (append-only log), group chat fan-out, and end-to-end encryption.",
    keyPoints: ["WebSocket for real-time", "Presence service", "Message store (Cassandra)", "Fan-out for group chat", "Push notification for offline users"],
    modelAnswer: `**Core Components**:

**1. Connection Service** (WebSocket servers):
- Each client maintains a persistent WebSocket to a connection server.
- Connection servers are stateful (hold socket references) — can't scale with simple round-robin.
- Connection registry: user_id → {server_id, socket_id} stored in Redis.

**2. Message Flow** (1-to-1 chat):
\`\`\`
Sender → Connection Server A
  → Message Service (persist to Cassandra)
  → Look up recipient's server from Redis
  → Push to Connection Server B → Recipient socket
\`\`\`

**3. Offline Delivery**:
- If recipient is offline (not in connection registry): store message in inbox (Cassandra), send push notification (APNs/FCM).
- On reconnect: client requests messages since last_seen_id. Inbox drained, push delivered.

**4. Storage** — Cassandra (append-only, high write throughput):
\`\`\`
Table: messages
  partition key: conversation_id
  clustering key: message_id (time-ordered Snowflake ID)
  columns: sender_id, content, timestamp, status
\`\`\`
Supports: fetch messages in a conversation (range scan by clustering key). Cassandra handles millions of writes/sec.

**5. Group Chat Fan-out**:
- Small groups (<500): write a copy to each member's inbox (fan-out on write).
- Large groups/broadcast channels (like WhatsApp Communities): fan-out on read — store one message, readers fetch on demand.

**6. Presence Service**:
- Users send heartbeat every 30s. Redis sorted set: user_id → last_heartbeat_timestamp.
- "Online" if heartbeat < 30s ago. "Last seen" stored on disconnect.

**7. End-to-End Encryption**:
- Signal Protocol: Double Ratchet algorithm. Server stores only encrypted ciphertext. Keys never leave devices.`,
  },
];

// ─── CI/CD & DevOps ───────────────────────────────────────────────────────────
export const CICD_DEVOPS_QUESTIONS: QuestionBankItem[] = [
  {
    id: "cd1", domain: "CI/CD & DevOps", type: "technical", difficulty: "Medium",
    question: "Walk me through designing a complete CI/CD pipeline for a microservices application from code commit to production deployment.",
    hint: "Cover stages: lint → test → build → security scan → push image → deploy to staging → smoke test → prod → rollback.",
    keyPoints: ["Pipeline stages", "Parallel execution", "Environment gates", "Rollback strategy", "Observability hooks"],
    modelAnswer: `**Pipeline Stages**:

**1. Code Commit → PR Trigger**
- Pre-commit hooks: lint (ESLint/Prettier), format check
- PR created: CI pipeline triggers automatically

**2. Build Stage** (parallel where possible)
- \`npm ci\` / \`mvn verify\` — reproducible dependency install
- Compile + generate artifacts
- Unit tests (Jest/JUnit) — fast feedback, < 5 min target

**3. Quality Gates** (parallel)
- SonarQube: code coverage threshold (e.g., 80%), code smells, security hotspots
- SAST: Snyk/Trivy for dependency vulnerabilities
- Container scan: Trivy on built Docker image

**4. Build & Push Image**
- \`docker build --cache-from\` for layer caching
- Tag with git SHA: \`registry/app:abc1234\`
- Push to ECR/ACR/GCR

**5. Deploy to Staging**
- Helm upgrade: \`helm upgrade --install app ./charts --set image.tag=abc1234\`
- ArgoCD sync for GitOps approach — update values.yaml SHA in Git
- Run integration tests + smoke tests against staging

**6. Production Deployment**
- Manual approval gate (GitHub Environments protection rule)
- Blue-green or Canary (send 10% traffic → monitor → 100%)
- Kubernetes: \`kubectl rollout status deployment/app --timeout=5m\`

**7. Post-Deploy**
- Smoke test against production endpoint
- Notify Slack/Teams with deployment summary
- Datadog/Grafana alert suppression window

**Rollback**:
- Automatic: if smoke tests fail → \`helm rollback app 1\`
- Manual: feature flags to disable functionality without redeploy`,
  },
  {
    id: "cd2", domain: "CI/CD & DevOps", type: "technical", difficulty: "Hard",
    question: "Explain Blue-Green vs Canary vs Rolling deployments. When would you use each in a Kubernetes environment?",
    hint: "Cover traffic splitting, rollback speed, resource cost, and stateful service considerations.",
    keyPoints: ["Zero-downtime strategies", "Traffic splitting", "Resource cost comparison", "Database migrations", "Feature flags"],
    modelAnswer: `**Blue-Green Deployment**:
- Run two identical environments (Blue = live, Green = new version).
- Switch traffic 100% at once via load balancer / DNS / Ingress.
- **Rollback**: instant — flip back to Blue.
- **Cost**: 2× resource usage during transition.
- **Best for**: Simple services, predictable traffic, when you need instant rollback.
- **Kubernetes**: Two Deployments with different labels, Service selector switched.

**Canary Deployment**:
- Gradually shift traffic: 5% → 25% → 50% → 100%.
- Monitor error rates, latency, business metrics at each step.
- **Rollback**: delete canary, traffic returns to stable.
- **Best for**: High-risk changes, stateless services with good observability.
- **Kubernetes**: Istio VirtualService weights or NGINX Ingress \`canary-weight\` annotation. Argo Rollouts automates progressive delivery with metric gates.

**Rolling Deployment**:
- Replace pods one-by-one (or N at a time). No extra infrastructure.
- \`maxSurge: 1, maxUnavailable: 0\` — always have N pods running.
- **Rollback**: \`kubectl rollout undo\` — rolls back pod-by-pod.
- **Best for**: Stateless services with backward-compatible changes.
- **Risk**: Mixed versions running simultaneously — API must be backward compatible.

**Database migrations**:
- Use **expand-contract** pattern with all strategies:
  1. Expand: add new column (nullable) — both versions work
  2. Migrate data in background
  3. Contract: remove old column after old version is gone

**My recommendation**: Canary + Argo Rollouts for critical services. Rolling for routine updates. Blue-Green for major releases with hard cutover requirements.`,
  },
  {
    id: "cd3", domain: "CI/CD & DevOps", type: "technical", difficulty: "Medium",
    question: "How do you implement secrets management in a Kubernetes-based CI/CD pipeline? Compare your approaches.",
    hint: "Cover Kubernetes Secrets limitations, HashiCorp Vault, AWS Secrets Manager, and sealed secrets.",
    keyPoints: ["Native K8s Secrets limitations (base64)", "Vault Agent Injector", "External Secrets Operator", "Sealed Secrets", "CI/CD secret injection"],
    modelAnswer: `**Problem with native Kubernetes Secrets**: Base64 encoded (not encrypted), stored in etcd. Anyone with kubectl access or etcd backup can decode them. Not suitable for production without additional encryption.

**Solutions**:

**1. HashiCorp Vault + Vault Agent Injector**:
- Vault stores secrets encrypted at rest with AES-256-GCM.
- Vault Agent runs as sidecar, fetches secrets at pod startup, writes to shared volume as files.
- Secrets never appear in K8s Secret objects.
- \`vault.hashicorp.com/agent-inject-secret-db-password: "secret/db/password"\`
- Supports dynamic secrets (short-lived DB credentials rotated automatically).

**2. External Secrets Operator (ESO)**:
- CRD-based: \`ExternalSecret\` references AWS Secrets Manager / GCP Secret Manager / Azure Key Vault.
- Operator syncs values to native K8s Secret on schedule.
- Secret values never in Git. Easy adoption, native K8s feel.
- Best when already on cloud-native stack.

**3. Sealed Secrets (Bitnami)**:
- CLI encrypts secret with cluster public key → stores encrypted \`SealedSecret\` in Git safely.
- Controller decrypts with private key in-cluster.
- GitOps friendly — everything in Git, encrypted.

**4. In CI/CD pipelines**:
- GitHub Actions: \`secrets.DB_PASSWORD\` — stored in GitHub Secrets, injected as env vars at runtime.
- Never print secrets in logs (\`add-mask\` in GitHub Actions).
- Rotate secrets post-deployment using Vault's lease system.

**Recommendation**: External Secrets Operator for cloud-native teams. Vault for multi-cloud or self-hosted with dynamic credentials.`,
  },
  {
    id: "cd4", domain: "CI/CD & DevOps", type: "technical", difficulty: "Medium",
    question: "What is GitOps? How does ArgoCD implement it and how does it differ from traditional push-based CI/CD?",
    hint: "Cover declarative state in Git, reconciliation loop, drift detection, and the pull vs push model.",
    keyPoints: ["Git as single source of truth", "Pull vs push model", "Reconciliation loop", "Drift detection", "Argo Rollouts for progressive delivery"],
    modelAnswer: `**GitOps Principles** (Weaveworks):
1. Declarative: Entire system described in Git (Kubernetes manifests, Helm charts, Kustomize).
2. Versioned & immutable: Git history = full audit trail.
3. Pulled automatically: Software agents pull desired state from Git.
4. Continuously reconciled: Agents ensure actual state matches desired state.

**Push-based CI/CD** (traditional Jenkins/GitHub Actions):
- CI pipeline pushes changes directly to Kubernetes (\`kubectl apply\`).
- CI server needs cluster credentials → security risk.
- No drift detection — manual changes to cluster go unnoticed.

**ArgoCD (Pull-based GitOps)**:
- ArgoCD runs inside the cluster, watches a Git repo.
- **Reconciliation loop**: every 3 minutes (default), compares live cluster state vs Git manifest state.
- **Drift detection**: If someone does \`kubectl scale deployment/app --replicas=5\` manually, ArgoCD detects drift and can auto-sync back to Git (replicas=3).
- **No credentials outside cluster**: CI pipeline only pushes to Git (updates image tag in values.yaml). ArgoCD pulls changes.

**Workflow**:
\`\`\`
Code Push → CI (test/build/push image) → Update image tag in Git repo
                                              ↓
                                        ArgoCD detects change
                                              ↓
                                        Syncs cluster to new state
                                              ↓
                                        Health checks + Slack notification
\`\`\`

**Benefits**: Faster rollback (git revert), full audit trail, cluster credentials stay in-cluster, multi-cluster management from one ArgoCD instance.`,
  },
  {
    id: "cd5", domain: "CI/CD & DevOps", type: "technical", difficulty: "Medium",
    question: "Explain Kubernetes resource requests vs limits. What happens when a container exceeds its memory limit? How do you right-size them?",
    hint: "Cover OOMKilled, CPU throttling, QoS classes, and VPA for automatic right-sizing.",
    keyPoints: ["Requests for scheduling", "Limits for enforcement", "OOMKilled vs CPU throttle", "QoS classes (Guaranteed/Burstable/BestEffort)", "VPA / HPA"],
    modelAnswer: `**Requests** = resources the scheduler uses for placement. Kubernetes guarantees this amount is available on the node.

**Limits** = maximum the container can use. Enforced by cgroups.

**What happens when exceeded**:
- **Memory**: Linux OOM killer terminates the process → pod restarts with \`OOMKilled\` status. No throttling — it's killed.
- **CPU**: Throttled (process is paused when it exceeds the limit). No kill. Can cause latency spikes — p99 latency increases when CPU is being throttled.

**QoS Classes**:
- **Guaranteed**: requests == limits for all containers → highest priority, never OOMKilled first.
- **Burstable**: requests < limits → evicted under memory pressure after BestEffort.
- **BestEffort**: no requests/limits set → evicted first.

**Right-sizing**:
1. **VPA (Vertical Pod Autoscaler)**: Recommends (or automatically applies) resource adjustments based on historical usage. Run in "Off" or "Recommend" mode first to inspect suggestions without disruption.
2. **kubectl top pods**: Current resource usage.
3. **Goldilocks** (Fairwinds): Namespace-level VPA recommendations dashboard.
4. Rule of thumb: Set requests at 50th percentile of usage, limits at 95th percentile + 20% buffer.

**Common mistake**: Setting limits too low causes OOMKilled loops. Setting limits very high wastes node resources and reduces bin-packing efficiency.`,
  },
  {
    id: "cd6", domain: "CI/CD & DevOps", type: "technical", difficulty: "Hard",
    question: "How do you implement observability (metrics, logs, traces) in a microservices architecture? What is the difference between monitoring and observability?",
    hint: "Cover the three pillars, OpenTelemetry for instrumentation, and correlation of signals across services.",
    keyPoints: ["Metrics vs Logs vs Traces", "OpenTelemetry SDK", "Trace correlation (trace-id)", "SLI/SLO/Error budget", "Alerting best practices"],
    modelAnswer: `**Monitoring vs Observability**:
- **Monitoring**: Watching known failure modes via dashboards and alerts on pre-defined metrics. Answers "Is it broken?"
- **Observability**: Ability to understand *why* a system is misbehaving from its outputs (metrics, logs, traces). Answers "What is broken and why?" — even for unknown failure modes.

**Three Pillars**:

**1. Metrics** (Prometheus + Grafana):
- Numeric measurements over time. Counter (req count), Gauge (memory), Histogram (latency distribution).
- RED Method: **R**ate, **E**rrors, **D**uration per service.
- USE Method: **U**tilisation, **S**aturation, **E**rrors per resource (CPU, disk).
- SLI: 99th percentile latency < 200ms. SLO: 99.9% of requests meet SLI. Error budget: 0.1% of requests can fail/month.

**2. Logs** (ELK / Loki + Grafana):
- Structured JSON logs with trace-id field for correlation.
- Log levels: DEBUG/INFO/WARN/ERROR — never log PII.
- \`{"level":"error","trace_id":"abc123","msg":"DB timeout","duration_ms":5001}\`

**3. Traces** (Jaeger / Zipkin / OTEL Collector):
- Distributed traces show request flow across services.
- Each trace has a trace_id; each hop = a span with duration, status, attributes.
- Identify which service in a chain is causing latency.

**OpenTelemetry**: Vendor-neutral SDK for all three pillars. Instrument once, export to any backend (Datadog, Grafana Tempo, Jaeger).

**Alerting rules**:
- Alert on SLO burn rate (multiwindow approach), not raw error count.
- Avoid alert fatigue: page only for actionable, high-severity issues.`,
  },
];

// ─── webMethods & B2B Integration ─────────────────────────────────────────────
export const B2B_INTEGRATION_QUESTIONS: QuestionBankItem[] = [
  {
    id: "wm1", domain: "B2B Integration", type: "technical", difficulty: "Medium",
    question: "What is webMethods Integration Server? Explain its core architecture components: Flow Services, Adapters, and IS packages.",
    hint: "Cover the IS runtime, service model, package structure, and how adapters abstract external systems.",
    keyPoints: ["IS runtime & service model", "Flow service vs Java service", "Package / namespace hierarchy", "Adapter framework", "Connection pooling"],
    modelAnswer: `**webMethods Integration Server (IS)** is an enterprise integration platform (EAI/B2B) that provides a runtime for executing integration logic, exposing services, and connecting to external systems.

**Core Architecture**:

**IS Runtime**: Java-based server (Jetty embedded). Manages service execution threads, connection pools, and the service cache. Services are invoked via HTTP, HTTPS, or messaging protocols.

**Packages**: The deployment unit in IS. A package is a folder under \`/IntegrationServer/packages/\` containing:
- \`ns/\` — namespace folders containing services, document types, specs
- \`config/\` — package-level configuration
- \`manifest.v3\` — dependencies and metadata

**Flow Services**: Graphical, XML-based integration logic. Steps include: INVOKE (call another service), BRANCH (conditional), LOOP (iterate over documents), MAP (transform data), SEQUENCE, TRY/CATCH. Stored as XML in the \`flow.xml\` file. No compiled binary — interpreted at runtime.

**Java Services**: Custom Java code embedded in the IS namespace. Used for complex logic not expressible in Flow. Compiled to .class files and stored in \`code/source/\`.

**Document Types**: Strongly-typed schemas (like XSD) defining the structure of IS Documents (similar to Maps/DTOs). Used for pipeline validation and mapping.

**Adapters**: Plugin modules that abstract connections to external systems.
- **JDBC Adapter**: SQL database access with connection pooling, transaction management.
- **SAP Adapter**: RFC/BAPI/IDoc connectivity to SAP.
- **Flat File Schema**: Parse fixed-width and delimited files into IS Documents.
- Each adapter creates **Adapter Connections** (pooled) and **Adapter Services** (CRUD operations, listeners).

**Pipeline**: The data flow mechanism — an in-memory map of key-value pairs (IS Documents, strings, etc.) passed between Flow steps. The input and output pipeline of every service call is visible in Designer.`,
  },
  {
    id: "wm2", domain: "B2B Integration", type: "technical", difficulty: "Hard",
    question: "Explain the webMethods Trading Networks architecture. How does it process B2B documents and what role does the TN processing rule play?",
    hint: "Cover Partner Profiles, document recognition, TN Console, processing rules, and the relationship with Integration Server.",
    keyPoints: ["Partner profile & external IDs", "Document recognition pipeline", "TN processing rules", "BizDoc types & attributes", "TN Console & activity log"],
    modelAnswer: `**webMethods Trading Networks (TN)** is a B2B hub that manages partner relationships, routes inbound/outbound documents, and provides end-to-end B2B visibility.

**Core Components**:

**Partner Profiles**: Define each trading partner with:
- External IDs (DUNS, EDI ISA ID, AS2 ID, custom identifiers)
- Delivery methods (AS2, SFTP, HTTP endpoints)
- Profile-level settings (acknowledgement requirements, retry policies)

**Document Recognition Pipeline** (when a B2B message arrives):
1. **Protocol layer**: AS2/HTTP listener receives raw payload.
2. **Envelope parsing**: Extract sender/receiver IDs (ISA header for X12, UNB for EDIFACT, envelope for XML).
3. **Partner lookup**: Match extracted IDs against registered Partner Profiles → identify Sender and Receiver.
4. **Document type recognition**: Match document structure to a BizDoc type (e.g., X12 850 Purchase Order, custom XML schema).
5. **BizDoc creation**: Store document in TN database with attributes (partner, doctype, docid, status, timestamps).
6. **Processing rule evaluation**: Rules are evaluated in priority order. The first matching rule fires.

**TN Processing Rules**:
- Criteria: sender, receiver, document type, custom attributes (e.g., customer code).
- Actions: Execute a service (IS Flow service), route to queue, send acknowledgement (997 FA or AS2 MDN), set status, notify by email.
- A Processing Rule is the bridge between TN's routing logic and IS's integration services.

**BizDoc Attributes**: Custom metadata extracted from document content (e.g., PO number, total amount) — queryable in TN Console for operational visibility.

**TN Console**: Web UI for monitoring B2B activity — view received/sent documents, resend failed documents, check acknowledgement status, filter by partner/doctype/date.

**TN + IS relationship**: TN handles B2B orchestration and visibility; IS handles the actual data transformation and backend system integration.`,
  },
  {
    id: "wm3", domain: "B2B Integration", type: "technical", difficulty: "Medium",
    question: "Describe the webMethods.IO Integration platform. How does it differ from on-premises Integration Server, and when would you choose one over the other?",
    hint: "Cover iPaaS model, connector ecosystem, cloud-native capabilities, and hybrid deployment scenarios.",
    keyPoints: ["iPaaS vs on-prem", "Pre-built connectors", "Hybrid integration via On-Premise Agent", "Low-code/no-code flow builder", "Cloud-native scalability"],
    modelAnswer: `**webMethods.IO Integration** is Software AG's cloud-native iPaaS (Integration Platform as a Service) hosted on AWS/Azure.

**Architecture Differences**:

| | webMethods IS (On-Prem) | webMethods.IO Integration |
|---|---|---|
| Deployment | Self-hosted, on-prem or VM | Fully managed SaaS |
| Scalability | Manual capacity planning | Auto-scaling, pay-per-use |
| Dev Experience | Eclipse Designer IDE | Browser-based flow builder |
| Connectivity | Adapters (complex setup) | 200+ pre-built connectors (SaaS apps) |
| Protocols | Deep EDI, legacy EAI | REST, modern SaaS APIs |
| Governance | Full control | Vendor-managed runtime |

**webMethods.IO Connectors**: Salesforce, ServiceNow, SAP, Slack, Workday, Stripe, GitHub, SQL databases — configured in minutes with OAuth.

**Hybrid Integration**: On-Premise Agent installed behind firewall. Cloud flows can invoke on-prem services and databases without exposing them to internet. Enables gradual cloud migration.

**When to choose webMethods.IO**:
- SaaS-to-SaaS integrations (Salesforce ↔ ServiceNow)
- Rapid prototyping / citizen integrator use cases
- No on-prem infrastructure desired
- API-first, REST-heavy integration landscape

**When to choose Integration Server (on-prem)**:
- Complex EDI/B2B with Trading Networks
- Legacy system connectivity requiring custom adapters
- High-volume, low-latency transaction processing
- Regulatory requirements to keep data on-prem
- Deep BPM / process orchestration needs

**Hybrid pattern**: Use IS for legacy/EDI; webMethods.IO for modern SaaS connectors; webMethods API Gateway in front of both.`,
  },
  {
    id: "wm4", domain: "B2B Integration", type: "technical", difficulty: "Medium",
    question: "What is webMethods BPM (Business Process Management)? How does a Process Model interact with Integration Server services?",
    hint: "Cover BPMN-based process modelling, human task steps, correlation, and the Process Audit Log.",
    keyPoints: ["BPMN-based modeller in Designer", "Automatic vs manual steps", "Correlation (joining running instances)", "Human task steps (My webMethods)", "Process Audit Log & monitoring"],
    modelAnswer: `**webMethods BPM** provides a BPMN-based runtime for long-running business processes that orchestrate both system integration and human workflow tasks.

**Process Model Components**:
- **Automatic Steps**: Invoke IS services (no human interaction). Fast, asynchronous.
- **Manual Steps (Human Tasks)**: Assigned to users/groups in My webMethods (MWS). Process waits until a human completes the task (approve PO, review exception).
- **Decision Steps**: Branch based on pipeline data.
- **Wait Steps**: Pause until a specific event arrives (correlation).
- **Sub-process Steps**: Embed another process model.

**How it works with IS**:
- Each Automatic step maps to an IS Flow service in a Process Package.
- The BPM runtime (running inside IS) invokes these services, passing the process pipeline data.
- The process maintains **state in the Process database** between steps — crucial for long-running (days/weeks) processes.

**Correlation**: When a process instance sends a PO and waits for a 855 (PO Acknowledgement), correlation binds the incoming 855 to the correct process instance using a shared key (e.g., PO Number). Defined in the process model as a "trigger" on the Wait step.

**Process Audit Log**: Every step execution, status change, and data snapshot is persisted. Enables:
- End-to-end process visibility in MWS Process Monitor
- SLA tracking (alert if step takes > X hours)
- Resubmission of failed instances after fixing the root cause

**Process Package**: webMethods Designer generates IS services for each process step — stored in a package named after the process. Never edit these generated services directly; they are regenerated on process publish.

**Use cases**: Order-to-Cash orchestration, invoice approval workflow, exception handling with human intervention, multi-partner B2B process coordination.`,
  },
  {
    id: "wm5", domain: "B2B Integration", type: "technical", difficulty: "Hard",
    question: "Explain AS2 protocol in the context of EDI B2B. What security features does it provide and how does webMethods handle AS2 trading partnerships?",
    hint: "Cover MIME, encryption, digital signatures, MDN acknowledgements, and non-repudiation.",
    keyPoints: ["MIME over HTTP/S", "S/MIME encryption (certificate exchange)", "Digital signature + non-repudiation", "MDN (synchronous/asynchronous)", "webMethods AS2 adapter / TN configuration"],
    modelAnswer: `**AS2 (Applicability Statement 2)** is a protocol for securely transmitting EDI and other business documents over HTTP/HTTPS using S/MIME security.

**Security Features**:

**1. Encryption**: Sender encrypts the payload with the **receiver's public certificate**. Only the receiver (holding the private key) can decrypt. Algorithm: 3DES or AES-256.

**2. Digital Signature**: Sender signs the message with their **own private key**. Receiver verifies with sender's public certificate → authenticates origin + ensures integrity (tamper detection).

**3. Non-Repudiation**: Signed messages + MDN receipts create a legal audit trail. The sender cannot deny sending the message; the receiver cannot deny receiving it.

**4. Transport Security**: AS2 runs over HTTPS → TLS encrypts the transport layer in addition to S/MIME at the message layer (defence in depth).

**MDN (Message Disposition Notification)**:
- **Synchronous MDN**: Receiver sends acknowledgement in the same HTTP response (within seconds). Simpler but keeps connection open.
- **Asynchronous MDN**: Receiver sends acknowledgement to a callback URL minutes/hours later (used for large files or slow processing).
- MDN itself can be signed → proves receipt.

**webMethods AS2 Configuration**:
1. In TN, configure partner profile with AS2 ID (matching ISA sender/receiver IDs).
2. Exchange certificates — import partner's public cert; provide your own public cert to partner.
3. Configure delivery method: partner's AS2 URL endpoint, encryption algorithm, signing algorithm, MDN type.
4. Inbound: webMethods HTTP listener → TN receives AS2 message → decrypts → verifies signature → sends MDN → processing rule fires.

**Common issues**: Certificate expiry (monitor and rotate 30 days before), AS2 ID mismatch, MDN URL not reachable from partner's network (firewall rules).`,
  },
  {
    id: "wm6", domain: "B2B Integration", type: "technical", difficulty: "Medium",
    question: "How does X12 EDI work? Explain the envelope structure (ISA/GS/ST segments) and common transaction sets used in supply chain.",
    hint: "Cover the three-layer envelope, segment terminators, common 8xx/8xx transaction sets, and how webMethods parses them.",
    keyPoints: ["ISA/IEA interchange envelope", "GS/GE functional group", "ST/SE transaction set", "Common transaction sets (850, 855, 856, 810, 997)", "webMethods Flat File Schema / TN document type"],
    modelAnswer: `**EDI X12 Envelope Structure** (3 nested layers):

\`\`\`
ISA*00*          *00*          *ZZ*SENDERID       *ZZ*RECEIVERID     *230315*1200*^*00501*000000001*0*P*>~
GS*PO*SENDERAPP*RECEIVERAPP*20230315*1200*1*X*005010~
ST*850*0001~
BEG*00*SA*PO-12345**20230315~
... (Purchase Order details) ...
SE*15*0001~
GE*1*1~
IEA*1*000000001~
\`\`\`

**ISA/IEA (Interchange Envelope)**: Outermost layer. Contains ISA sender/receiver IDs (used by TN for partner recognition), control number, and the component/element/segment separators.

**GS/GE (Functional Group)**: Groups transaction sets of the same type (e.g., all 850s). Contains application sender/receiver IDs and functional identifier code (PO = Purchase Order group).

**ST/SE (Transaction Set)**: The actual business document. ST has the transaction set ID (850) and a control number.

**Common Transaction Sets**:
- **850**: Purchase Order (buyer → supplier)
- **855**: PO Acknowledgement (supplier confirms/rejects)
- **856**: Advance Ship Notice / ASN (supplier notifies shipment)
- **810**: Invoice (supplier → buyer)
- **997**: Functional Acknowledgement (confirms receipt of a functional group)
- **940**: Warehouse Shipping Order
- **945**: Warehouse Shipping Advice

**webMethods Processing**:
1. Define X12 Flat File Schema in Designer (matches ISA version 005010/004010).
2. TN document type configured to recognise 850 by GS functional ID "PO".
3. TN parsing service converts raw X12 to IS Document (Maps).
4. Flow service reads \`BEG/BEG01\` (transaction purpose), \`PO1\` loops (line items), \`CTT\` (control totals).
5. Transform to internal format and POST to backend ERP.
6. Generate 997 FA and route back to sender via TN.`,
  },
  {
    id: "wm7", domain: "B2B Integration", type: "technical", difficulty: "Medium",
    question: "What is webMethods Universal Messaging? How does it differ from traditional message brokers and what delivery guarantees does it provide?",
    hint: "Cover channels vs queues, durable subscriptions, JMS compliance, and how IS uses UM as its messaging backbone.",
    keyPoints: ["Channels (pub/sub) vs Queues (point-to-point)", "Durable subscriptions", "JMS compliance", "Message persistence & delivery guarantees", "IS trigger services"],
    modelAnswer: `**webMethods Universal Messaging (UM)** is Software AG's high-performance messaging server. It replaces the older webMethods Broker and is the messaging backbone for IS, BPM, and TN.

**Core Concepts**:

**Channels** (Publish-Subscribe):
- Messages published to a channel are delivered to **all subscribers** (fan-out).
- **Durable subscriptions**: Subscriber registered with a named durable interest. UM stores messages while subscriber is offline and delivers on reconnect — no message loss.
- **Ephemeral**: Subscriber only receives messages while connected (like Kafka without consumer groups).

**Queues** (Point-to-Point):
- Each message consumed by exactly **one** consumer.
- Used for load balancing: multiple consumers on one queue → round-robin distribution.
- Persistent by default — survives UM server restart.

**Delivery Guarantees**:
- **At-most-once**: Fire and forget (ephemeral channels).
- **At-least-once**: Persistent queues/durable channels with acknowledgement. Consumer must ACK; if connection drops before ACK, UM redelivers.
- **Exactly-once**: UM + IS transactional triggers + XA transactions — expensive but possible.

**Integration with IS**:
- IS Messaging Trigger services subscribe to UM channels/queues.
- Trigger fires an IS service per incoming message.
- Supports concurrent trigger processing (configurable thread pool).
- JMS compliance: standard JMS API can be used to integrate non-webMethods applications.

**vs Kafka**: UM is tightly integrated with the webMethods ecosystem (IS, TN, BPM). Kafka is better for very high-throughput event streaming with long retention. UM excels in transactional B2B messaging with guaranteed delivery and the IS integration model.`,
  },
  {
    id: "wm8", domain: "B2B Integration", type: "technical", difficulty: "Medium",
    question: "Compare MuleSoft Anypoint Platform, Dell Boomi, and SAP Integration Suite for enterprise B2B/EAI use cases. What are their key architectural differences?",
    hint: "Cover runtime model, connector ecosystem, target user, on-prem vs cloud, and total cost of ownership.",
    keyPoints: ["MuleSoft runtime (Mule ESB)", "Boomi AtomSphere cloud-native", "SAP CPI for SAP-centric landscapes", "Low-code vs code-first", "Licensing and TCO"],
    modelAnswer: `**MuleSoft Anypoint Platform**:
- **Runtime**: Mule ESB (Java-based). Deploy as CloudHub (managed SaaS), Runtime Fabric (K8s), or on-prem.
- **Development**: DataWeave language for transformations (powerful, code-based). API-first with RAML/OAS design in API Designer.
- **Connectors**: Anypoint Exchange with 1000+ connectors.
- **Strengths**: API Management built-in (Anypoint Manager), complex transformations, Salesforce ecosystem (owned by SF).
- **Weaknesses**: Steep learning curve (DataWeave), expensive licensing, requires Mule runtime expertise.
- **Best for**: API-led connectivity, complex enterprise integrations, teams comfortable with code.

**Dell Boomi AtomSphere**:
- **Runtime**: Atom (lightweight JVM runtime). Fully cloud-managed; on-prem Atoms connect via cloud.
- **Development**: Visual low-code drag-and-drop. Very little coding required.
- **Connectors**: 200+ connectors, strong EDI/AS2/HL7 support.
- **Strengths**: Fastest time-to-value, citizen integrator friendly, good EDI support, Master Data Hub for data quality.
- **Weaknesses**: Less flexible for complex logic, limited API management.
- **Best for**: SME/mid-market, rapid SaaS integrations, teams without deep integration expertise.

**SAP Integration Suite (Cloud Integration / BTP)**:
- **Runtime**: Apache Camel-based, hosted on SAP BTP.
- **Development**: Graphical iFlow editor + Groovy/JavaScript for custom logic.
- **Connectors**: Deep SAP connectivity (S/4HANA, ECC, SuccessFactors), standard adapters for non-SAP.
- **Strengths**: Best-in-class for SAP-to-SAP and SAP-to-non-SAP. Included in SAP BTP license for many customers.
- **Weaknesses**: Poor non-SAP connectivity vs Boomi/MuleSoft, vendor lock-in.
- **Best for**: SAP-centric organisations, S/4HANA migration projects.

**Selection criteria**: If SAP shop → CPI. Rapid SaaS integrations without dev resources → Boomi. Complex APIs + enterprise governance → MuleSoft. Deep EDI + legacy webMethods → webMethods IS.`,
  },
];

// ─── API Management ───────────────────────────────────────────────────────────
export const API_MANAGEMENT_QUESTIONS: QuestionBankItem[] = [
  {
    id: "api1", domain: "API Management", type: "technical", difficulty: "Medium",
    question: "What is an API Gateway and what cross-cutting concerns does it handle? How does webMethods API Gateway differ from Kong?",
    hint: "Cover authentication, rate limiting, transformation, logging, and architectural differences (embedded policy engine vs plugin model).",
    keyPoints: ["Authentication/authorisation", "Rate limiting & throttling", "Request/response transformation", "Logging & analytics", "webMethods policy engine vs Kong plugins"],
    modelAnswer: `**API Gateway** acts as the entry point for API consumers, abstracting backend services and handling cross-cutting concerns:

**Core Functions**:
1. **Authentication & Authorisation**: OAuth 2.0 (token validation), API Keys, JWT verification, mTLS client certificates.
2. **Rate Limiting / Throttling**: Protect backends from overload. Token bucket or fixed window algorithms. Per-consumer, per-plan quotas.
3. **Request/Response Transformation**: Modify headers, transform JSON↔XML, inject security headers (CORS, CSP), remove sensitive fields from responses.
4. **Routing**: Path-based routing to different backend services. Load balancing across instances.
5. **Security**: IP allowlist/blocklist, OWASP API Top 10 protection (SQLi, XSS in query params), SSL termination.
6. **Observability**: Access logs, API analytics (requests/errors/latency per API/consumer), integration with Datadog/Splunk.

**webMethods API Gateway**:
- Policy-based: apply named policies (Authentication, Traffic Management, Routing, Mediation) to APIs via a UI or REST API.
- Tightly integrated with IS — can proxy IS services directly.
- API Portal companion for developer self-service (documentation, subscription, key management).
- Enterprise focus, strong governance, audit trails.
- On-prem or container-based deployment.

**Kong Gateway**:
- Plugin-based architecture. Each capability is a Lua/Go plugin.
- Highly extensible: custom plugins for any logic.
- Available as OSS (limited) or Enterprise (Kong Konnect — SaaS control plane + self-managed data planes).
- Excellent for multi-cloud/Kubernetes environments (Kong Ingress Controller).
- Larger open-source community.

**Choose webMethods AG**: Existing webMethods IS/TN landscape, enterprise B2B API exposure.
**Choose Kong**: Cloud-native, Kubernetes-first, microservices API gateway, strong OSS community.`,
  },
  {
    id: "api2", domain: "API Management", type: "technical", difficulty: "Medium",
    question: "Explain OAuth 2.0 flows. Which flow should you use for: a) server-to-server API calls, b) a web app with a backend, c) a mobile app?",
    hint: "Cover Authorization Code (+ PKCE), Client Credentials, Device, and why Implicit is deprecated.",
    keyPoints: ["Client Credentials for M2M", "Auth Code + PKCE for SPAs/mobile", "Auth Code with client secret for web servers", "Token introspection vs JWT", "Refresh tokens"],
    modelAnswer: `**OAuth 2.0 Flows**:

**a) Server-to-server (M2M) → Client Credentials Flow**:
- No user involved. Service authenticates with client_id + client_secret.
- POST /token with grant_type=client_credentials → returns access_token.
- Token stored securely server-side, never exposed to browser.
- Example: Microservice A calling Microservice B's API, scheduled job calling a partner API.

**b) Web app with a backend server → Authorization Code Flow**:
- Redirect user to auth server → user logs in → auth code returned to backend redirect URI.
- Backend exchanges code for access_token + refresh_token using client_secret.
- Client_secret stays server-side (never in browser).
- Token stored in backend session, not localStorage.

**c) Mobile / SPA (no backend) → Authorization Code + PKCE**:
- Same as Auth Code but replaces client_secret with **PKCE** (Proof Key for Code Exchange).
- Client generates code_verifier (random) and code_challenge (SHA256 hash).
- Sends code_challenge with auth request; sends code_verifier when exchanging code.
- Prevents auth code interception attacks on mobile (another app intercepting the redirect).
- Standard for all public clients (SPAs, React Native, Flutter apps).

**Why Implicit Flow is deprecated**: Returns access_token directly in URL fragment — exposed in browser history, referrer headers, logs. Auth Code + PKCE achieves the same with better security.

**Refresh Tokens**: Long-lived token to get new access_tokens without re-authentication. Store in HttpOnly cookie (web) or Keychain/Keystore (mobile). Rotate on each use (refresh token rotation) for better security.

**JWT vs Opaque Tokens**: JWT self-contained (validate locally, no network call) but can't be revoked before expiry. Opaque tokens require introspection endpoint but are revocable. Use JWT for high-scale APIs; opaque + introspection for high-security scenarios.`,
  },
  {
    id: "api3", domain: "API Management", type: "technical", difficulty: "Medium",
    question: "What is API versioning? Compare URI versioning, header versioning, and content negotiation. What strategy do you recommend and why?",
    hint: "Cover breaking vs non-breaking changes, deprecation lifecycle, and the trade-offs of each versioning approach.",
    keyPoints: ["Breaking vs non-breaking changes", "URI vs header vs content negotiation", "Deprecation strategy", "Semantic versioning for APIs", "Sunset header RFC 8594"],
    modelAnswer: `**Breaking vs Non-Breaking Changes**:
- **Non-breaking**: Add optional field, add new endpoint, relax validation → no versioning needed.
- **Breaking**: Remove field, rename field, change type, change error format, change auth scheme → requires version bump.

**URI Versioning** (most common): \`GET /api/v1/users\`, \`GET /api/v2/users\`
- **Pros**: Visible in URL, easy to route in gateway, simple caching (different cache keys).
- **Cons**: URL should represent resource not version. Can bloat routes. Clients hard-code v1.
- **Used by**: Stripe (\`/v1/charges\`), Twilio, most public APIs.

**Header Versioning**: \`Accept: application/vnd.myapi.v2+json\` or custom \`API-Version: 2\`
- **Pros**: Clean URLs, conforms to REST purists (URL = resource, not version).
- **Cons**: Not visible in browser address bar, harder to test/cache, gateway routing requires header inspection.
- **Used by**: GitHub API (Accept header).

**Content Negotiation (Media Type)**: \`Accept: application/vnd.myapi+json;version=2\`
- **Pros**: Purest REST approach, HTTP-standard.
- **Cons**: Complex to implement, poor tooling support, clients often get this wrong.

**Recommendation**: **URI versioning** for public/external APIs (discoverability, simplicity, caching). Header versioning for internal APIs where URL cleanliness matters to your team.

**Deprecation lifecycle**:
1. Announce version N+1 availability.
2. Add \`Deprecation: true\` and \`Sunset: Wed, 01 Jan 2026 00:00:00 GMT\` response headers to v1 (RFC 8594).
3. Monitor v1 usage in API Gateway analytics. Notify active consumers.
4. Sunset v1 on announced date.

**Never remove** a version without a 6-month deprecation window minimum for external APIs.`,
  },
];

// ─── Databases ────────────────────────────────────────────────────────────────
export const DATABASE_QUESTIONS: QuestionBankItem[] = [
  {
    id: "db1", domain: "Databases", type: "technical", difficulty: "Medium",
    question: "Explain database indexing. What types of indexes exist, when should you add one, and what are the downsides?",
    hint: "Cover B-tree, hash, composite, covering, and partial indexes. Discuss write overhead and when NOT to index.",
    keyPoints: ["B-tree vs Hash index", "Composite index column order", "Covering index", "Write overhead", "Index selectivity"],
    modelAnswer: `**B-Tree Index** (default in PostgreSQL/MySQL): Balanced tree structure. Supports equality (\`=\`), range (\`>, <, BETWEEN\`), and sort operations. O(log n) lookup. Used for most general queries.

**Hash Index**: O(1) equality lookup. Does NOT support range queries or sorting. PostgreSQL's hash indexes are WAL-logged since v10 and are crash-safe.

**Composite Index** (multi-column): \`CREATE INDEX idx ON orders (customer_id, created_at)\`. Column order matters — leftmost prefix rule: this index supports queries on \`customer_id\` alone OR \`customer_id + created_at\`, but NOT \`created_at\` alone.

**Covering Index**: Includes all columns the query needs → query satisfied entirely from index without touching the table (Index-Only Scan). \`CREATE INDEX idx ON orders (customer_id) INCLUDE (total, status)\`

**Partial Index**: Index only a subset of rows. \`CREATE INDEX idx ON orders (customer_id) WHERE status = 'PENDING'\` — smaller, faster for a common filter.

**When to add an index**:
- Columns frequently in WHERE, JOIN ON, ORDER BY.
- High-selectivity columns (many distinct values — user_id vs boolean is_active).
- Large tables where sequential scan is slow (> 100K rows).

**Downsides**:
- Every INSERT/UPDATE/DELETE must maintain all indexes → write overhead (slower writes).
- Storage overhead (B-tree index can be 10-30% of table size).
- Query planner may choose wrong index — use EXPLAIN ANALYZE to verify.

**Rule of thumb**: Don't over-index. Start with no indexes, profile with real queries using EXPLAIN ANALYZE, add indexes for specific slow queries.`,
  },
  {
    id: "db2", domain: "Databases", type: "technical", difficulty: "Hard",
    question: "What are database transactions and ACID properties? Explain isolation levels and the anomalies each prevents.",
    hint: "Cover all four ACID properties and all four standard isolation levels with their associated read phenomena.",
    keyPoints: ["Atomicity, Consistency, Isolation, Durability", "Dirty read, Non-repeatable read, Phantom read", "Read Uncommitted → Serializable", "MVCC in PostgreSQL"],
    modelAnswer: `**ACID Properties**:
- **Atomicity**: All operations in a transaction succeed, or all are rolled back. No partial writes.
- **Consistency**: Transaction brings DB from one valid state to another. Constraints (FK, CHECK, UNIQUE) enforced.
- **Isolation**: Concurrent transactions appear to execute serially. Controlled by isolation level.
- **Durability**: Committed transactions survive crashes. Ensured by WAL (Write-Ahead Logging).

**Read Phenomena**:
- **Dirty Read**: Transaction T2 reads data written by T1 that hasn't committed yet. If T1 rolls back, T2 read invalid data.
- **Non-Repeatable Read**: T2 reads a row twice, T1 modifies+commits between reads → different results.
- **Phantom Read**: T2 executes same range query twice, T1 inserts rows between reads → different row set.

**Isolation Levels**:
| Level | Dirty Read | Non-Repeatable | Phantom |
|---|---|---|---|
| Read Uncommitted | ✅ possible | ✅ possible | ✅ possible |
| Read Committed | ❌ prevented | ✅ possible | ✅ possible |
| Repeatable Read | ❌ prevented | ❌ prevented | ✅ possible (MySQL prevents with gap locks) |
| Serializable | ❌ | ❌ | ❌ prevented |

**PostgreSQL uses MVCC (Multi-Version Concurrency Control)**:
- Readers don't block writers, writers don't block readers.
- Each transaction sees a snapshot of the DB as of its start time.
- Default is Read Committed. No Read Uncommitted support.
- Serializable Snapshot Isolation (SSI) implemented in PostgreSQL — true serializability without traditional locking.

**Practical advice**: Most apps use Read Committed (PostgreSQL default). Use Repeatable Read for reports that need consistent data across multiple queries. Use Serializable only for financial transactions requiring strict correctness.`,
  },
  {
    id: "db3", domain: "Databases", type: "technical", difficulty: "Hard",
    question: "When would you choose a NoSQL database over a relational database? Compare document, key-value, wide-column, and graph stores.",
    hint: "Focus on data model fit, CAP theorem trade-offs, query patterns, and horizontal scaling characteristics.",
    keyPoints: ["CAP theorem", "Schema flexibility vs consistency", "Query pattern fit", "Horizontal scaling", "Eventual vs strong consistency"],
    modelAnswer: `**Choose NoSQL when**:
- Data model is hierarchical/document-like and doesn't fit relational tables well.
- Need horizontal scale-out beyond what vertical scaling + read replicas can handle.
- Schema changes frequently (agile development, evolving data models).
- Very high write throughput (>100K writes/sec) or massive data volume (petabytes).
- Need geo-distributed multi-region writes.

**Document Stores (MongoDB, Firestore, CouchDB)**:
- Data: JSON/BSON documents with nested arrays and objects.
- Best for: Product catalogues, content management, user profiles where data is naturally hierarchical.
- Trade-off: No joins (embed or application-level join), flexible schema but inconsistent data.
- Querying: Rich query language, secondary indexes, aggregation pipelines.

**Key-Value Stores (Redis, DynamoDB, Riak)**:
- Data: Opaque value for a key. Extremely fast O(1) lookup.
- Best for: Caching (Redis), session storage, shopping cart, leaderboards (Redis Sorted Sets).
- Trade-off: No complex queries. Only lookup by key.

**Wide-Column Stores (Cassandra, HBase, Google Bigtable)**:
- Data: Rows with dynamic columns. Optimised for time-series and write-heavy workloads.
- Best for: IoT sensor data, event logs, time-series analytics, messaging platforms (WhatsApp uses Cassandra for messages).
- Trade-off: Limited query flexibility. Design tables around query patterns (denormalised, single-partition queries).
- Cassandra: Leaderless replication → very high write availability. Tunable consistency (QUORUM, ONE).

**Graph Databases (Neo4j, Amazon Neptune)**:
- Data: Nodes, edges, properties.
- Best for: Social networks, recommendation engines, fraud detection, knowledge graphs.
- Advantage: Traversing relationships is O(1) per hop (vs SQL JOIN which scans).

**CAP Theorem**: Distributed systems can guarantee only 2 of 3: Consistency, Availability, Partition Tolerance. Cassandra = AP (available, eventually consistent). PostgreSQL = CP (consistent, may be unavailable during partition).`,
  },
  {
    id: "db4", domain: "Databases", type: "technical", difficulty: "Hard",
    question: "Explain database replication and sharding. What are the consistency trade-offs and how would you shard a users table?",
    hint: "Cover leader/follower replication, replication lag, hash vs range sharding, cross-shard queries, and hot-spot problem.",
    keyPoints: ["Leader-follower vs multi-leader", "Replication lag & read-your-writes", "Hash vs range sharding", "Hot shard problem", "Cross-shard joins"],
    modelAnswer: `**Replication** (copies of same data on multiple nodes):

**Leader-Follower (Primary-Replica)**:
- All writes go to the leader. Leader replicates to followers asynchronously.
- Reads can go to followers → reduces leader load.
- **Replication lag**: Follower may be seconds/minutes behind. Reading from follower after a write can return stale data ("read-your-writes" problem).
- Fix: Route reads that need fresh data to leader. Or synchronous replication (slower writes, guaranteed consistency).

**Multi-Leader**: Multiple leaders accept writes. Used for multi-region active-active setups. Complex conflict resolution needed (last-write-wins, CRDTs, application-level merge).

**Sharding** (partitioning data across multiple nodes to scale writes):

**Hash Sharding**: \`shard_id = hash(user_id) % num_shards\`
- Uniform distribution. No hot spots based on key range.
- Problem: Range queries across shards require scatter-gather. Resharding (adding shards) requires rehashing all data.

**Range Sharding**: Shard by user_id ranges (1-1M → shard1, 1M-2M → shard2).
- Good for range queries (e.g., time-series partitioned by date).
- Hot-spot risk: if IDs are sequential, all new users go to the last shard.

**Sharding the users table**:
- Hash shard by user_id. 16 shards initially (plan for growth).
- User lookup: hash(user_id) → shard. O(1).
- Username lookup: username → user_id mapping in a global index (separate unsharded table or ElasticSearch).
- Cross-shard queries (count all users, global search): either scatter-gather + aggregate or maintain a global analytics DB.

**Consistent Hashing**: Place shards on a ring. Adding a new shard only moves ~1/N of keys. Used by DynamoDB, Cassandra, Redis Cluster.`,
  },
  {
    id: "db5", domain: "Databases", type: "technical", difficulty: "Medium",
    question: "What is a Stored Procedure vs a Function vs a View in SQL? When would you use each and what are the risks?",
    hint: "Cover transaction control in SPs, determinism in functions, and the performance vs maintainability trade-offs.",
    keyPoints: ["SP: transaction control, DML", "Function: deterministic, usable in SELECT", "View: abstraction layer", "Security (SQL injection in SPs)", "Maintainability risks"],
    modelAnswer: `**Stored Procedure**:
- Named block of SQL + procedural logic (IF/ELSE, LOOP, EXCEPTION handling) stored in DB.
- Can contain DML (INSERT/UPDATE/DELETE), DDL, transaction control (COMMIT/ROLLBACK).
- Called with EXECUTE/CALL. Cannot be used inside a SELECT.
- **Use for**: Complex multi-step data operations, batch processing, enforcing business rules at DB level.
- **Risk**: Business logic buried in DB → hard to version control, test, and deploy. Language-specific (PL/pgSQL, T-SQL). Tight coupling between app and DB.

**Function (UDF — User Defined Function)**:
- Returns a scalar value or table. Must be deterministic (same inputs → same output) for use in indexes.
- Can be called inside SELECT, WHERE, JOIN ON.
- **Use for**: Encapsulating reusable calculations (date formatting, currency conversion, business rules used in queries).
- Aggregate functions (GROUP BY), window functions (ROW_NUMBER, RANK).

**View**:
- Named SELECT query stored in DB. No data stored — executes query on access.
- Provides abstraction: hide column names, join complexity, or sensitive columns.
- **Materialized View**: Query result IS stored on disk, refreshed periodically. Fast reads, stale data risk.
- **Use for**: Simplify complex JOINs for reporting, enforce column-level security, provide stable API for reporting tools while refactoring tables.

**Security note**: Stored procedures with dynamic SQL (\`EXECUTE 'SELECT * FROM ' || tablename\`) are vulnerable to SQL injection. Use parameterised queries always.

**Modern alternative**: Many teams prefer ORMs (Prisma, SQLAlchemy) with repository patterns over SPs for better testability and version control. Use SPs only for performance-critical batch operations.`,
  },
];

// ─── Cloud Platforms ──────────────────────────────────────────────────────────
export const CLOUD_QUESTIONS: QuestionBankItem[] = [
  {
    id: "cl1", domain: "Cloud", type: "technical", difficulty: "Medium",
    question: "What is the difference between AWS SQS and SNS? When would you use each, and how do they work together in a fan-out pattern?",
    hint: "Cover message queuing vs pub/sub, visibility timeout, dead-letter queues, and the SNS→SQS fan-out pattern.",
    keyPoints: ["SQS: pull-based queue", "SNS: push-based pub/sub", "Fan-out: SNS topic → multiple SQS queues", "Dead-letter queues", "FIFO vs Standard"],
    modelAnswer: `**Amazon SQS (Simple Queue Service)**:
- Message queue. **Producers push** messages; **consumers poll** (pull).
- Message stays in queue until consumer deletes it after processing.
- **Visibility Timeout**: Message hidden from other consumers while being processed. If consumer crashes before deleting, timeout expires → message reappears for retry.
- **Dead-Letter Queue (DLQ)**: After N failed attempts, message moved to DLQ for manual inspection.
- **FIFO Queue**: Guarantees order and exactly-once processing. Lower throughput (3K msg/s with batching).
- **Standard Queue**: At-least-once, best-effort ordering. Near-unlimited throughput.
- Use for: decoupling services, task queues (email sending, image processing), retry logic.

**Amazon SNS (Simple Notification Service)**:
- Pub/sub. **Publisher → Topic**. Topic **pushes** to all subscribers simultaneously.
- Subscribers: SQS, Lambda, HTTP/S endpoints, email, SMS, mobile push.
- No storage — if subscriber is unavailable and no DLQ, message is lost.
- Use for: broadcasting events to multiple consumers, real-time notifications.

**Fan-out Pattern** (SNS + SQS together):
\`\`\`
Order Service → SNS topic "order-placed"
                    ↓           ↓           ↓
              SQS Queue    SQS Queue    SQS Queue
             (inventory)  (shipping)   (analytics)
\`\`\`
Each downstream service has its own SQS queue with its own retry/DLQ settings. SNS delivers reliably to all queues. Consumers process independently at their own pace.

**Why SQS in front of Lambda for processing**: SQS buffers spikes. Lambda scales from 0 to 1000 concurrent functions only as fast as SQS feeds it (configurable batch size). Prevents overwhelming downstream services.`,
  },
  {
    id: "cl2", domain: "Cloud", type: "technical", difficulty: "Medium",
    question: "Explain AWS IAM. What is the difference between IAM Roles, Policies, and Instance Profiles? What is the principle of least privilege?",
    hint: "Cover identity types, policy evaluation order, instance profile for EC2/Lambda, and common security mistakes.",
    keyPoints: ["Users vs Roles vs Groups", "Inline vs managed policies", "Policy evaluation (explicit deny wins)", "Instance profile for EC2", "Least privilege + STS assume role"],
    modelAnswer: `**IAM Identities**:
- **Users**: Long-term credentials for humans or applications. Access keys (ID + secret) for programmatic access. Should use MFA.
- **Groups**: Collection of users sharing the same policies. Easier policy management.
- **Roles**: Temporary credentials, no long-term keys. **Assumed** by trusted entities — EC2 instances, Lambda functions, other AWS accounts, federated identities (SSO).

**Policies**: JSON documents defining permissions.
- **Managed Policies**: AWS-managed (ReadOnlyAccess, AdministratorAccess) or Customer-managed. Reusable, versioned.
- **Inline Policies**: Embedded directly in a user/role/group. Not reusable. Use sparingly.
- **Resource-based Policies**: Attached to resources (S3 bucket policy, SQS queue policy). Allow cross-account access.

**Policy Evaluation Order**:
1. Start with deny all.
2. Evaluate all applicable policies.
3. **Explicit DENY overrides any ALLOW** (regardless of order).
4. If no explicit deny AND explicit allow exists → allow. Otherwise → implicit deny.

**Instance Profile**: Container for an IAM Role that EC2/Lambda can assume. EC2 instance retrieves temporary credentials via Instance Metadata Service (IMDS). Never put long-term access keys on EC2.

**Principle of Least Privilege**: Grant only the minimum permissions needed for the task.
- Use \`Condition\` blocks to restrict by source IP, VPC, time.
- Use resource-level permissions: \`arn:aws:s3:::my-bucket/*\` not \`*\`.
- Regularly review with IAM Access Analyzer and remove unused permissions.
- Use permission boundaries to cap what child roles can grant.

**Common mistake**: Using \`"Effect": "Allow", "Action": "*", "Resource": "*"\` — full admin access. Use AWS Access Advisor to see which services are actually used.`,
  },
  {
    id: "cl3", domain: "Cloud", type: "technical", difficulty: "Medium",
    question: "How does AWS Lambda work? Explain cold starts, concurrency models, and when Lambda is NOT the right choice.",
    hint: "Cover the execution environment lifecycle, provisioned concurrency, reserved concurrency, and trade-offs vs containers.",
    keyPoints: ["Execution environment lifecycle", "Cold start causes & mitigation", "Provisioned vs reserved concurrency", "Event sources (SQS, API GW, EventBridge)", "When to avoid Lambda"],
    modelAnswer: `**Lambda Execution Model**:
- AWS provisions a micro-VM (Firecracker) per invocation. First invocation = **cold start**: download code, init runtime, run init code.
- Subsequent invocations reuse the warm environment — fast (~1ms overhead vs 100–500ms cold start).

**Cold Start Causes**:
- Infrequent invocations (environment recycled after ~15 min idle).
- Large deployment packages (> 10MB zip).
- Heavy init code (DB connections, SDK initialisation in global scope).
- VPC-attached Lambdas (ENI provisioning) — largely fixed by hyperplane ENI pooling.

**Mitigation**:
- **Provisioned Concurrency**: pre-warm N environments, always ready. Costs $ even when idle.
- Keep package size small (tree-shaking, Lambda layers for shared deps).
- Move heavy init to global scope (runs once per cold start, not per invocation).
- Scheduled ping (EventBridge rule every 5 min) — cheap but unreliable.

**Concurrency**:
- **Reserved Concurrency**: cap max concurrent invocations for a function (throttle protection).
- **Provisioned Concurrency**: pre-initialised environments for predictable performance.
- Default account limit: 1000 concurrent executions per region. Request increase as needed.

**Event Sources**: API Gateway (sync), SQS (async, batch), SNS, EventBridge, S3 events, DynamoDB Streams, Kinesis.

**When NOT to use Lambda**:
- Execution > 15 minutes (Lambda max timeout).
- Long-lived WebSocket connections (use ECS/Fargate).
- High-frequency, steady workloads — always-on containers are cheaper.
- GPU workloads, custom runtimes not supported.
- Latency-sensitive paths where cold starts are unacceptable and provisioned concurrency cost is too high.`,
  },
  {
    id: "cl4", domain: "Cloud", type: "technical", difficulty: "Medium",
    question: "Compare EKS, ECS, and Lambda for running containerised workloads on AWS. How do you choose?",
    hint: "Cover operational complexity, cost model, scaling behaviour, and the right use case for each.",
    keyPoints: ["EKS: Kubernetes, max control", "ECS: AWS-native, simpler", "Lambda: serverless, event-driven", "Fargate: serverless compute for ECS/EKS", "Cost: idle vs active"],
    modelAnswer: `**AWS Lambda**:
- No containers to manage. Deploy code (zip or container image up to 10GB).
- Scales to 0 (no cost when idle). Scales to thousands of concurrent executions automatically.
- **Best for**: Event-driven, short-lived tasks (<15 min), unpredictable or spiky traffic, data pipelines, API backends with variable load.
- **Not for**: Long-running processes, always-on services, GPU workloads.

**Amazon ECS (Elastic Container Service)**:
- AWS-native container orchestration. Less complex than Kubernetes.
- Two launch types: **EC2** (you manage nodes) or **Fargate** (serverless — no node management).
- Tight integration with ALB, CloudWatch, IAM, ECR.
- **Best for**: Teams new to containers, microservices on AWS, when Kubernetes complexity isn't needed.
- Fargate: pay per vCPU/memory per second. No idle node cost.

**Amazon EKS (Elastic Kubernetes Service)**:
- Managed Kubernetes control plane. You manage worker nodes (EC2) or use Fargate/Karpenter.
- Full Kubernetes ecosystem: Helm, Istio, ArgoCD, KEDA, Prometheus.
- Portable: same manifests work on GKE, AKS, on-prem.
- **Best for**: Large engineering teams, multi-cloud strategy, complex workloads needing K8s ecosystem, existing Kubernetes expertise.
- Higher operational complexity and cost.

**Decision Framework**:
\`\`\`
Event-driven, short tasks → Lambda
Simple microservices, AWS-only → ECS + Fargate
Complex orchestration, K8s ecosystem → EKS
Need GPU / custom OS → EC2 Auto Scaling Groups
\`\`\`

**Cost Rule of Thumb**: For workloads running >40% of the time, EC2/Fargate is cheaper than Lambda. For <10%, Lambda wins.`,
  },
  {
    id: "cl5", domain: "Cloud", type: "technical", difficulty: "Medium",
    question: "Explain AWS VPC architecture. What is the difference between Security Groups, NACLs, and when would you use each?",
    hint: "Cover subnets (public/private), route tables, Internet Gateway, NAT Gateway, and the stateful vs stateless distinction between SGs and NACLs.",
    keyPoints: ["Public vs private subnets", "IGW vs NAT Gateway", "Security Groups (stateful)", "NACLs (stateless)", "VPC peering vs Transit Gateway"],
    modelAnswer: `**VPC (Virtual Private Cloud)**: Isolated network in AWS. You control IP ranges (CIDR), subnets, routing, and gateways.

**Subnet Types**:
- **Public Subnet**: Has a route to the Internet Gateway (IGW). Resources here get public IPs. For: load balancers, bastion hosts.
- **Private Subnet**: No direct internet route. For: application servers, databases. Outbound internet via NAT Gateway (in public subnet).

**Routing**:
- Route Table: per-subnet routing rules. Public subnet: 0.0.0.0/0 → IGW. Private subnet: 0.0.0.0/0 → NAT Gateway.
- NAT Gateway: allows outbound internet from private subnets (e.g., OS updates, API calls) without allowing inbound connections.

**Security Groups** (instance-level firewall):
- **Stateful**: if inbound traffic is allowed, response is automatically allowed (no need to add outbound rule).
- Allow rules only (no explicit deny).
- Evaluated as a group — all rules checked.
- **Use for**: fine-grained control at resource level. Default: deny all inbound, allow all outbound.

**NACLs** (subnet-level firewall):
- **Stateless**: must explicitly allow inbound AND outbound for each direction.
- Support allow AND deny rules. Rules evaluated in order (lowest number first).
- Applied at subnet boundary.
- **Use for**: blocking known malicious IPs, subnet-level isolation, additional defense layer.

**Layered Security**: NACLs (subnet boundary) + Security Groups (instance) = defense in depth.

**VPC Connectivity**:
- **VPC Peering**: direct connection between two VPCs. No transitive routing.
- **Transit Gateway**: hub-and-spoke connecting many VPCs + on-prem. Supports transitive routing.
- **VPC Endpoints**: private access to AWS services (S3, DynamoDB) without internet traffic.`,
  },
  {
    id: "cl6", domain: "Cloud", type: "technical", difficulty: "Medium",
    question: "Explain AWS RDS high availability. What is Multi-AZ vs Read Replicas vs Aurora? When would you choose each?",
    hint: "Cover synchronous vs asynchronous replication, failover time, read scaling vs HA, and Aurora's shared storage architecture.",
    keyPoints: ["Multi-AZ: synchronous, HA", "Read Replicas: async, read scaling", "Aurora: shared storage volume", "RPO vs RTO", "Aurora Global Database for multi-region"],
    modelAnswer: `**RDS Multi-AZ** (High Availability):
- Synchronous replication to a standby instance in another AZ.
- Standby is NOT readable — pure hot standby for HA.
- Automatic failover on primary failure: DNS CNAME updated in ~30-60s (RTO ~1 min, RPO ~0).
- **Use for**: production databases requiring HA with minimal data loss.

**RDS Read Replicas** (Read Scaling):
- Asynchronous replication. Replica can be in same AZ, different AZ, or different region.
- Readable — offload analytics/reporting queries from primary.
- **Replication lag**: async → potential stale reads (seconds of lag).
- Can be promoted to standalone DB in disaster recovery (RPO = replication lag, RTO = minutes).
- **Use for**: read-heavy workloads, analytics, reporting.

**Aurora** (AWS's reimagined relational DB):
- Shared distributed storage volume across 3 AZs (6 copies of data). No replication lag between writer and storage.
- **Aurora Replicas**: up to 15, all share the same storage → near-zero lag reads.
- Writer failover: ~30s (vs ~60s for RDS Multi-AZ). Replicas can be promoted to writer instantly.
- 5× better performance than MySQL RDS, 3× better than PostgreSQL RDS (AWS claims).
- **Aurora Serverless v2**: auto-scales compute (ACUs) from 0.5 to 128 ACUs. Zero when idle.
- **Aurora Global Database**: replicates across 5 regions with <1s lag. RTO <1 min for regional failover.
- **Use for**: business-critical apps needing high throughput, low-latency reads, or multi-region HA.

**Decision**:
- Dev/Test → Single-AZ RDS (cheapest)
- Production HA → Multi-AZ RDS
- High read traffic → Read Replicas
- Business-critical / high performance → Aurora
- Unpredictable workloads → Aurora Serverless`,
  },
  {
    id: "cl7", domain: "Cloud", type: "technical", difficulty: "Medium",
    question: "Compare Terraform and AWS CloudFormation for Infrastructure as Code. What are the key differences and when would you choose each?",
    hint: "Cover provider support, state management, HCL vs JSON/YAML, drift detection, and module/registry ecosystem.",
    keyPoints: ["Terraform: multi-cloud, HCL, state file", "CloudFormation: AWS-native, no state file", "Drift detection", "Modules vs Nested Stacks", "CDK as a middle ground"],
    modelAnswer: `**AWS CloudFormation**:
- AWS-native. Supports all AWS resources (often before Terraform).
- No separate state file — AWS manages stack state internally.
- Templates in JSON/YAML. Can use AWS CDK to generate CloudFormation (TypeScript/Python code → CF templates).
- **Stack Sets**: deploy across multiple accounts/regions.
- **Change Sets**: preview changes before applying. Rollback on failure.
- **Drift Detection**: built-in, detect manual changes to resources.
- **Best for**: AWS-only shops, teams preferring no extra tooling, tight AWS integration, compliance requiring AWS-native tooling.

**Terraform (HashiCorp)**:
- Multi-cloud: AWS, Azure, GCP, Kubernetes, Datadog, GitHub — 3000+ providers.
- HCL (HashiCorp Configuration Language) — more readable than YAML for complex configs.
- **State File**: stores resource metadata locally or in S3+DynamoDB (remote state with locking). Must manage carefully.
- **Plan/Apply**: \`terraform plan\` shows what will change before applying. Like CloudFormation Change Sets.
- **Modules**: reusable infrastructure components. Terraform Registry has thousands of community modules.
- **Workspaces**: manage multiple environments (dev/staging/prod) from one config.
- Drift detection: \`terraform plan\` shows drift but doesn't auto-detect.
- **Best for**: multi-cloud, teams with existing Terraform expertise, complex infrastructure, want rich module ecosystem.

**AWS CDK (Cloud Development Kit)**:
- Write infrastructure in TypeScript, Python, Java, Go — generates CloudFormation.
- Full programming language constructs (loops, conditions, abstractions) vs declarative YAML.
- Good middle ground: developer-friendly, AWS-native result.

**My recommendation**: Terraform for new multi-cloud or complex setups. CloudFormation/CDK for AWS-only shops wanting native integration.`,
  },
  {
    id: "cl8", domain: "Cloud", type: "technical", difficulty: "Medium",
    question: "How do you optimize AWS costs? Explain Reserved Instances, Savings Plans, Spot Instances, and architectural strategies.",
    hint: "Cover commitment-based discounts vs on-demand, Spot interruption handling, rightsizing, and architectural patterns like auto-scaling and serverless.",
    keyPoints: ["On-demand vs Reserved vs Savings Plans vs Spot", "Spot interruption handling", "Rightsizing with Compute Optimizer", "Auto-scaling", "Cost allocation tags"],
    modelAnswer: `**EC2 Pricing Models**:

| Model | Discount | Commitment | Best For |
|---|---|---|---|
| On-Demand | 0% | None | Dev/test, unpredictable |
| Reserved Instances | up to 72% | 1-3 years | Steady-state prod |
| Savings Plans | up to 66% | 1-3 years | Flexible (any instance type) |
| Spot Instances | up to 90% | None | Fault-tolerant, batch |

**Reserved Instances**: Commit to specific instance type/region. Standard RI = 40% locked. Convertible RI = change instance family.

**Savings Plans** (preferred over RIs): Commit to $ spend/hour. EC2 Savings Plans = flexibility within instance family. Compute Savings Plans = any EC2/Lambda/Fargate. Easier to manage.

**Spot Instances**: Use spare AWS capacity. Can be interrupted with 2-min warning.
- Best for: batch jobs, ML training, CI/CD workers, stateless microservices with auto-scaling.
- Handle interruptions: catch termination signal, checkpoint work, use Spot Fleet with mixed instance types.

**Architectural Optimizations**:
1. **Auto-scaling**: scale in during off-peak. Schedule scale-in at night.
2. **Serverless shift**: Lambda + Fargate = pay per use, no idle cost.
3. **S3 storage classes**: move infrequently accessed data to S3-IA (40% cheaper), Glacier (90% cheaper) via lifecycle rules.
4. **RDS rightsizing**: AWS Compute Optimizer identifies over-provisioned instances.
5. **Data transfer**: minimize cross-AZ traffic (high cost). Use VPC Endpoints for S3/DynamoDB (free within VPC).
6. **Trusted Advisor + Cost Explorer**: weekly review. Set billing alerts. Tag all resources for cost allocation.

**Rule of thumb**: 20-30% savings from Savings Plans + 15% from rightsizing = 35-45% cost reduction with no code changes.`,
  },
];

// ─── QA & Testing ─────────────────────────────────────────────────────────────
export const QA_TESTING_QUESTIONS: QuestionBankItem[] = [
  {
    id: "qa1", domain: "QA & Testing", type: "technical", difficulty: "Medium",
    question: "What is the Test Pyramid? How does it apply to a microservices architecture and what is the risk of an inverted pyramid?",
    hint: "Cover unit/integration/e2e proportions, speed vs reliability trade-offs, and contract testing as an alternative to e2e.",
    keyPoints: ["Unit (fast/cheap) → Integration → E2E (slow/expensive)", "Inverted pyramid anti-pattern", "Contract testing (Pact)", "Test doubles (mock/stub/spy)", "Microservices boundary testing"],
    modelAnswer: `**Test Pyramid (Mike Cohn)**:
\`\`\`
         /  E2E  \\    ← few, slow, expensive, brittle
        /----------\\
       / Integration \\  ← moderate, test service boundaries
      /--------------\\
     /   Unit Tests   \\ ← many, fast, isolated, cheap
    /------------------\\
\`\`\`

**Unit Tests**: Test a single function/class in isolation. Mock all dependencies. Run in milliseconds. 70-80% of test suite. High developer productivity feedback.

**Integration Tests**: Test interactions between components — service + database, service + message queue, HTTP client + real server (TestContainers). Slower (seconds) but catch real integration bugs.

**E2E Tests**: Test entire user journeys through the deployed system. Slow (minutes), brittle (fail for unrelated reasons — timeouts, test data), expensive to maintain. 10-20 tests covering critical paths only.

**Inverted Pyramid (Anti-Pattern)**:
- Many E2E tests, few unit tests. Slow CI (30+ min), flaky failures block releases, hard to isolate failures. Common in legacy test-first waterfall organisations.

**In Microservices**:
- E2E across many services is extremely brittle — which service caused the failure?
- **Contract Testing (Pact)**: Consumer defines what it expects from a provider API. Provider verifies it meets all consumer contracts. No running instances needed. Fast, isolated, prevents breaking API changes. Excellent replacement for many E2E tests.
- **Component Tests**: Test a single microservice with all external dependencies stubbed (WireMock for HTTP, TestContainers for DB). Tests the service boundary.

**Recommendation**: For microservices — 60% unit, 30% component/contract, 10% E2E (smoke tests only). Use Pact for inter-service contracts.`,
  },
  {
    id: "qa2", domain: "QA & Testing", type: "technical", difficulty: "Medium",
    question: "How does Playwright differ from Selenium for modern web testing? What features make it the industry's preferred choice now?",
    hint: "Cover auto-wait, browser contexts, network interception, parallel execution, and Playwright's built-in test runner.",
    keyPoints: ["Auto-wait vs explicit waits", "Browser contexts for parallelism", "Network interception / mocking", "Playwright Test runner", "Cross-browser support (Chromium/Firefox/WebKit)"],
    modelAnswer: `**Selenium (WebDriver protocol)**:
- Drives browsers via WebDriver spec. Supports all major browsers.
- Requires explicit waits: \`WebDriverWait(driver, 10).until(EC.element_to_be_clickable(locator))\`
- No built-in network interception (needs proxy setup like BrowserMob).
- Test framework separate: TestNG/JUnit (Java), pytest (Python).
- Heavier setup: Selenium Grid for parallelism, ChromeDriver version management.
- Mature, large ecosystem, supports legacy apps.

**Playwright (Microsoft, 2020)**:
- Direct WebSocket communication with browser — faster, more reliable.
- **Auto-wait**: Before interacting with an element, Playwright automatically waits for it to be visible, enabled, not animating. Eliminates most flaky tests. No \`time.sleep()\`.
- **Browser Contexts**: Isolated browser environments within one browser instance. Create 50 parallel contexts faster than 50 browser instances. Each context = separate cookies, localStorage, sessions.
- **Network Interception**: \`page.route('**/api/users', route => route.fulfill({ json: [...] }))\` — mock APIs without a proxy. Block third-party scripts.
- **Playwright Test**: Built-in test runner with parallel execution, retry on failure, rich HTML report, video recording, screenshots on failure.
- **Trace Viewer**: Record execution trace — replay step-by-step in a browser UI for debugging failures in CI.
- **Codegen**: Record user actions → generate test code automatically.
- Cross-browser: Chromium, Firefox, WebKit (Safari) — maintained by Microsoft, always up-to-date.

**When to keep Selenium**: Legacy Java-heavy teams, SAP GUI / thick-client testing, existing large Selenium suite where migration cost > benefit, Internet Explorer (yes, some enterprise still).

**Verdict**: For greenfield projects, Playwright is the clear winner. Faster execution, fewer flaky tests, better developer experience.`,
  },
  {
    id: "qa3", domain: "QA & Testing", type: "technical", difficulty: "Medium",
    question: "How do you approach performance and load testing? Explain load vs stress vs spike vs soak testing and how you'd use k6 or JMeter.",
    hint: "Cover the four test types, key metrics (TPS, latency p95/p99, error rate), and how to set up a realistic load model.",
    keyPoints: ["Load vs stress vs spike vs soak", "TPS, p95/p99 latency, error rate thresholds", "Virtual users vs arrival rate", "Baseline before optimising", "k6 scripting"],
    modelAnswer: `**Performance Test Types**:

| Type | Purpose | Duration |
|---|---|---|
| **Load** | Verify system under expected traffic | 30-60 min |
| **Stress** | Find breaking point (beyond expected load) | Until failure |
| **Spike** | Sudden 10× traffic increase | Short bursts |
| **Soak** | Long-duration at normal load (memory leaks) | 8-24 hours |

**Key Metrics**:
- **Throughput**: requests/sec (RPS/TPS).
- **Latency**: p50 (median), **p95**, **p99** — tails matter more than average. SLA often defined on p99.
- **Error Rate**: % of failed requests. >1% is usually unacceptable.
- **Resource utilisation**: CPU, memory, DB connections, thread pool saturation.

**k6 Load Test Script**:
\`\`\`javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 },  // ramp up
    { duration: '5m', target: 100 },  // steady load
    { duration: '2m', target: 0 },    // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% of requests < 500ms
    http_req_failed: ['rate<0.01'],    // error rate < 1%
  },
};

export default function () {
  const res = http.get('https://api.example.com/products');
  check(res, { 'status 200': (r) => r.status === 200 });
  sleep(1);
}
\`\`\`

**Process**: Establish baseline → load test → identify bottleneck → optimize → retest. Don't run perf tests in production without feature flags/canary. Use a production-like staging environment.`,
  },
  {
    id: "qa4", domain: "QA & Testing", type: "technical", difficulty: "Easy",
    question: "How do you approach API testing? Walk through testing an REST API from contract to performance. What tools and techniques do you use?",
    hint: "Cover contract testing (OpenAPI), functional testing (status codes, schema, edge cases), auth testing, and integration with CI/CD via Newman/k6.",
    keyPoints: ["Contract first (OpenAPI/Swagger)", "Postman collections / REST-assured", "Test boundary cases + error scenarios", "Auth (Bearer, API keys, OAuth)", "Newman in CI/CD pipeline"],
    modelAnswer: `**API Testing Layers**:

**1. Contract Testing** (earliest feedback):
- Use OpenAPI spec to validate request/response schemas automatically.
- Tools: Dredd (validates API against spec), Pact (consumer-driven contract testing between services).
- Catches API breaking changes before integration tests.

**2. Functional Testing**:
- **Happy path**: correct inputs → correct response (status code, schema, data).
- **Boundary conditions**: empty arrays, null fields, max string length, integer overflow.
- **Error scenarios**: 400 (bad input), 401 (unauthorised), 403 (forbidden), 404 (not found), 422 (validation), 500 (server error).
- **Idempotency**: PUT/DELETE should be idempotent. Test calling twice, expect same result.

**Postman / Newman**:
\`\`\`javascript
// Postman test script
pm.test("Status 200", () => pm.response.to.have.status(200));
pm.test("Schema valid", () => {
  const schema = { type: "object", required: ["id", "name"] };
  pm.response.to.have.jsonSchema(schema);
});
pm.test("Response time < 500ms", () => pm.expect(pm.response.responseTime).to.be.below(500));
\`\`\`
\`\`\`bash
# Run in CI/CD
newman run collection.json -e env-staging.json --reporters cli,junit --reporter-junit-export results.xml
\`\`\`

**REST-Assured** (Java):
\`\`\`java
given().header("Authorization", "Bearer " + token)
  .when().get("/api/users/1")
  .then().statusCode(200)
         .body("name", equalTo("John"))
         .time(lessThan(500L));
\`\`\`

**Auth Testing**: Test with no token (expect 401), expired token (401), wrong scope (403), valid token (200).

**CI/CD Integration**: Newman post-deploy smoke test, REST-Assured in integration test stage, k6 in performance stage. Block deployment on failures.`,
  },
  {
    id: "qa5", domain: "QA & Testing", type: "technical", difficulty: "Medium",
    question: "What is BDD (Behaviour-Driven Development) with Cucumber/Gherkin? When should you use it and when does it become an anti-pattern?",
    hint: "Cover the three amigos collaboration model, Gherkin syntax, the glue code layer, and the maintenance cost vs value trade-off.",
    keyPoints: ["Given/When/Then Gherkin syntax", "Three amigos (BA/Dev/QA)", "Step definitions", "Living documentation", "When BDD adds overhead vs value"],
    modelAnswer: `**BDD Purpose**: Align business, development, and QA around shared acceptance criteria written in plain language (Gherkin). Scenarios become executable tests and living documentation.

**Gherkin Syntax**:
\`\`\`gherkin
Feature: User authentication

  Scenario: Successful login with valid credentials
    Given the user is on the login page
    And the user has an account with email "user@example.com"
    When the user enters password "SecurePass123" and clicks Login
    Then the user should be redirected to the dashboard
    And the session token should be set

  Scenario Outline: Failed login
    Given the user enters "<email>" and "<password>"
    When the user clicks Login
    Then they should see error "<message>"
    Examples:
      | email          | password | message           |
      | wrong@test.com | pass123  | Invalid credentials |
      | user@test.com  | wrongpw  | Invalid credentials |
\`\`\`

**Three Amigos**: BA writes acceptance criteria → Dev + QA refine into Gherkin scenarios together before development starts. Ensures shared understanding.

**Step Definitions** (glue code in Java/JS/Python):
\`\`\`java
@When("the user enters password {string} and clicks Login")
public void userLogsIn(String password) {
    loginPage.enterPassword(password).clickLogin();
}
\`\`\`

**BDD works well when**:
- Non-technical stakeholders actively read/contribute scenarios.
- Domain is complex with many business rules.
- Team is large and alignment is difficult.

**BDD anti-patterns** (becomes overhead):
- Devs writing Gherkin alone without BA involvement — just verbose unit tests.
- Technical implementation details in scenarios ("When I click button with id='login-btn'").
- Large step definition libraries that are hard to reuse.
- Every test as BDD — unit tests don't need Gherkin.

**Rule**: Use BDD for acceptance/integration tests of business flows. Keep unit tests in plain code.`,
  },
  {
    id: "qa6", domain: "QA & Testing", type: "technical", difficulty: "Medium",
    question: "How do you manage test data across environments (dev/staging/production)? What strategies prevent tests from polluting each other?",
    hint: "Cover test data factories, database seeding, data isolation strategies, and the challenge of referential integrity in integration tests.",
    keyPoints: ["Test data factories / builders", "Database seeding vs fixtures", "Test isolation (transactions rollback)", "TestContainers for integration tests", "Data masking for prod copies"],
    modelAnswer: `**Test Data Strategies**:

**1. Test Data Factories / Builders**:
- Generate data programmatically per test with realistic values.
- Libraries: FactoryBot (Ruby), Factory Boy (Python), Faker.js (JS).
\`\`\`python
# FactoryBoy example
class UserFactory(factory.Factory):
    class Meta: model = User
    name = factory.Faker('name')
    email = factory.Sequence(lambda n: f"user{n}@test.com")
    role = "standard"
\`\`\`
- Each test creates its own data, owns its cleanup.

**2. Database Seeding / Fixtures**:
- Baseline dataset loaded before test suite (reference data: countries, product categories).
- **Risk**: shared mutable state → tests interfere. Mitigate with read-only fixtures + per-test data.

**3. Test Isolation Strategies**:
- **Transaction Rollback**: wrap each test in a DB transaction, rollback after. Fast, no cleanup code. Works for single-DB tests.
- **Separate Schema per test**: create/drop schema per test. Slower but fully isolated.
- **TestContainers**: spin up a real database Docker container per test run. Fully isolated from other environments. Supports PostgreSQL, MySQL, MongoDB, Redis.

**4. Environment-Specific Strategies**:
- **Dev**: use Docker Compose with seeded databases. Developers can reset anytime.
- **Staging**: deploy-time seeding scripts. Anonymised copy of prod data (GDPR compliance).
- **Production**: never write test data to prod. Use feature flags to test new features with real users safely.

**5. Data Masking** (for prod copies in staging):
- Mask PII: names, emails, phone numbers replaced with generated values.
- Preserve referential integrity and data distribution.
- Tools: Faker, custom masking scripts, AWS DMS with transformation rules.

**Key principle**: Each test should be independent, repeatable, and not leave state that affects other tests.`,
  },
  {
    id: "qa7", domain: "QA & Testing", type: "technical", difficulty: "Medium",
    question: "What causes flaky tests and how do you systematically diagnose and fix them?",
    hint: "Cover the common root causes (async timing, shared state, test order dependency, environment differences) and systematic remediation strategies.",
    keyPoints: ["Async timing issues", "Shared mutable state", "Test order dependency", "Network/infra flakiness", "Quarantine + track + fix workflow"],
    modelAnswer: `**Flaky tests**: Tests that pass and fail non-deterministically without code changes. The #1 enemy of CI/CD — teams start ignoring failures, masking real bugs.

**Root Causes**:

**1. Async Timing** (most common in UI tests):
- \`sleep(2000)\` hard-coded waits → fail on slow CI, pass on fast dev machine.
- **Fix**: Use explicit waits that poll for conditions: Playwright auto-wait, Selenium \`WebDriverWait\`, retry assertions.

**2. Shared Mutable State**:
- Test A modifies global state (DB record, env variable) → Test B fails because it assumes initial state.
- **Fix**: Proper setup/teardown, test data factories per test, database transactions rolled back after each test.

**3. Test Order Dependency**:
- Test B only passes if Test A ran first.
- **Fix**: Each test must set up its own prerequisites (Arrange step). Run tests in random order periodically (\`jest --randomize\`).

**4. External Service Flakiness**:
- Tests hit real external APIs → rate limits, network timeouts, downtime.
- **Fix**: Mock/stub external services (WireMock, MSW) in integration tests. Only call real services in dedicated contract tests.

**5. Time-based Logic**:
- Test assumes current date/time. Fails on midnight, end-of-month, or timezone changes.
- **Fix**: Inject clock dependency, control time in tests (\`jest.useFakeTimers()\`, Python \`freezegun\`).

**Remediation Workflow**:
1. **Quarantine**: Tag flaky tests. Remove from required CI gates to stop blocking.
2. **Track**: Log flakiness rate per test. Prioritise by frequency.
3. **Reproduce locally**: Run test 10-50 times in a loop: \`for i in {1..50}; do pytest test_foo.py; done\`
4. **Fix root cause** (see above). Never just add retry logic — that masks the problem.
5. **Dequarantine**: Re-add to CI gates once stable across 100+ runs.`,
  },
  {
    id: "qa8", domain: "QA & Testing", type: "technical", difficulty: "Medium",
    question: "What is shift-left testing? How do you integrate quality gates into a CI/CD pipeline?",
    hint: "Cover the shift-left philosophy, quality gates at each stage (commit, build, staging, prod), and how fast feedback loops reduce bug fix cost.",
    keyPoints: ["Shift-left: test earlier", "Quality gates per CI stage", "Fast unit tests at commit", "SAST in build stage", "Performance gates in staging"],
    modelAnswer: `**Shift-Left**: Move testing activities earlier in the development lifecycle. The earlier a bug is found, the cheaper it is to fix (10× cheaper in dev vs QA, 100× cheaper vs production).

**Traditional (Shift-Right)**: Code → Long dev cycle → QA phase → Find bugs late → expensive fix.
**Shift-Left**: TDD / unit tests → PR review → CI quality gates → catch bugs within minutes.

**CI/CD Pipeline Quality Gates**:

\`\`\`
Commit → Pre-commit hooks (lint, format, secret scan)
    ↓
PR Created → Code review + unit test run (<5 min)
    ↓
Build Stage → Unit tests + SAST (SonarQube, Snyk)
              → Code coverage gate (fail if < 80%)
              → Dependency vulnerability scan
    ↓
Integration Stage → Integration tests with TestContainers
                  → Contract tests (Pact)
                  → API functional tests (Newman)
    ↓
Staging Deploy → Smoke tests (happy path)
               → Performance baseline (k6 — fail if p95 > threshold)
               → DAST scan (OWASP ZAP)
    ↓
Production → Canary health checks
           → Synthetic monitoring (real-user-like probes every minute)
           → Automatic rollback on error rate spike
\`\`\`

**Key Practices**:
- **Fast feedback at commit**: Pre-commit hooks (Husky + lint-staged) catch style issues before pushing.
- **Test categorisation**: Mark tests as fast (unit, <1s) vs slow (integration, >10s). Run fast tests always, slow tests on main branch or scheduled.
- **Parallel test execution**: JUnit 5 parallel mode, Jest workers — cut integration suite from 20 min to 5 min.
- **Flaky test quarantine**: Remove from required gates to maintain green pipeline discipline.
- **Definition of Done**: Story only "done" when unit tests, integration tests, and security scan pass.`,
  },
  {
    id: "qa9", domain: "QA & Testing", type: "technical", difficulty: "Medium",
    question: "What is the OWASP Top 10? How do you test for the most common vulnerabilities like SQL Injection, XSS, and broken authentication as a QA engineer?",
    hint: "Cover SAST vs DAST, automated scanning tools (ZAP, Burp Suite), and how to integrate security testing into the CI/CD pipeline.",
    keyPoints: ["OWASP Top 10 categories", "SAST vs DAST", "SQL injection testing", "XSS testing", "OWASP ZAP in CI/CD"],
    modelAnswer: `**OWASP Top 10** (2021):
1. Broken Access Control (IDOR, privilege escalation)
2. Cryptographic Failures (weak encryption, sensitive data in logs)
3. **Injection** (SQL, NoSQL, OS command, LDAP)
4. Insecure Design (security not designed in)
5. Security Misconfiguration (default credentials, verbose errors)
6. Vulnerable & Outdated Components (Snyk, Dependabot)
7. Identification and Authentication Failures (broken auth, weak passwords)
8. Software and Data Integrity Failures (CI/CD pipeline attacks)
9. **Security Logging & Monitoring Failures**
10. Server-Side Request Forgery (SSRF)

**SAST (Static Analysis Security Testing)**:
- Analyse source code without executing.
- Tools: SonarQube, Semgrep, Checkmarx, Snyk Code.
- Run in build stage. Catches SQL injection, hardcoded secrets, insecure random, XXE.

**DAST (Dynamic Analysis Security Testing)**:
- Test running application from outside (black-box).
- Tools: **OWASP ZAP** (open source), Burp Suite, Nikto.
- ZAP in CI/CD: \`zap-baseline.py\` scans for common vulnerabilities automatically.

**SQL Injection Testing**:
- Try payloads: \`' OR '1'='1\`, \`'; DROP TABLE users;--\`
- Use sqlmap for automated detection.
- **Fix**: Parameterised queries always. Never concatenate user input into SQL.

**XSS Testing**:
- Try payloads: \`<script>alert(1)</script>\`, \`javascript:alert(1)\` in URL params, form fields.
- Check if input is reflected in HTML without encoding.
- **Fix**: HTML encode all output, Content-Security-Policy header.

**Broken Authentication Testing**:
- Test: weak passwords, no lockout after N failed attempts, session tokens in URLs, JWT without expiry.
- Check: HTTPS only for auth endpoints, httpOnly cookies, secure flag.

**CI/CD Integration**: SAST in build (fast, <2 min). DAST against staging after deploy (10-15 min). Block deployment if high/critical findings.`,
  },
  {
    id: "qa10", domain: "QA & Testing", type: "technical", difficulty: "Easy",
    question: "What do test coverage metrics mean? Is 100% code coverage a good goal? How do you measure test quality beyond coverage?",
    hint: "Distinguish line/branch/mutation coverage. Explain why 100% coverage doesn't mean bug-free code, and introduce mutation testing as a quality measure.",
    keyPoints: ["Line vs branch vs path coverage", "Coverage doesn't equal quality", "Mutation testing (Pitest/Stryker)", "Testing behaviour not implementation", "Risk-based coverage targets"],
    modelAnswer: `**Coverage Types**:
- **Line Coverage**: % of lines executed by tests. Easiest to measure, easiest to game.
- **Branch Coverage**: % of decision branches (if/else, switch) taken. More meaningful — tests both true/false paths.
- **Path Coverage**: % of all possible execution paths. Exponential combinations — impractical for large functions.
- **Mutation Coverage**: % of injected code mutations caught by tests. Best measure of test quality.

**Why 100% Line Coverage is NOT the goal**:
\`\`\`python
def divide(a, b):
    return a / b

def test_divide():
    assert divide(10, 2) == 5  # 100% line coverage!
\`\`\`
This achieves 100% coverage but doesn't test division by zero (ZeroDivisionError). Coverage tells you which code was executed, not whether the behaviour is correct.

**Coverage ≠ Quality**: You can have 100% coverage with assertions that never fail (\`assert True\`), or tests that execute code but verify nothing meaningful.

**Mutation Testing** (the real quality measure):
- Automatically inject small bugs (mutations): flip \`>\` to \`>=\`, change \`+\` to \`-\`, negate conditions.
- Run test suite against each mutated version. A mutation "survived" (tests still pass) = test gap.
- Tools: **Pitest** (Java), **Stryker** (JavaScript/TypeScript/C#).
- Mutation score = killed mutations / total mutations. Aim for >80%.

**Better Metrics**:
- Branch coverage >80% for critical paths.
- Mutation score >75%.
- Defect escape rate (bugs found in prod that tests should have caught).
- Test execution time trends (slowdown = quality debt).

**Risk-based targeting**: 90%+ coverage for payment, auth, data integrity logic. 60-70% acceptable for UI rendering, logging. Don't set a single % target for the whole codebase.`,
  },
];

// ─── Java & OOP ───────────────────────────────────────────────────────────────
// Sourced from real company interview questions (Accenture, TCS, Infosys, CTS,
// HCL, Capgemini, IBM, Wipro, Cognizant and 60+ others in question bank)
export const JAVA_OOP_QUESTIONS: QuestionBankItem[] = [
  {
    id: "java1", domain: "Java & OOP", type: "technical", difficulty: "Medium",
    question: "What is the difference between an Interface and an Abstract Class in Java? When would you use each?",
    hint: "This is the most commonly asked Java question across all companies. Focus on abstract methods, multiple inheritance, default methods (Java 8), and real design decisions.",
    keyPoints: ["Abstract class: partial implementation, state (fields)", "Interface: contract, multiple inheritance", "Java 8 default/static methods blur the line", "Abstract class = IS-A, Interface = CAN-DO"],
    modelAnswer: `**Abstract Class**:
- Can have abstract methods (no body) AND concrete methods (with body).
- Can have instance variables (state), constructors, access modifiers.
- A class can extend only ONE abstract class (single inheritance).
- Use when: classes share common state and behaviour (IS-A relationship). Example: \`Animal\` abstract class with concrete \`eat()\` and abstract \`makeSound()\`.

**Interface**:
- Pre-Java 8: only abstract methods and constants.
- Java 8+: can have \`default\` methods (with body) and \`static\` methods.
- Java 9+: can have \`private\` methods.
- A class can implement MULTIPLE interfaces — solves the diamond problem.
- No instance variables (only public static final constants).
- Use when: defining a capability/contract unrelated to class hierarchy (CAN-DO). Example: \`Runnable\`, \`Comparable\`, \`Serializable\`.

**Key Differences**:
| Feature | Abstract Class | Interface |
|---|---|---|
| Multiple inheritance | No | Yes |
| State (instance vars) | Yes | No |
| Constructor | Yes | No |
| Access modifiers | All | public (default) |

**Design Rule**: Prefer interfaces for type definitions. Use abstract classes only when you need to share code (state + behaviour) among closely related classes. Often use both — abstract class implements interface, providing partial default behaviour.

**Real example**: \`List\` is an interface. \`AbstractList\` is an abstract class implementing \`List\` with common logic. \`ArrayList\` extends \`AbstractList\`.`,
  },
  {
    id: "java2", domain: "Java & OOP", type: "technical", difficulty: "Easy",
    question: "Explain the four pillars of OOP (Encapsulation, Abstraction, Inheritance, Polymorphism) with real-world examples.",
    hint: "Give a concrete real-world analogy for each. Interviewers want to know you can apply these concepts, not just define them.",
    keyPoints: ["Encapsulation: data hiding + getters/setters", "Abstraction: hide complexity, show interface", "Inheritance: IS-A relationship, code reuse", "Polymorphism: same method, different behaviour (overloading vs overriding)"],
    modelAnswer: `**1. Encapsulation** (Data hiding):
- Bundle data (fields) and behaviour (methods) together. Hide internal state — expose only through methods.
- Example: A \`BankAccount\` class with \`private double balance\`. Balance only changed via \`deposit()\` and \`withdraw()\` with validation — no direct access.
- Achieved via \`private\` fields + \`public\` getters/setters. Lombok \`@Data\` generates these.

**2. Abstraction** (Hide complexity):
- Show only what's necessary. Hide implementation details.
- Example: You drive a car using a steering wheel and pedals — you don't need to know how the engine works. Similarly, \`List.add()\` hides whether it's an array or linked-list behind the scenes.
- Achieved via abstract classes and interfaces.

**3. Inheritance** (IS-A relationship, code reuse):
- Child class inherits fields and methods from parent. Promotes code reuse.
- Example: \`Dog\` and \`Cat\` both extend \`Animal\`. They share \`eat()\` and \`breathe()\` from \`Animal\`, override \`makeSound()\`.
- \`extends\` keyword. Java supports single class inheritance to avoid diamond problem.

**4. Polymorphism** (Many forms):
- Same method name, different behaviour.
- **Compile-time (Overloading)**: same method name, different parameters. Resolved at compile time.
  \`add(int a, int b)\` vs \`add(double a, double b)\`
- **Runtime (Overriding)**: child class redefines parent method. Resolved at runtime (dynamic dispatch).
  \`Animal a = new Dog(); a.makeSound()\` → calls \`Dog.makeSound()\` not \`Animal.makeSound()\`.

**Interview tip**: Give practical examples from your own project — "In our webMethods project, we had an abstract \`IntegrationService\` class with concrete \`execute()\` but abstract \`validate()\` — each integration type overrode \`validate()\` differently."`,
  },
  {
    id: "java3", domain: "Java & OOP", type: "technical", difficulty: "Easy",
    question: "What is the difference between method overloading and method overriding? Give examples.",
    hint: "Overloading = compile-time polymorphism (same class, different params). Overriding = runtime polymorphism (parent-child, same signature).",
    keyPoints: ["Overloading: same class, different params, compile-time", "Overriding: parent-child, same signature, runtime", "@Override annotation", "Return type covariance in overriding", "Cannot override static/final/private methods"],
    modelAnswer: `**Method Overloading** (Compile-time / Static polymorphism):
- Same method name, different parameter list (type, count, or order) in the SAME class.
- Return type alone cannot distinguish overloaded methods.
- Resolved at compile time (static binding).

\`\`\`java
class Calculator {
    int add(int a, int b) { return a + b; }
    double add(double a, double b) { return a + b; }
    int add(int a, int b, int c) { return a + b + c; }
}
\`\`\`

**Method Overriding** (Runtime / Dynamic polymorphism):
- Child class provides a specific implementation for a method already defined in the parent class.
- Same method name, same parameter list, same or covariant return type.
- Resolved at runtime (dynamic binding / virtual dispatch).
- Use \`@Override\` annotation — helps compiler catch errors.

\`\`\`java
class Animal {
    void makeSound() { System.out.println("Some sound"); }
}
class Dog extends Animal {
    @Override
    void makeSound() { System.out.println("Woof!"); }
}
Animal a = new Dog();
a.makeSound(); // prints "Woof!" — runtime polymorphism
\`\`\`

**Rules for overriding**:
- Cannot override \`static\`, \`final\`, or \`private\` methods.
- Access modifier cannot be more restrictive (can widen: \`protected\` → \`public\`).
- Can throw fewer or narrower checked exceptions.

**Key difference**: Overloading = "what to call" decided at compile time. Overriding = "which version to call" decided at runtime based on actual object type.`,
  },
  {
    id: "java4", domain: "Java & OOP", type: "technical", difficulty: "Medium",
    question: "Explain String vs StringBuilder vs StringBuffer in Java. Why is String immutable and what are the performance implications?",
    hint: "String immutability, String pool, + operator performance problem, StringBuilder for single-thread, StringBuffer for multi-thread.",
    keyPoints: ["String: immutable, pool, safe to share", "StringBuilder: mutable, fast, not thread-safe", "StringBuffer: mutable, thread-safe, slower", "String concatenation in loop = O(n²)"],
    modelAnswer: `**String (Immutable)**:
- Once created, value cannot be changed. Every \`+\` or concat creates a NEW String object.
- Stored in the **String Pool** (heap memory). Same string literals share one object: \`"hello" == "hello"\` → true.
- **Thread-safe** (immutable by nature). Safe to use as HashMap keys.
- Problem: \`String s = ""; for(i=0..n) s += i;\` creates n new String objects → O(n²) time and excessive GC pressure.

**StringBuilder (Mutable, Not Thread-Safe)**:
- Mutable character array. Append/insert/delete modify the SAME object.
- \`StringBuilder sb = new StringBuilder(); for(i=0..n) sb.append(i);\` → O(n) total.
- No synchronisation → faster than StringBuffer.
- **Use for**: string building in single-threaded contexts (99% of cases).

**StringBuffer (Mutable, Thread-Safe)**:
- Same as StringBuilder but all methods are \`synchronized\`.
- Slower due to locking. Use only when a mutable string is shared across multiple threads.
- In practice: rarely needed — usually use immutable design or thread-local StringBuilder.

**Performance comparison**:
\`\`\`java
// BAD: O(n²) — creates n intermediate String objects
String s = "";
for (int i = 0; i < 10000; i++) s += i;

// GOOD: O(n) — single StringBuilder
StringBuilder sb = new StringBuilder();
for (int i = 0; i < 10000; i++) sb.append(i);
String result = sb.toString();
\`\`\`

**Why immutable?** Security (HashKey safety, network param strings), caching (String pool), thread safety without sync, hashCode caching for HashMap performance.`,
  },
  {
    id: "java5", domain: "Java & OOP", type: "technical", difficulty: "Medium",
    question: "Explain Java Exception Handling. What is the difference between checked and unchecked exceptions? What is the exception hierarchy?",
    hint: "Hierarchy: Throwable → Error / Exception → RuntimeException. Checked = must handle. Unchecked = RuntimeException subclasses.",
    keyPoints: ["Throwable → Error vs Exception", "Checked: must catch or declare (IOException, SQLException)", "Unchecked: RuntimeException (NPE, ArrayIndexOutOfBounds)", "finally always runs", "Custom exceptions extend Exception or RuntimeException"],
    modelAnswer: `**Exception Hierarchy**:
\`\`\`
Throwable
├── Error (JVM errors, don't catch: OutOfMemoryError, StackOverflowError)
└── Exception
    ├── Checked Exceptions (must handle: IOException, SQLException, ClassNotFoundException)
    └── RuntimeException (Unchecked: NullPointerException, ArrayIndexOutOfBoundsException,
        IllegalArgumentException, ClassCastException, NumberFormatException)
\`\`\`

**Checked Exceptions**: Compiler enforces handling. Must either \`catch\` them or declare \`throws\` in method signature. Represent recoverable conditions: file not found, network timeout, SQL error.

**Unchecked Exceptions (RuntimeException)**: Compiler doesn't require handling. Represent programming errors: null dereference, array out of bounds, bad cast. Should be prevented by code correctness, not caught (usually).

**Exception Handling Mechanics**:
\`\`\`java
try {
    riskyOperation();
} catch (IOException e) {
    logger.error("IO failed", e);
    throw new ServiceException("Could not read file", e);  // wrap and rethrow
} catch (SQLException e) {
    // handle DB error
} finally {
    connection.close();  // always runs, even if exception thrown
}
\`\`\`

**Best Practices**:
- Don't catch \`Exception\` or \`Throwable\` broadly — masks bugs.
- Always log the original exception (don't swallow it).
- Use custom exceptions extending \`RuntimeException\` for business errors — avoids forcing callers to catch.
- \`try-with-resources\` auto-closes \`AutoCloseable\` resources (files, streams, DB connections).
- \`finally\` runs before method returns — use for cleanup.

**Multi-catch** (Java 7+): \`catch (IOException | SQLException e) {}\``,
  },
  {
    id: "java6", domain: "Java & OOP", type: "technical", difficulty: "Easy",
    question: "What is the difference between final, finally, and finalize in Java?",
    hint: "Three completely different things. final = keyword for immutability/sealing. finally = exception handling cleanup block. finalize = deprecated GC method.",
    keyPoints: ["final: keyword — immutable var, no override, no extend", "finally: try-catch block — always executes", "finalize: Object method — called by GC (deprecated Java 9+)"],
    modelAnswer: `**final** (keyword — 3 uses):
1. **final variable**: value cannot be reassigned after initialisation. \`final int MAX = 100;\`
2. **final method**: cannot be overridden by subclasses. \`public final void authenticate() {}\`
3. **final class**: cannot be extended/subclassed. \`public final class String {}\` — String is final for security and immutability.

**finally** (exception handling block):
- Block that always executes after try/catch, regardless of whether an exception was thrown or caught.
- Used for cleanup: closing files, releasing DB connections, releasing locks.
- Exception: \`System.exit()\` or JVM crash prevents finally from running.

\`\`\`java
Connection conn = null;
try {
    conn = getConnection();
    // ... work
} catch (SQLException e) {
    log.error("DB error", e);
} finally {
    if (conn != null) conn.close();  // ALWAYS closes
}
// Better: try-with-resources (Java 7+) — auto-closes
try (Connection conn = getConnection()) {
    // ... work
}  // conn.close() called automatically
\`\`\`

**finalize** (deprecated):
- Instance method in \`Object\` class. Called by the garbage collector before an object is collected.
- **Deprecated in Java 9, removed in Java 18.** Unpredictable — GC timing is not deterministic.
- Never rely on \`finalize()\` for resource cleanup. Use \`try-with-resources\` or explicit \`close()\` instead.
- Replaced by: \`java.lang.ref.Cleaner\` (Java 9+) for post-GC cleanup.

**Memory aid**: final = **keyword**, finally = **exception handling**, finalize = **garbage collection** (legacy).`,
  },
  {
    id: "java7", domain: "Java & OOP", type: "technical", difficulty: "Medium",
    question: "What are the key features introduced in Java 8? Explain Lambda expressions, Streams API, and Optional.",
    hint: "Java 8 was the biggest Java release since Java 5. Focus on Lambda (functional programming), Streams (pipeline processing), Optional (null safety), and default methods.",
    keyPoints: ["Lambda: anonymous function, functional interface", "Streams: pipeline, lazy, parallel", "Optional: null-safe container", "Default methods in interfaces", "Method references (::)"],
    modelAnswer: `**1. Lambda Expressions**: Anonymous functions — concise syntax for implementing functional interfaces (interfaces with one abstract method).

\`\`\`java
// Before Java 8 (anonymous class)
Comparator<String> comp = new Comparator<String>() {
    public int compare(String a, String b) { return a.compareTo(b); }
};
// Java 8 Lambda
Comparator<String> comp = (a, b) -> a.compareTo(b);
// Method reference
Comparator<String> comp = String::compareTo;
\`\`\`

**2. Streams API**: Functional-style operations on collections. Lazy evaluation + parallel processing.
\`\`\`java
List<String> names = employees.stream()
    .filter(e -> e.getSalary() > 50000)    // intermediate (lazy)
    .map(Employee::getName)                  // intermediate (lazy)
    .sorted()                                // intermediate (lazy)
    .collect(Collectors.toList());           // terminal (triggers execution)

// Parallel stream for large datasets
long count = bigList.parallelStream()
    .filter(s -> s.startsWith("A"))
    .count();
\`\`\`

**3. Optional**: Container that may or may not hold a non-null value. Forces explicit null handling.
\`\`\`java
Optional<User> user = userRepo.findById(id);
// BAD: user.get() — throws NoSuchElementException if empty
// GOOD:
String name = user.map(User::getName).orElse("Unknown");
user.ifPresent(u -> sendEmail(u.getEmail()));
\`\`\`

**4. Default Methods in Interfaces**: Interfaces can now have method implementations.
\`\`\`java
interface Collection {
    default Stream<E> stream() { return StreamSupport.stream(spliterator(), false); }
}
\`\`\`
Allows adding new methods to existing interfaces without breaking all implementations.

**Other Java 8 features**: \`java.time\` (LocalDate, ZonedDateTime — replaces Calendar), CompletableFuture (async), new Date/Time API.`,
  },
  {
    id: "java8", domain: "Java & OOP", type: "technical", difficulty: "Medium",
    question: "Explain the Java Collections Framework. What is the difference between List, Set, and Map? When would you use ArrayList vs LinkedList vs HashMap vs TreeMap?",
    hint: "Cover the hierarchy (Iterable → Collection → List/Set/Queue, Map separate), and the O(1) vs O(log n) vs O(n) complexity trade-offs for each implementation.",
    keyPoints: ["List: ordered, duplicates", "Set: no duplicates (HashSet O(1), TreeSet O(log n))", "Map: key-value (HashMap O(1), TreeMap sorted)", "ArrayList vs LinkedList access patterns", "Fail-fast iterators, ConcurrentModificationException"],
    modelAnswer: `**Collections Hierarchy**:
- **List**: Ordered, allows duplicates, index-based access.
  - \`ArrayList\`: Dynamic array. O(1) get/set, O(n) insert-middle. Best for read-heavy workloads.
  - \`LinkedList\`: Doubly-linked list. O(1) add/remove at ends, O(n) random access. Best for frequent insertion/deletion at ends (e.g., queue/deque).

- **Set**: No duplicates. No guaranteed order (except LinkedHashSet/TreeSet).
  - \`HashSet\`: Backed by HashMap. O(1) add/contains/remove. No order.
  - \`LinkedHashSet\`: Maintains insertion order. Slightly slower than HashSet.
  - \`TreeSet\`: Sorted (natural order or Comparator). O(log n) operations. Use for sorted unique elements.

- **Map**: Key-value pairs. Keys unique.
  - \`HashMap\`: O(1) average get/put. No order. Allows one null key. Not thread-safe.
  - \`LinkedHashMap\`: Maintains insertion order. Good for LRU caches (override \`removeEldestEntry\`).
  - \`TreeMap\`: Sorted by key. O(log n). Use for range queries: \`subMap()\`, \`floorKey()\`, \`ceilingKey()\`.
  - \`ConcurrentHashMap\`: Thread-safe HashMap. Segment locking (Java 7) / per-bucket CAS (Java 8).

**Choosing the right collection**:
\`\`\`
Need fast lookup by key?       → HashMap / ConcurrentHashMap
Need sorted key order?         → TreeMap
Need unique elements?          → HashSet
Need sorted unique elements?   → TreeSet
Need order preserved?          → LinkedHashMap / LinkedHashSet
Need fast add/remove at ends?  → ArrayDeque (faster than LinkedList)
Thread-safe list?              → CopyOnWriteArrayList (read-heavy)
                               → Collections.synchronizedList()
\`\`\`

**Initial capacity**: \`new HashMap<>(expectedSize / 0.75 + 1)\` prevents rehashing for known-size maps.`,
  },
  {
    id: "java9", domain: "Java & OOP", type: "technical", difficulty: "Hard",
    question: "How do you create threads in Java? Explain synchronisation, volatile, and how to avoid deadlocks.",
    hint: "Cover Thread/Runnable/Callable, synchronized keyword, volatile, java.util.concurrent, and the four conditions needed for deadlock.",
    keyPoints: ["Thread vs Runnable vs Callable/Future", "synchronized: method and block level", "volatile: visibility, not atomicity", "Deadlock: 4 conditions + prevention", "ExecutorService and thread pools"],
    modelAnswer: `**Creating Threads**:
\`\`\`java
// 1. Extend Thread (poor design — ties to thread lifecycle)
class MyThread extends Thread { public void run() { ... } }
new MyThread().start();

// 2. Implement Runnable (preferred — separates task from thread)
Runnable task = () -> System.out.println("Task running");
new Thread(task).start();

// 3. Callable + Future (returns result, throws exception)
ExecutorService pool = Executors.newFixedThreadPool(10);
Future<Integer> future = pool.submit(() -> computeValue());
Integer result = future.get(); // blocks until done
pool.shutdown();
\`\`\`

**synchronised** (mutual exclusion):
- \`synchronized(this)\` or \`synchronized method\` — only one thread at a time.
- Ensures both **visibility** (flush to main memory) and **atomicity**.
\`\`\`java
private final Object lock = new Object();
synchronized (lock) {
    count++;  // atomic increment
}
\`\`\`

**volatile** (visibility only, not atomicity):
- Guarantees changes to a variable are visible across threads immediately (no CPU cache).
- Does NOT make compound operations atomic (volatile \`count++\` is still 3 ops: read, increment, write).
- Use for: flag variables, single-writer multi-reader scenarios.

**Deadlock — 4 conditions (all must hold)**:
1. Mutual Exclusion: resource held by one thread at a time.
2. Hold and Wait: thread holds a resource while waiting for another.
3. No Preemption: resources can't be forcibly taken.
4. Circular Wait: Thread A → waits for B, Thread B → waits for A.

**Prevention**: Always acquire locks in the same global order. Use \`tryLock(timeout)\` with \`java.util.concurrent.locks.ReentrantLock\` instead of \`synchronized\`.

**Modern concurrency** (prefer over raw threads):
- \`ExecutorService\`, \`CompletableFuture\`, \`ConcurrentHashMap\`, \`AtomicInteger\`, \`CountDownLatch\`, \`Semaphore\`.`,
  },
  {
    id: "java11", domain: "Java & OOP", type: "technical", difficulty: "Easy",
    question: "What is the difference between == and .equals() in Java? When does == give unexpected results with Strings?",
    hint: "== compares references (memory address). .equals() compares content. String pool causes == to work for literals but fail for new String().",
    keyPoints: ["== compares references", ".equals() compares content/value", "String pool: literals share object", "new String('hello') always creates new object", "Always use .equals() for String comparison"],
    modelAnswer: `**== (Reference Equality)**:
- Checks if two variables point to the SAME object in memory (same reference/address).
- For primitives (\`int\`, \`char\`), == compares values — fine.
- For objects, == is almost never what you want.

**\`.equals()\` (Content Equality)**:
- Compares the CONTENT/VALUE of objects.
- \`String.equals()\` compares character by character.
- \`Integer.equals()\` compares numeric value.

**String Pool — the tricky part**:
\`\`\`java
String a = "hello";          // stored in String pool
String b = "hello";          // reuses SAME pool object
System.out.println(a == b);  // TRUE — same reference from pool

String c = new String("hello");  // forces new object on heap
String d = new String("hello");  // another new object
System.out.println(c == d);      // FALSE — different objects
System.out.println(c.equals(d)); // TRUE — same content

// Safe comparison
System.out.println("hello".equals(c));  // TRUE (null-safe style)
\`\`\`

**null-safe comparison**: \`Objects.equals(a, b)\` — handles null without NullPointerException.

\`\`\`java
// Wrong — can throw NPE if userInput is null
if (userInput.equals("admin")) { ... }

// Correct — literal on left, variable on right
if ("admin".equals(userInput)) { ... }

// Best — null-safe
if (Objects.equals(userInput, "admin")) { ... }
\`\`\`

**Rule**: Never use == to compare String, Integer, or any object for value equality. Always use \`.equals()\`.
Integer caching: \`Integer.valueOf(127) == Integer.valueOf(127)\` → true (cached). \`Integer.valueOf(200) == Integer.valueOf(200)\` → false. Another trap!`,
  },
  {
    id: "java12", domain: "Java & OOP", type: "technical", difficulty: "Easy",
    question: "What is the difference between throw and throws in Java? When do you use each?",
    hint: "throw = actually throws an exception object (used inside method body). throws = declares that a method may throw a checked exception (used in method signature).",
    keyPoints: ["throw: action — throws an exception instance", "throws: declaration — warns callers of checked exception", "throw used in method body, throws in method signature", "Can throw multiple with comma separation", "throw terminates method execution"],
    modelAnswer: `**throw** (action — throws an exception):
- Used INSIDE a method body to explicitly throw an exception object.
- Immediately terminates the method and propagates the exception up the call stack.
- Can throw any Throwable (Error, Exception, RuntimeException).

\`\`\`java
public void withdraw(double amount) {
    if (amount < 0) {
        throw new IllegalArgumentException("Amount cannot be negative: " + amount);
    }
    if (amount > balance) {
        throw new InsufficientFundsException("Balance: " + balance + ", Requested: " + amount);
    }
    balance -= amount;
}
\`\`\`

**throws** (declaration — warns callers):
- Used in the METHOD SIGNATURE to declare that the method MAY throw a checked exception.
- Forces callers to either catch the exception or declare it with their own \`throws\`.
- Only needed for CHECKED exceptions (RuntimeExceptions don't need to be declared).

\`\`\`java
// throws in signature — must handle at call site
public void readFile(String path) throws IOException, FileNotFoundException {
    FileReader reader = new FileReader(path);  // throws FileNotFoundException
    // ...
}

// Caller must handle or re-declare
public void processFile() throws IOException {
    readFile("data.txt");  // either catch or re-throw
}

// Or catch it
public void processFile() {
    try {
        readFile("data.txt");
    } catch (IOException e) {
        log.error("File error", e);
    }
}
\`\`\`

**Summary**:
| | throw | throws |
|---|---|---|
| Location | Method body | Method signature |
| Purpose | Actually throw exception | Declare potential exception |
| Syntax | \`throw new Exception()\` | \`void m() throws Exception\` |
| Object needed | Yes (exception instance) | No |`,
  },
  {
    id: "java13", domain: "Java & OOP", type: "technical", difficulty: "Easy",
    question: "What are access modifiers in Java (private, default, protected, public)? Explain visibility with a package diagram.",
    hint: "Four levels of visibility from most to least restrictive: private → default → protected → public. Key distinction: protected allows subclass access across packages.",
    keyPoints: ["private: same class only", "default (package-private): same package", "protected: same package + subclasses", "public: everywhere", "Rule: use most restrictive access possible"],
    modelAnswer: `**Access Modifiers** (from most to least restrictive):

| Modifier | Same Class | Same Package | Subclass (other pkg) | Other Package |
|---|---|---|---|---|
| **private** | ✓ | ✗ | ✗ | ✗ |
| **default** | ✓ | ✓ | ✗ | ✗ |
| **protected** | ✓ | ✓ | ✓ | ✗ |
| **public** | ✓ | ✓ | ✓ | ✓ |

\`\`\`java
package com.company.bank;

public class Account {
    private double balance;         // only Account methods can access
    double interestRate;            // default: any class in com.company.bank
    protected String accountType;  // Account + subclasses + same package
    public String accountNumber;   // everyone

    private void updateBalance() { ... }  // internal only
    protected void applyInterest() { ... }  // subclasses can override
    public double getBalance() { return balance; }  // public API
}
\`\`\`

**Best Practices**:
- Fields: always \`private\` with public getters/setters (encapsulation).
- Internal helper methods: \`private\`.
- Methods for subclass override: \`protected\`.
- Public API: \`public\`.
- Avoid \`default\` (package-private) — unclear intent.

**Classes**: Top-level classes can only be \`public\` or default. Nested classes can use all modifiers.

**Common mistake**: Making fields \`public\` for convenience. This breaks encapsulation — external code can set invalid values directly (e.g., \`account.balance = -1000\`). Always use \`private\` + validated setters.`,
  },
  {
    id: "java14", domain: "Java & OOP", type: "technical", difficulty: "Easy",
    question: "What is a Constructor in Java? What are the different types? Can constructors be overloaded?",
    hint: "Constructor initialises objects. No return type. Types: default, parameterised, copy constructor. this() calls another constructor. super() calls parent constructor.",
    keyPoints: ["No return type, same name as class", "Default (no-arg): provided if no constructor defined", "Parameterised: initialise with values", "this(): constructor chaining", "super(): call parent constructor (must be first statement)"],
    modelAnswer: `**Constructor**: Special method to initialise a new object. Called automatically when \`new\` is used. Same name as class, no return type (not even void).

**Types**:

**1. Default Constructor** (no-arg):
\`\`\`java
public class Person {
    String name;
    // Compiler generates: public Person() {} if no constructor defined
}
Person p = new Person();  // works, fields get default values (null, 0, false)
\`\`\`
**Note**: If you define ANY constructor, compiler no longer generates the default one.

**2. Parameterised Constructor**:
\`\`\`java
public class Person {
    String name;
    int age;
    public Person(String name, int age) {
        this.name = name;  // this = current instance
        this.age = age;
    }
}
Person p = new Person("Alice", 30);
\`\`\`

**3. Constructor Overloading** (yes, allowed):
\`\`\`java
public class Person {
    String name;
    int age;
    Person(String name) { this(name, 0); }  // calls parameterised ↓
    Person(String name, int age) { this.name = name; this.age = age; }
}
\`\`\`

**4. Copy Constructor** (not built-in like C++, but can write manually):
\`\`\`java
Person(Person other) {
    this.name = other.name;
    this.age = other.age;
}
Person copy = new Person(original);
\`\`\`

**this() vs super()**:
- \`this(args)\` — calls another constructor in SAME class. Must be first statement.
- \`super(args)\` — calls parent class constructor. Must be first statement. Compiler inserts \`super()\` automatically if not specified.

**Constructors are NOT inherited** — subclass doesn't inherit parent constructors, but can call them via \`super()\`.`,
  },
  {
    id: "java15", domain: "Java & OOP", type: "technical", difficulty: "Medium",
    question: "Write Java programs: (1) Check if a string is a Palindrome, (2) Reverse a string without using built-in reverse(), (3) Find duplicates in an array.",
    hint: "For palindrome: compare from both ends. For reverse: loop from end to start. For duplicates: use HashSet to detect second occurrence.",
    keyPoints: ["Palindrome: two-pointer or compare with reverse", "String reverse: char array loop / StringBuilder without reverse()", "Duplicates: HashSet contains() before add()", "Without built-in vs with built-in solutions"],
    modelAnswer: `**1. Palindrome Check**:

\`\`\`java
// Without built-in (two-pointer approach)
public static boolean isPalindrome(String s) {
    s = s.toLowerCase().replaceAll("[^a-z0-9]", "");  // clean
    int left = 0, right = s.length() - 1;
    while (left < right) {
        if (s.charAt(left) != s.charAt(right)) return false;
        left++;
        right--;
    }
    return true;
}

// With built-in
public static boolean isPalindromeBuiltIn(String s) {
    String cleaned = s.toLowerCase().replaceAll("[^a-z0-9]", "");
    return cleaned.equals(new StringBuilder(cleaned).reverse().toString());
}
// isPalindrome("MADAM") → true, "racecar" → true, "hello" → false
\`\`\`

**2. Reverse a String Without reverse()**:

\`\`\`java
// Method 1: Character array loop (O(n), O(n) space)
public static String reverseString(String s) {
    char[] chars = s.toCharArray();
    int left = 0, right = chars.length - 1;
    while (left < right) {
        char temp = chars[left];
        chars[left] = chars[right];
        chars[right] = temp;
        left++;
        right--;
    }
    return new String(chars);
}

// Method 2: Concatenation (simple but O(n²) due to String immutability)
public static String reverseString2(String s) {
    String result = "";
    for (int i = s.length() - 1; i >= 0; i--) {
        result += s.charAt(i);  // use StringBuilder for better performance
    }
    return result;
}

// With built-in (1 line)
public static String reverseBuiltIn(String s) {
    return new StringBuilder(s).reverse().toString();
}
// reverseString("Cognizant") → "tnazinoC"
\`\`\`

**3. Find Duplicates in an Array**:

\`\`\`java
// Without built-in (nested loop, O(n²))
public static List<Integer> findDuplicatesManual(int[] arr) {
    List<Integer> duplicates = new ArrayList<>();
    for (int i = 0; i < arr.length; i++) {
        for (int j = i + 1; j < arr.length; j++) {
            if (arr[i] == arr[j] && !duplicates.contains(arr[i])) {
                duplicates.add(arr[i]);
            }
        }
    }
    return duplicates;
}

// With HashSet (O(n) — preferred)
public static List<Integer> findDuplicates(int[] arr) {
    Set<Integer> seen = new HashSet<>();
    List<Integer> duplicates = new ArrayList<>();
    for (int num : arr) {
        if (!seen.add(num)) {  // add() returns false if already present
            if (!duplicates.contains(num)) duplicates.add(num);
        }
    }
    return duplicates;
}
// Input: {1,2,2,3,4,4,5} → Output: [2, 4]
// To get non-duplicates: seen.size() == 1 occurrence only → use frequency map
\`\`\``,
  },
  {
    id: "java16", domain: "Java & OOP", type: "technical", difficulty: "Medium",
    question: "Write Java programs: (1) Check if a number is Prime, (2) Print Fibonacci series, (3) Find the factorial of a number — with and without recursion.",
    hint: "Prime: check divisors up to √n (O(√n) not O(n)). Fibonacci: iterative O(n), recursive O(2^n). Factorial: iterative or recursive. Explain time complexity difference.",
    keyPoints: ["Prime: O(√n) check", "Fibonacci: iterative preferred (recursion = exponential)", "Factorial: recursion risk of StackOverflow for large n", "Memoisation to speed up recursive Fibonacci"],
    modelAnswer: `**1. Prime Number Check**:

\`\`\`java
// Optimised: O(√n) — only check up to square root
public static boolean isPrime(int n) {
    if (n < 2) return false;
    if (n == 2) return true;
    if (n % 2 == 0) return false;  // even numbers (except 2)
    for (int i = 3; i * i <= n; i += 2) {  // only odd divisors up to √n
        if (n % i == 0) return false;
    }
    return true;
}
// isPrime(7) → true, isPrime(12) → false, isPrime(97) → true
// Why √n? If n has a factor > √n, it also has a factor < √n (they come in pairs)
\`\`\`

**2. Fibonacci Series**:

\`\`\`java
// Iterative (O(n) time, O(1) space) — PREFERRED
public static void fibIterative(int n) {
    int a = 0, b = 1;
    System.out.print(a + " " + b);
    for (int i = 2; i < n; i++) {
        int c = a + b;
        System.out.print(" " + c);
        a = b;
        b = c;
    }
}
// Output for n=8: 0 1 1 2 3 5 8 13

// Recursive (O(2^n) — exponential, BAD for large n)
public static int fibRecursive(int n) {
    if (n <= 1) return n;
    return fibRecursive(n - 1) + fibRecursive(n - 2);  // recalculates subproblems!
}

// Memoised recursive (O(n) time, O(n) space)
private static Map<Integer, Integer> memo = new HashMap<>();
public static int fibMemo(int n) {
    if (n <= 1) return n;
    if (memo.containsKey(n)) return memo.get(n);
    int result = fibMemo(n - 1) + fibMemo(n - 2);
    memo.put(n, result);
    return result;
}
\`\`\`

**3. Factorial**:

\`\`\`java
// Iterative (O(n), preferred for large n)
public static long factorialIterative(int n) {
    if (n < 0) throw new IllegalArgumentException("n must be >= 0");
    long result = 1;
    for (int i = 2; i <= n; i++) result *= i;
    return result;
}

// Recursive (O(n) time, O(n) stack space — StackOverflow risk for n > ~10000)
public static long factorialRecursive(int n) {
    if (n == 0 || n == 1) return 1;
    return n * factorialRecursive(n - 1);
}
// factorial(5) → 120, factorial(10) → 3628800

// Java 8 (elegant)
public static long factorialStream(int n) {
    return LongStream.rangeClosed(1, n).reduce(1, Math::multiplyExact);
}
\`\`\`

**Interview insight**: Always explain O complexity. For Fibonacci, mention that naive recursion recomputes subproblems (2^n). Iterative or memoised DP is always better. For factorial, mention risk of overflow — use \`BigInteger\` for n > 20.`,
  },
  {
    id: "java17", domain: "Java & OOP", type: "technical", difficulty: "Medium",
    question: "Write Java programs: (1) Count character occurrences in a string, (2) Check if two strings are Anagrams, (3) Swap two numbers without a third variable.",
    hint: "Character count: use HashMap<Character, Integer> or frequency array[256]. Anagram: same chars same frequency. Swap: XOR or arithmetic. Provide both manual and built-in solutions.",
    keyPoints: ["Char frequency: HashMap or int[256]", "Anagram: sorted strings equal, or same frequency map", "Swap without temp: XOR trick or a=a+b; b=a-b; a=a-b", "Edge cases: null strings, different lengths"],
    modelAnswer: `**1. Count Character Occurrences**:

\`\`\`java
// Without built-in (HashMap)
public static Map<Character, Integer> charCount(String s) {
    Map<Character, Integer> freq = new LinkedHashMap<>();
    for (char c : s.toCharArray()) {
        freq.put(c, freq.getOrDefault(c, 0) + 1);
    }
    return freq;
}
// "Cognizant" → {C=1, o=1, g=1, n=2, i=1, z=1, a=1, t=1}

// Count specific character occurrences
public static int countChar(String s, char target) {
    int count = 0;
    for (char c : s.toCharArray()) if (c == target) count++;
    return count;
}

// With Java 8 streams
long count = s.chars().filter(c -> c == 'n').count();
\`\`\`

**2. Anagram Check**:

\`\`\`java
// Method 1: Sort both strings and compare (O(n log n))
public static boolean isAnagramSort(String s1, String s2) {
    if (s1.length() != s2.length()) return false;
    char[] a = s1.toLowerCase().toCharArray();
    char[] b = s2.toLowerCase().toCharArray();
    Arrays.sort(a);
    Arrays.sort(b);
    return Arrays.equals(a, b);
}

// Method 2: Frequency array (O(n), O(1) space for 256 ASCII chars) — OPTIMAL
public static boolean isAnagram(String s1, String s2) {
    if (s1.length() != s2.length()) return false;
    int[] freq = new int[256];
    for (int i = 0; i < s1.length(); i++) {
        freq[s1.charAt(i)]++;
        freq[s2.charAt(i)]--;
    }
    for (int f : freq) if (f != 0) return false;
    return true;
}
// isAnagram("listen", "silent") → true
// isAnagram("hello", "world") → false
\`\`\`

**3. Swap Without Third Variable**:

\`\`\`java
// Method 1: Arithmetic (works for integers, risk of overflow for large numbers)
int a = 5, b = 10;
a = a + b;  // a = 15
b = a - b;  // b = 5
a = a - b;  // a = 10
// a=10, b=5 — swapped!

// Method 2: XOR (safer, no overflow, works for any integer type)
a = a ^ b;  // a = 5^10
b = a ^ b;  // b = 5^10^10 = 5
a = a ^ b;  // a = 5^10^5 = 10
// a=10, b=5 — swapped!

// Method 3: One-liner (Pythonic but works in Java too via temp conceptually)
a = a + b - (b = a);  // NOT recommended in Java — evaluation order undefined

// For Objects/Strings: MUST use temp variable (XOR only works for int)
String x = "Hello", y = "World";
String temp = x; x = y; y = temp;
\`\`\``,
  },
  {
    id: "java18", domain: "Java & OOP", type: "technical", difficulty: "Medium",
    question: "What is the difference between JDK, JRE, and JVM? Why is Java platform-independent? What is the role of the ClassLoader?",
    hint: "JVM = runtime engine (platform-specific). JRE = JVM + runtime libraries. JDK = JRE + development tools. Platform independence: .class bytecode runs on any JVM. ClassLoader loads classes dynamically.",
    keyPoints: ["JVM: interprets bytecode, platform-specific", "JRE: JVM + standard libraries", "JDK: JRE + javac + tools", "Bytecode = WORA (Write Once Run Anywhere)", "ClassLoader: Bootstrap, Extension, Application"],
    modelAnswer: `**JVM (Java Virtual Machine)**:
- Runtime engine that executes Java bytecode (.class files).
- JVM is platform-SPECIFIC — different for Windows, Linux, macOS.
- Handles memory management (heap, stack), garbage collection, JIT compilation.
- Provides JIT (Just-In-Time) compiler: compiles hot bytecode to native machine code at runtime for performance.

**JRE (Java Runtime Environment)**:
- JVM + Java Standard Library (rt.jar / java.base module): java.lang, java.util, java.io etc.
- What you need to RUN Java programs (not compile).
- End-users install JRE to run Java applications.

**JDK (Java Development Kit)**:
- JRE + development tools: \`javac\` (compiler), \`javap\` (disassembler), \`jdb\` (debugger), \`jconsole\`, \`jstack\`, \`keytool\`.
- Developers install JDK to write and compile Java.

**Platform Independence (WORA — Write Once Run Anywhere)**:
\`\`\`
Java Source (.java)
  → javac compiles → Bytecode (.class) [platform-neutral]
      → Any JVM (Windows/Linux/macOS) interprets/JIT-compiles → Native machine code
\`\`\`
The .class bytecode is the same on all platforms. The JVM is the "translator" — platform-specific but provided for each OS. You ship the .class, it runs everywhere with a JVM.

**ClassLoader** (dynamic class loading):
1. **Bootstrap ClassLoader**: Loads core Java classes (java.lang.*) from rt.jar / java.base.
2. **Extension ClassLoader**: Loads ext/ directory classes.
3. **Application ClassLoader**: Loads your application classes from classpath.

**Delegation model**: Application ClassLoader delegates to Extension, which delegates to Bootstrap first. Prevents malicious replacement of core classes.

\`\`\`java
System.out.println(String.class.getClassLoader());   // null (Bootstrap)
System.out.println(Main.class.getClassLoader());      // AppClassLoader
\`\`\``,
  },
  {
    id: "java19", domain: "Java & OOP", type: "technical", difficulty: "Medium",
    question: "How do you create an Immutable class in Java? Why is String immutable? What are the benefits?",
    hint: "Immutable class: final class, private final fields, no setters, deep copy in constructor and getters for mutable fields. String is immutable for security, caching, and thread safety.",
    keyPoints: ["final class, private final fields", "No setters", "Deep copy mutable objects in constructor", "Return copies of mutable fields from getters", "String immutability: pool, HashKey safety, thread-safe"],
    modelAnswer: `**Rules for an Immutable Class**:
1. Declare class as \`final\` (prevent subclassing that could add mutability).
2. All fields \`private final\` (can't be reassigned after construction).
3. No setter methods.
4. **Deep copy mutable objects** in constructor (don't store reference to passed mutable object).
5. **Return copies** of mutable fields from getters.

\`\`\`java
public final class ImmutableEmployee {
    private final String name;
    private final int id;
    private final List<String> skills;  // mutable field — needs care

    public ImmutableEmployee(String name, int id, List<String> skills) {
        this.name = name;
        this.id = id;
        // Deep copy — don't store reference to external mutable list
        this.skills = new ArrayList<>(skills);
    }

    public String getName() { return name; }
    public int getId() { return id; }
    // Return defensive copy — caller can't modify internal list
    public List<String> getSkills() { return new ArrayList<>(skills); }
}
\`\`\`

**Why String is immutable**:
1. **String Pool**: Multiple variables can share the same String object. If String were mutable, changing one variable would affect all others sharing the pool object.
2. **Security**: String used for class names, network connections, file paths — immutability prevents tampering.
3. **HashMap key safety**: String's hashCode is cached. If it were mutable, the hash could change after insertion, making the key unfindable.
4. **Thread safety**: Immutable objects are naturally thread-safe — no synchronisation needed.

**Benefits of Immutable Objects**:
- Thread-safe without synchronisation.
- Can be safely shared and cached (e.g., Integer.valueOf() cache).
- Simpler to reason about — no hidden state changes.
- Great for value objects in domain-driven design.

**Examples**: String, Integer (and all Number wrappers), BigDecimal, BigInteger, java.time.LocalDate.`,
  },
  {
    id: "java20", domain: "Java & OOP", type: "technical", difficulty: "Easy",
    question: "What is the difference between ArrayList and Array in Java? What are the advantages of ArrayList over a plain array?",
    hint: "Array: fixed size, primitive support, faster. ArrayList: dynamic size, generics, utility methods, objects only.",
    keyPoints: ["Array: fixed size, primitives ok", "ArrayList: dynamic, autoboxing for primitives", "ArrayList methods: add, remove, contains, size", "Array: faster direct access", "2D arrays vs List<List<>>"],
    modelAnswer: `**Array**:
- Fixed size set at creation: \`int[] arr = new int[10];\` — cannot grow/shrink.
- Can hold primitive types (\`int\`, \`double\`, \`char\`) without boxing overhead.
- Direct index access: \`arr[0]\` — O(1), cache-friendly.
- Part of the Java language (not a class).
- Multi-dimensional: \`int[][] matrix = new int[3][4];\`
- No built-in utility methods (sort via \`Arrays.sort()\`).

**ArrayList (java.util)**:
- Dynamic size — grows automatically (doubles capacity when full: 10 → 15 → 22...).
- Can only store Objects — primitives autoboxed: \`ArrayList<Integer>\` (boxing overhead).
- Rich API: \`add()\`, \`remove()\`, \`contains()\`, \`indexOf()\`, \`subList()\`, \`size()\`, \`isEmpty()\`.
- Backed by an array internally — O(1) get/set, O(n) insert-in-middle, amortised O(1) add-at-end.

\`\`\`java
// Array (fixed)
int[] arr = {1, 2, 3};
arr[0] = 10;  // OK
// arr[5] = 5;  // ArrayIndexOutOfBoundsException

// ArrayList (dynamic)
List<Integer> list = new ArrayList<>();
list.add(1); list.add(2); list.add(3);
list.add(4);       // grows automatically
list.remove(0);    // removes first element
System.out.println(list.contains(2));  // true
Collections.sort(list);

// Convert between them
Integer[] arr2 = list.toArray(new Integer[0]);
List<Integer> list2 = new ArrayList<>(Arrays.asList(arr2));
\`\`\`

**When to use which**:
- **Array**: Fixed-size collection, primitive performance (int[], byte[] for byte buffers), multi-dimensional data (matrix).
- **ArrayList**: Size unknown upfront, need add/remove, need utility methods, returning from API.
- For thread-safe dynamic list: \`CopyOnWriteArrayList\` or \`Collections.synchronizedList(new ArrayList<>())\`.`,
  },
  {
    id: "java10", domain: "Java & OOP", type: "technical", difficulty: "Easy",
    question: "Explain the static keyword in Java. What are static variables, static methods, static blocks, and static nested classes?",
    hint: "static = belongs to the class, not an instance. Cover memory, when static is called, why main() is static, and static import.",
    keyPoints: ["Class-level (one copy shared)", "Static method: no access to instance vars", "Static block: class initialisation", "main() is static: JVM calls without instance", "Static nested class vs inner class"],
    modelAnswer: `**Static** means the member belongs to the **class**, not to any particular instance. One copy shared across all instances.

**Static Variable** (Class variable):
\`\`\`java
class Counter {
    static int count = 0;  // shared across ALL Counter instances
    Counter() { count++; }
}
new Counter(); new Counter(); // Counter.count == 2
\`\`\`

**Static Method**:
- Called on the class: \`Math.sqrt()\`, \`Collections.sort()\`.
- Cannot access instance variables or call instance methods (no \`this\`).
- Cannot be overridden (only hidden by subclass — not polymorphic).
- Use for utility/factory methods: \`Integer.parseInt()\`, \`Objects.requireNonNull()\`.

**Static Block** (Class initialiser):
\`\`\`java
class DBConfig {
    static final Properties config;
    static {
        config = new Properties();
        config.load(new FileInputStream("db.properties")); // runs once when class loaded
    }
}
\`\`\`
Runs once when class is first loaded by the JVM. Used for complex static field initialisation.

**Why \`main()\` is static**: JVM calls \`main\` without creating an instance of your class. If it weren't static, JVM would need to know which constructor to use — impossible for a general entry point.

**Static Nested Class vs Inner Class**:
- Static nested: doesn't hold reference to outer class. Can be instantiated independently.
- Inner (non-static): holds implicit reference to outer class instance. Common in Builder/Iterator patterns.

**Static Import**: \`import static java.lang.Math.*;  Math.sqrt(9)\` → just \`sqrt(9)\`.`,
  },
];

// ─── Selenium & Test Automation ───────────────────────────────────────────────
// Sourced from real company interviews: TCS, Infosys, HCL, CTS, Wipro, IBM,
// Capgemini, Accenture, Paypal, Fidelity and 50+ others in question bank
export const SELENIUM_QUESTIONS: QuestionBankItem[] = [
  {
    id: "sel1", domain: "Selenium & Testing", type: "technical", difficulty: "Medium",
    question: "What is the difference between Implicit Wait, Explicit Wait, and Thread.sleep in Selenium? Which should you use and why?",
    hint: "This is one of the top 5 Selenium interview questions. Thread.sleep is the worst option. Explain the polling interval and FluentWait.",
    keyPoints: ["ImplicitWait: global, all elements", "ExplicitWait: specific condition, WebDriverWait", "Thread.sleep: hard wait, brittle, never use", "FluentWait: custom polling + ignore exceptions", "Best practice: ExplicitWait for specific elements"],
    modelAnswer: `**Thread.sleep(milliseconds)**:
- Pauses the thread unconditionally for fixed duration. Wastes time if element loads faster.
- Makes tests slow and brittle (hard-coded timing assumptions). **Never use in production tests.**

**Implicit Wait** (global, set-and-forget):
\`\`\`java
driver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));
\`\`\`
- Polls the DOM for up to 10 seconds for EVERY \`findElement()\` call before throwing \`NoSuchElementException\`.
- Set once for the driver — applies to all element lookups.
- Problem: doesn't wait for element to be clickable/visible, just present in DOM. Can interact with invisible elements → unexpected failures.
- **Can conflict with Explicit Wait** — don't mix them.

**Explicit Wait** (recommended, per-element condition):
\`\`\`java
WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(15));
WebElement btn = wait.until(ExpectedConditions.elementToBeClickable(By.id("submit")));
btn.click();
// Other conditions:
// visibilityOfElementLocated, presenceOfElementLocated,
// textToBePresentInElement, alertIsPresent, invisibilityOf
\`\`\`
- Waits for a SPECIFIC condition. Polls every 500ms (default) until condition met or timeout.
- Use for dynamic content, AJAX-loaded elements, animations.

**FluentWait** (most flexible):
\`\`\`java
Wait<WebDriver> wait = new FluentWait<>(driver)
    .withTimeout(Duration.ofSeconds(30))
    .pollingEvery(Duration.ofSeconds(2))
    .ignoring(NoSuchElementException.class);
wait.until(d -> d.findElement(By.id("result")).isDisplayed());
\`\`\`

**Best practice**: Use Explicit Wait (WebDriverWait) per interaction. Avoid Implicit Wait and Thread.sleep.`,
  },
  {
    id: "sel2", domain: "Selenium & Testing", type: "technical", difficulty: "Easy",
    question: "What is the difference between findElement() and findElements() in Selenium? What exception does each throw?",
    hint: "findElement returns one WebElement or throws NoSuchElementException. findElements returns a List (empty list if none found — never throws).",
    keyPoints: ["findElement: single, throws NoSuchElementException", "findElements: List, empty list if none (never throws)", "StaleElementReferenceException", "Use findElements().size() > 0 for checking existence"],
    modelAnswer: `**findElement(By locator)**:
- Returns a single \`WebElement\`.
- Throws \`NoSuchElementException\` immediately if no element matches.
- Use when you expect exactly one matching element.

\`\`\`java
WebElement btn = driver.findElement(By.id("submit"));
btn.click();  // NoSuchElementException if "submit" not found
\`\`\`

**findElements(By locator)**:
- Returns \`List<WebElement>\` — all matching elements.
- Returns an **empty list** (not null, not exception) if nothing matches.
- Useful for:
  - Counting elements: \`driver.findElements(By.tagName("a")).size()\` → count of all links
  - Checking existence without try-catch: \`if (!driver.findElements(By.id("error")).isEmpty())\`
  - Iterating all matching elements (table rows, list items)

\`\`\`java
List<WebElement> links = driver.findElements(By.tagName("a"));
System.out.println("Total links: " + links.size());

// Check if element exists
boolean isPresent = !driver.findElements(By.id("popup")).isEmpty();

// Iterate all rows
List<WebElement> rows = driver.findElements(By.cssSelector("table tr"));
for (WebElement row : rows) {
    System.out.println(row.getText());
}
\`\`\`

**StaleElementReferenceException**: Element was found, but the DOM was refreshed/modified — the reference is now stale (points to a detached element). Fix: re-find the element after DOM changes.

\`\`\`java
// Handle stale element with re-find
try {
    element.click();
} catch (StaleElementReferenceException e) {
    driver.findElement(locator).click();  // re-locate
}
\`\`\``,
  },
  {
    id: "sel3", domain: "Selenium & Testing", type: "technical", difficulty: "Medium",
    question: "Explain XPath in Selenium. What is the difference between absolute and relative XPath? How do you write a custom XPath when elements have no unique ID?",
    hint: "Absolute XPath is brittle (breaks on UI changes). Relative XPath uses // and attributes. Cover text(), contains(), starts-with(), and axes (parent, following-sibling).",
    keyPoints: ["Absolute: /html/body/... (brittle)", "Relative: //tag[@attr='val']", "contains(), starts-with(), text()", "XPath axes: parent, following-sibling, ancestor", "CSS Selector vs XPath trade-offs"],
    modelAnswer: `**Absolute XPath**: Full path from root HTML element.
\`\`\`
/html/body/div[1]/form/input[2]
\`\`\`
Problem: Any DOM change breaks it. Never use in real automation.

**Relative XPath**: Starts from anywhere in the DOM with \`//\`.
\`\`\`
//input[@id='username']                    // by ID
//button[@type='submit']                   // by type attribute
//a[text()='Login']                        // by exact text
//button[contains(@class,'btn-primary')]   // class contains (partial match)
//input[starts-with(@name,'user')]         // attribute starts with
//label[text()='Email']/following-sibling::input  // sibling
//div[@class='form']//input[@type='text'] // nested
\`\`\`

**When no unique identifier exists** — use structure/context:
\`\`\`
// 3rd input in a form
(//form[@id='login']//input)[3]

// Button with text "Submit" inside a specific div
//div[@class='modal']//button[text()='Submit']

// Parent of a known child
//span[text()='Error']/parent::div

// Find by multiple attributes
//input[@type='text' and @placeholder='Search']

// Dynamic ID (changes every load) — use contains
//input[contains(@id,'user_')]
\`\`\`

**XPath axes** (navigate DOM relationships):
- \`parent::\` — navigate to parent
- \`following-sibling::\` — next sibling elements
- \`preceding-sibling::\` — previous sibling elements
- \`ancestor::\` — any ancestor element
- \`descendant::\` — any descendant

**XPath vs CSS Selector**:
- CSS is faster (native browser API). XPath is more powerful (can traverse parent/preceding).
- CSS: \`#id\`, \`.class\`, \`[attr='val']\`, \`div > p\`. Cannot traverse to parent.
- XPath: can navigate to parent, use text content, more expressive. Slower.
- **Prefer CSS Selector** for performance; use XPath when you need parent navigation or text-based matching.`,
  },
  {
    id: "sel4", domain: "Selenium & Testing", type: "technical", difficulty: "Medium",
    question: "What is the Page Object Model (POM) framework in Selenium? How do you design it and why is it the industry standard?",
    hint: "POM = separate class per page, expose page actions not raw WebDriver calls, use @FindBy annotations with PageFactory. Explain how it reduces duplication and improves maintainability.",
    keyPoints: ["One class per page/component", "@FindBy + PageFactory", "Page actions not raw WebDriver", "Separation of test logic from locators", "Locator change = fix in one place"],
    modelAnswer: `**Page Object Model**: Design pattern where each web page (or reusable component) is represented as a class. The class encapsulates the page's elements and actions, hiding WebDriver details from tests.

**Structure**:
\`\`\`
src/
  pages/
    LoginPage.java        ← Page Object
    DashboardPage.java
    BasePage.java         ← Shared driver + common actions
  tests/
    LoginTest.java        ← Test class uses Page Objects
  utils/
    DriverFactory.java
\`\`\`

**Page Object with PageFactory**:
\`\`\`java
public class LoginPage {
    private WebDriver driver;

    @FindBy(id = "username")
    private WebElement usernameField;

    @FindBy(id = "password")
    private WebElement passwordField;

    @FindBy(css = "button[type='submit']")
    private WebElement loginButton;

    @FindBy(className = "error-message")
    private WebElement errorMessage;

    public LoginPage(WebDriver driver) {
        this.driver = driver;
        PageFactory.initElements(driver, this);  // initialises @FindBy elements
    }

    public DashboardPage login(String user, String pass) {
        usernameField.sendKeys(user);
        passwordField.sendKeys(pass);
        loginButton.click();
        return new DashboardPage(driver);  // return next page
    }

    public String getErrorMessage() {
        return errorMessage.getText();
    }
}
\`\`\`

**Test class (clean, readable)**:
\`\`\`java
@Test
public void validLoginRedirectsToDashboard() {
    LoginPage login = new LoginPage(driver);
    DashboardPage dashboard = login.login("admin@test.com", "Password123");
    Assert.assertTrue(dashboard.isLoaded());
}
\`\`\`

**Benefits**:
- Locator change (UI redesign) → fix in ONE place (page class), not 50 tests.
- Tests are readable business steps, not WebDriver noise.
- Page actions return the next page — fluent navigation.
- Reusable across test scenarios.`,
  },
  {
    id: "sel5", domain: "Selenium & Testing", type: "technical", difficulty: "Medium",
    question: "Explain TestNG annotations. What is the difference between @BeforeTest and @BeforeMethod? How does @DataProvider work vs passing parameters via testng.xml?",
    hint: "Cover the full annotation lifecycle hierarchy, @BeforeTest runs once per <test> tag, @BeforeMethod runs before every @Test method. DataProvider = programmatic, parameters = static config.",
    keyPoints: ["Annotation hierarchy: Suite > Test > Class > Groups > Method", "@DataProvider: returns Object[][], enables parameterisation in code", "@Parameters: static values from testng.xml", "dependsOnMethods for test ordering", "groups for test categorisation"],
    modelAnswer: `**TestNG Annotation Lifecycle** (outer → inner):
\`\`\`
@BeforeSuite → @AfterSuite          (once for entire suite)
  @BeforeTest → @AfterTest          (once per <test> tag in XML)
    @BeforeClass → @AfterClass      (once per test class)
      @BeforeGroups → @AfterGroups  (when entering/leaving a group)
        @BeforeMethod → @AfterMethod  (before/after EACH @Test method)
          @Test                      (actual test)
\`\`\`

**@BeforeTest** — runs ONCE before all test methods in a \`<test>\` tag:
- Good for: browser setup, test database setup.

**@BeforeMethod** — runs before EVERY single \`@Test\` method:
- Good for: navigating to start URL, resetting state, clearing cookies.
- Use this for test isolation (each test starts from a clean state).

**@DataProvider** (programmatic, code-based parameterisation):
\`\`\`java
@DataProvider(name = "loginData")
public Object[][] provideLoginData() {
    return new Object[][] {
        {"admin@test.com", "Pass123", true},
        {"wrong@test.com", "wrongpass", false},
        {"", "", false},
    };
}

@Test(dataProvider = "loginData")
public void testLogin(String email, String pwd, boolean shouldSucceed) {
    // runs 3 times with each dataset
}
\`\`\`

**@Parameters** (from testng.xml — static config values):
\`\`\`xml
<parameter name="browser" value="chrome"/>
\`\`\`
\`\`\`java
@BeforeMethod
@Parameters("browser")
public void setup(String browser) { /* init browser */ }
\`\`\`

**When to use which**:
- \`@DataProvider\`: test data (multiple rows, loaded from Excel/DB), loop-based parameterisation.
- \`@Parameters\`: environment config (browser, URL, credentials) — one value per run.

**@Test(dependsOnMethods)**: \`@Test(dependsOnMethods = "testLogin")\` — run only if \`testLogin\` passed. Use sparingly — creates fragile test chains.`,
  },
  {
    id: "sel6", domain: "Selenium & Testing", type: "technical", difficulty: "Medium",
    question: "Explain the WebDriver architecture. What is WebDriver? What is the difference between ChromeDriver and RemoteWebDriver? How does Selenium Grid work?",
    hint: "WebDriver is an interface. ChromeDriver/FirefoxDriver implement it via W3C WebDriver protocol. RemoteWebDriver communicates with a hub. Selenium Grid distributes tests across machines/browsers.",
    keyPoints: ["WebDriver = interface (W3C spec)", "ChromeDriver: local, direct", "RemoteWebDriver: network JSON Wire → W3C", "Selenium Grid: Hub + Nodes", "Cloud grids: Selenium Grid 4, BrowserStack, Sauce Labs"],
    modelAnswer: `**WebDriver Interface**:
- \`WebDriver\` is a Java interface defined by the W3C WebDriver specification.
- Classes that implement WebDriver: \`ChromeDriver\`, \`FirefoxDriver\`, \`EdgeDriver\`, \`SafariDriver\`, \`RemoteWebDriver\`.

**How Selenium WebDriver works**:
1. Your Java test calls \`driver.findElement()\`, \`driver.click()\` etc.
2. WebDriver translates this to W3C WebDriver protocol (HTTP requests).
3. ChromeDriver (a separate server process) receives the request and uses Chrome DevTools Protocol (CDP) to control the actual Chrome browser.
4. Chrome executes the command and returns the response.

**ChromeDriver (local execution)**:
\`\`\`java
WebDriver driver = new ChromeDriver();  // starts ChromeDriver process locally
// Selenium 4: automatic driver management
WebDriverManager.chromedriver().setup();  // downloads matching ChromeDriver
\`\`\`

**RemoteWebDriver (network/grid execution)**:
\`\`\`java
DesiredCapabilities caps = new DesiredCapabilities();
caps.setBrowserName("chrome");
WebDriver driver = new RemoteWebDriver(
    new URL("http://hub:4444/wd/hub"), caps);
\`\`\`
Your test sends HTTP requests to a Selenium Hub, which routes to a Node running the actual browser.

**Selenium Grid 4**:
- **Hub**: central server receives test requests, routes to appropriate Node.
- **Node**: machine with browsers installed, registers capabilities with Hub.
- **Distributed mode**: Hub + Router + Distributor + Session Map (microservices).
- Enables parallel execution across multiple OS/browser combinations.

**Cloud Grids** (BrowserStack, Sauce Labs, LambdaTest):
- Same RemoteWebDriver API, hosted infrastructure. No maintenance.
- Provides real devices, browser versions, OS combinations, video recording.`,
  },
  {
    id: "sel7", domain: "Selenium & Testing", type: "technical", difficulty: "Medium",
    question: "How do you handle dynamic web elements in Selenium? What causes StaleElementReferenceException and how do you fix it?",
    hint: "Dynamic elements change ID/XPath on each page load or after AJAX. StaleElement = DOM was refreshed. Fix by re-finding, using Explicit Wait, or catching and retrying.",
    keyPoints: ["Dynamic locators: contains(), starts-with()", "StaleElement: DOM refreshed, old reference invalid", "Re-locate after AJAX/navigation", "Fluent Wait with retry", "JavaScript executor as fallback"],
    modelAnswer: `**Dynamic Web Elements**: Elements whose attributes (ID, class, XPath) change on every page load or after AJAX calls.

**Problem**: Many apps generate IDs dynamically: \`id="input_1234567"\` (timestamp). Locating by exact ID breaks every run.

**Solutions for dynamic locators**:
\`\`\`java
// Avoid: exact dynamic ID
driver.findElement(By.id("input_1234567"));  // breaks

// Use: relative locator with stable attribute
driver.findElement(By.xpath("//input[contains(@id,'input_')]"));
driver.findElement(By.xpath("//input[@placeholder='Enter name']"));
driver.findElement(By.cssSelector("input[name='username']"));

// Use label context (stable text near element)
driver.findElement(By.xpath("//label[text()='Email']/following-sibling::input"));
\`\`\`

**StaleElementReferenceException**: You found an element, then the DOM was refreshed (navigation, AJAX reload, React re-render) — the old WebElement reference points to a detached DOM node.

**Fixes**:
\`\`\`java
// Fix 1: Re-find after action that triggers DOM change
driver.findElement(By.id("refresh")).click();
// DOM may refresh here...
WebElement freshElement = driver.findElement(By.id("result"));  // re-find

// Fix 2: Wrap in try-catch with retry
public void clickWithRetry(By locator) {
    int attempts = 0;
    while (attempts < 3) {
        try {
            driver.findElement(locator).click();
            return;
        } catch (StaleElementReferenceException e) {
            attempts++;
        }
    }
}

// Fix 3: Use Explicit Wait — re-finds internally
WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(10));
wait.until(ExpectedConditions.elementToBeClickable(By.id("btn"))).click();
// WebDriverWait re-evaluates ExpectedConditions on each poll — handles stale

// Fix 4: JavaScript Executor (bypass WebDriver interaction)
JavascriptExecutor js = (JavascriptExecutor) driver;
js.executeScript("arguments[0].click();", element);
\`\`\`

**Handling dynamic dropdowns** (auto-suggest, type-ahead):
\`\`\`java
driver.findElement(By.id("city")).sendKeys("Banga");
wait.until(ExpectedConditions.visibilityOfElementLocated(By.className("suggestions")));
driver.findElement(By.xpath("//li[text()='Bangalore']")).click();
\`\`\``,
  },
  {
    id: "sel9", domain: "Selenium & Testing", type: "technical", difficulty: "Medium",
    question: "How do you handle Alerts, Frames/iFrames, and Multiple Windows in Selenium WebDriver?",
    hint: "Alerts: driver.switchTo().alert(). Frames: switchTo().frame(id/index/element). Windows: getWindowHandles() set, iterate and switchTo(). Always switch back after.",
    keyPoints: ["Alert: accept(), dismiss(), getText(), sendKeys()", "Frame: switchTo().frame() then switchTo().defaultContent()", "Windows: getWindowHandle() + getWindowHandles()", "Store parent handle before opening child", "Wait for new window to appear before switching"],
    modelAnswer: `**Handling Alerts**:
\`\`\`java
// Simple alert (OK button)
Alert alert = driver.switchTo().alert();
System.out.println(alert.getText());  // read message
alert.accept();   // click OK
// alert.dismiss();  // click Cancel

// Confirmation alert
WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(10));
Alert alert = wait.until(ExpectedConditions.alertIsPresent());
alert.accept();  // or alert.dismiss();

// Prompt alert (text input)
Alert prompt = driver.switchTo().alert();
prompt.sendKeys("My answer");
prompt.accept();
\`\`\`

**Handling Frames/iFrames**:
\`\`\`java
// Switch by frame index (0-based)
driver.switchTo().frame(0);

// Switch by frame id or name attribute
driver.switchTo().frame("loginFrame");

// Switch by WebElement
WebElement frameElement = driver.findElement(By.cssSelector("iframe#myFrame"));
driver.switchTo().frame(frameElement);

// Interact with elements inside frame
driver.findElement(By.id("username")).sendKeys("admin");

// Switch back to main document
driver.switchTo().defaultContent();

// Nested frames: switch frame by frame
driver.switchTo().frame("outerFrame");
driver.switchTo().frame("innerFrame");
driver.switchTo().parentFrame();  // go up one level
\`\`\`

**Handling Multiple Windows/Tabs**:
\`\`\`java
// Save parent window handle
String parentWindow = driver.getWindowHandle();

// Click link that opens new window
driver.findElement(By.linkText("Open New Window")).click();

// Wait for new window to open
WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(10));
wait.until(d -> d.getWindowHandles().size() > 1);

// Switch to new window
for (String handle : driver.getWindowHandles()) {
    if (!handle.equals(parentWindow)) {
        driver.switchTo().window(handle);
        break;
    }
}

// Do work in new window
System.out.println(driver.getTitle());
driver.close();  // close child window

// Switch back to parent
driver.switchTo().window(parentWindow);
\`\`\``,
  },
  {
    id: "sel10", domain: "Selenium & Testing", type: "technical", difficulty: "Medium",
    question: "How do you perform keyboard and mouse actions in Selenium? Explain the Actions class with examples.",
    hint: "Actions class handles complex interactions: hover, right-click, double-click, drag-and-drop, keyboard combinations. Must call .perform() to execute the action chain.",
    keyPoints: ["Actions class for complex interactions", "moveToElement: hover", "contextClick: right-click", "doubleClick", "dragAndDrop", "keyDown/keyUp for combinations", ".perform() executes the chain"],
    modelAnswer: `**Actions class** (org.openqa.selenium.interactions) handles mouse and keyboard interactions that simple \`click()\`/\`sendKeys()\` can't handle.

\`\`\`java
Actions actions = new Actions(driver);

// Hover (mouse-over) to reveal a dropdown
WebElement menu = driver.findElement(By.id("navMenu"));
actions.moveToElement(menu).perform();  // hover
// Now the dropdown is visible
driver.findElement(By.linkText("SubMenu Item")).click();

// Right-click (context menu)
WebElement element = driver.findElement(By.id("rightClickBtn"));
actions.contextClick(element).perform();
// Select from context menu
driver.findElement(By.xpath("//li[text()='Copy']")).click();

// Double-click
actions.doubleClick(driver.findElement(By.id("editableField"))).perform();

// Drag and Drop
WebElement source = driver.findElement(By.id("draggable"));
WebElement target = driver.findElement(By.id("droppable"));
actions.dragAndDrop(source, target).perform();
// Alternative: clickAndHold + moveToElement + release
actions.clickAndHold(source)
       .moveToElement(target)
       .release()
       .perform();

// Keyboard combinations (Ctrl+A, Ctrl+C, etc.)
actions.keyDown(Keys.CONTROL).sendKeys("a").keyUp(Keys.CONTROL).perform();  // Select All
actions.keyDown(Keys.CONTROL).sendKeys("c").keyUp(Keys.CONTROL).perform();  // Copy
actions.keyDown(Keys.CONTROL).sendKeys("v").keyUp(Keys.CONTROL).perform();  // Paste

// Click at specific coordinates (x, y offset from element)
actions.moveToElement(element, 10, 20).click().perform();

// Chain multiple actions
actions.moveToElement(firstElement)
       .click()
       .moveToElement(secondElement)
       .doubleClick()
       .perform();
\`\`\`

**When to use Actions vs JavascriptExecutor**:
- Actions: most interactions. Simulates real user interaction.
- JavascriptExecutor: when Actions doesn't work (hidden elements, elements outside viewport): \`((JavascriptExecutor) driver).executeScript("arguments[0].click();", element);\``,
  },
  {
    id: "sel11", domain: "Selenium & Testing", type: "technical", difficulty: "Medium",
    question: "How do you handle dropdowns in Selenium? Explain the Select class and how to handle custom (non-native) dropdowns.",
    hint: "Select class works with native HTML <select> elements. Custom dropdowns (styled divs) need click + findElements approach. Cover selectByVisibleText, selectByValue, selectByIndex.",
    keyPoints: ["Select class: only for HTML <select>", "selectByVisibleText, selectByValue, selectByIndex", "getOptions(), getFirstSelectedOption()", "Custom dropdown: click to open + findElement text", "Multi-select: isMultiple()"],
    modelAnswer: `**Native HTML <select> Dropdown — Select class**:
\`\`\`java
// HTML: <select id="country">
//   <option value="in">India</option>
//   <option value="us">USA</option>
// </select>

WebElement dropdownElement = driver.findElement(By.id("country"));
Select select = new Select(dropdownElement);

// Select by visible text (what user sees)
select.selectByVisibleText("India");

// Select by value attribute
select.selectByValue("us");

// Select by index (0-based)
select.selectByIndex(2);

// Get all options
List<WebElement> options = select.getOptions();
for (WebElement opt : options) {
    System.out.println(opt.getText() + " | value: " + opt.getAttribute("value"));
}

// Get first selected option
System.out.println(select.getFirstSelectedOption().getText());

// Multi-select dropdown
if (select.isMultiple()) {
    select.selectByVisibleText("Java");
    select.selectByVisibleText("Python");
    select.deselectAll();
}
\`\`\`

**Custom (Non-Native) Dropdown** — styled div/ul/li dropdowns:
\`\`\`java
// HTML: <div class="custom-select">
//   <div class="select-trigger">Select Country</div>
//   <ul class="options">
//     <li data-value="in">India</li>
//     <li data-value="us">USA</li>
//   </ul>
// </div>

// Step 1: Click to open
driver.findElement(By.className("select-trigger")).click();

// Step 2: Wait for options to appear
WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(10));
wait.until(ExpectedConditions.visibilityOfElementLocated(By.className("options")));

// Step 3: Click desired option
driver.findElement(By.xpath("//li[text()='India']")).click();

// Handling auto-suggest / type-ahead
WebElement search = driver.findElement(By.id("citySearch"));
search.sendKeys("Bang");
// Wait for suggestions
List<WebElement> suggestions = wait.until(
    ExpectedConditions.visibilityOfAllElementsLocatedBy(By.className("suggestion-item")));
// Click first suggestion or find specific one
suggestions.get(0).click();
\`\`\``,
  },
  {
    id: "sel12", domain: "Selenium & Testing", type: "technical", difficulty: "Medium",
    question: "How do you take screenshots in Selenium? How do you capture screenshots on test failure in TestNG?",
    hint: "TakesScreenshot interface. getScreenshotAs(OutputType.FILE). For failure capture: implement ITestListener or use @AfterMethod with ITestResult.",
    keyPoints: ["TakesScreenshot interface", "getScreenshotAs(OutputType.FILE/BASE64/BYTES)", "FileUtils.copyFile to save", "ITestListener.onTestFailure() for automatic capture", "Attach to Extent Reports"],
    modelAnswer: `**Taking Screenshots Manually**:
\`\`\`java
// WebDriver must implement TakesScreenshot (ChromeDriver, FirefoxDriver do)
public static String takeScreenshot(WebDriver driver, String testName) {
    TakesScreenshot ts = (TakesScreenshot) driver;
    File src = ts.getScreenshotAs(OutputType.FILE);
    String path = "screenshots/" + testName + "_" + System.currentTimeMillis() + ".png";
    File dest = new File(path);
    FileUtils.copyFile(src, dest);  // Apache Commons IO
    return path;
}

// As Base64 (useful for embedding in HTML reports)
String base64 = ts.getScreenshotAs(OutputType.BASE64);
// Embed: "<img src='data:image/png;base64," + base64 + "'/>"

// Screenshot of specific element (Selenium 4+)
WebElement element = driver.findElement(By.id("chart"));
File elementShot = element.getScreenshotAs(OutputType.FILE);
\`\`\`

**Automatic Screenshot on Failure — ITestListener**:
\`\`\`java
public class ScreenshotListener implements ITestListener {

    @Override
    public void onTestFailure(ITestResult result) {
        // Get driver from test class via reflection or ThreadLocal
        WebDriver driver = ((BaseTest) result.getInstance()).getDriver();
        String screenshotPath = takeScreenshot(driver, result.getName());
        System.out.println("Screenshot saved: " + screenshotPath);

        // Attach to Extent Reports (if using ExtentReports)
        ExtentTest extentTest = ExtentManager.getTest();
        extentTest.addScreenCaptureFromPath(screenshotPath);
    }
}
// Register in testng.xml:
// <listeners><listener class-name="com.tests.ScreenshotListener"/></listeners>
\`\`\`

**Using @AfterMethod (simpler approach)**:
\`\`\`java
@AfterMethod
public void tearDown(ITestResult result) {
    if (result.getStatus() == ITestResult.FAILURE) {
        String path = takeScreenshot(driver, result.getName());
        // Attach to report
    }
    driver.quit();
}
\`\`\`

**Thread-safe screenshots** (parallel execution): Use \`ThreadLocal<WebDriver>\` so each thread has its own driver instance — screenshots don't mix up between parallel tests.`,
  },
  {
    id: "sel13", domain: "Selenium & Testing", type: "technical", difficulty: "Medium",
    question: "How do you read test data from Excel in Selenium? Explain Apache POI integration and the Data-Driven framework.",
    hint: "Apache POI reads .xlsx (XSSFWorkbook) and .xls (HSSFWorkbook). DataProvider feeds data from Excel to TestNG @Test. Explain Workbook → Sheet → Row → Cell hierarchy.",
    keyPoints: ["Apache POI: XSSF (.xlsx), HSSF (.xls)", "Workbook → Sheet → Row → Cell hierarchy", "@DataProvider returns Object[][] from Excel", "getCell().getStringCellValue() etc.", "Close workbook after reading"],
    modelAnswer: `**Apache POI Setup** (pom.xml):
\`\`\`xml
<dependency>
    <groupId>org.apache.poi</groupId>
    <artifactId>poi-ooxml</artifactId>
    <version>5.2.3</version>
</dependency>
\`\`\`

**Reading Excel Data**:
\`\`\`java
public class ExcelUtils {
    private XSSFWorkbook workbook;
    private XSSFSheet sheet;

    public ExcelUtils(String filePath, String sheetName) throws Exception {
        FileInputStream fis = new FileInputStream(filePath);
        workbook = new XSSFWorkbook(fis);
        sheet = workbook.getSheet(sheetName);
        fis.close();
    }

    public String getCellData(int rowNum, int colNum) {
        XSSFRow row = sheet.getRow(rowNum);
        if (row == null) return "";
        XSSFCell cell = row.getCell(colNum);
        if (cell == null) return "";
        // Handle different cell types
        switch (cell.getCellType()) {
            case STRING:  return cell.getStringCellValue();
            case NUMERIC:
                if (DateUtil.isCellDateFormatted(cell))
                    return cell.getDateCellValue().toString();
                return String.valueOf((int) cell.getNumericCellValue());
            case BOOLEAN: return String.valueOf(cell.getBooleanCellValue());
            default: return "";
        }
    }

    public int getRowCount() { return sheet.getLastRowNum(); }
    public int getColCount(int rowNum) { return sheet.getRow(rowNum).getLastCellNum(); }
    public void close() throws Exception { workbook.close(); }
}
\`\`\`

**TestNG @DataProvider with Excel**:
\`\`\`java
@DataProvider(name = "loginData")
public Object[][] getLoginData() throws Exception {
    ExcelUtils excel = new ExcelUtils("testdata/login.xlsx", "LoginData");
    int rows = excel.getRowCount();
    Object[][] data = new Object[rows][2];  // rows x columns
    for (int i = 1; i <= rows; i++) {  // skip header row (i=0)
        data[i-1][0] = excel.getCellData(i, 0);  // username column
        data[i-1][1] = excel.getCellData(i, 1);  // password column
    }
    excel.close();
    return data;
}

@Test(dataProvider = "loginData")
public void testLogin(String username, String password) {
    loginPage.login(username, password);
    // assertions...
}
\`\`\`

**Excel Structure** (login.xlsx, "LoginData" sheet):
\`\`\`
| Username      | Password   | ExpectedResult |
|---------------|------------|----------------|
| admin@test.com| Pass123    | success        |
| wrong@test.com| wrongpass  | failure        |
\`\`\`

**Write Back Results to Excel**:
\`\`\`java
public void setCellData(int rowNum, int colNum, String value) {
    sheet.getRow(rowNum).getCell(colNum).setCellValue(value);
    FileOutputStream fos = new FileOutputStream(filePath);
    workbook.write(fos);
    fos.close();
}
\`\`\``,
  },
  {
    id: "sel14", domain: "Selenium & Testing", type: "technical", difficulty: "Medium",
    question: "How do you generate test reports in Selenium? Explain Extent Reports and how to integrate them with TestNG.",
    hint: "ExtentReports: initialise once, create ExtentTest per test, log steps pass/fail/info, flush at end. Integrate via ITestListener or @AfterMethod. Attach screenshots on failure.",
    keyPoints: ["ExtentReports: SparkReporter for HTML", "ExtentTest per @Test method", "test.log(Status.PASS/FAIL/INFO)", "Attach screenshots on failure", "ThreadLocal for parallel execution"],
    modelAnswer: `**Extent Reports Setup** (pom.xml):
\`\`\`xml
<dependency>
    <groupId>com.aventstack</groupId>
    <artifactId>extentreports</artifactId>
    <version>5.1.1</version>
</dependency>
\`\`\`

**ExtentReports Manager (Singleton pattern)**:
\`\`\`java
public class ExtentManager {
    private static ExtentReports extent;
    private static ThreadLocal<ExtentTest> test = new ThreadLocal<>();

    public static ExtentReports getInstance() {
        if (extent == null) {
            ExtentSparkReporter reporter = new ExtentSparkReporter("reports/ExtentReport.html");
            reporter.config().setReportName("Automation Test Report");
            reporter.config().setDocumentTitle("Test Results");
            extent = new ExtentReports();
            extent.attachReporter(reporter);
            extent.setSystemInfo("Environment", "Staging");
            extent.setSystemInfo("Browser", "Chrome");
        }
        return extent;
    }

    public static void setTest(ExtentTest extentTest) { test.set(extentTest); }
    public static ExtentTest getTest() { return test.get(); }
}
\`\`\`

**TestNG Listener Integration**:
\`\`\`java
public class ExtentReportListener implements ITestListener {

    @Override
    public void onStart(ITestContext context) {
        ExtentManager.getInstance();  // initialise report
    }

    @Override
    public void onTestStart(ITestResult result) {
        ExtentTest test = ExtentManager.getInstance()
            .createTest(result.getMethod().getMethodName());
        test.assignCategory(result.getTestClass().getName());
        ExtentManager.setTest(test);
    }

    @Override
    public void onTestSuccess(ITestResult result) {
        ExtentManager.getTest().log(Status.PASS, "Test PASSED");
    }

    @Override
    public void onTestFailure(ITestResult result) {
        ExtentManager.getTest().log(Status.FAIL, result.getThrowable());
        // Attach screenshot
        String screenshotBase64 = ((TakesScreenshot) getDriver()).getScreenshotAs(OutputType.BASE64);
        ExtentManager.getTest().addScreenCaptureFromBase64String(screenshotBase64, "Failure Screenshot");
    }

    @Override
    public void onTestSkipped(ITestResult result) {
        ExtentManager.getTest().log(Status.SKIP, "Test SKIPPED");
    }

    @Override
    public void onFinish(ITestContext context) {
        ExtentManager.getInstance().flush();  // writes HTML report to disk
    }
}
\`\`\`

**Logging steps in test**:
\`\`\`java
ExtentManager.getTest().log(Status.INFO, "Navigating to login page");
ExtentManager.getTest().log(Status.INFO, "Entering credentials");
ExtentManager.getTest().log(Status.PASS, "Login successful. URL: " + driver.getCurrentUrl());
\`\`\`

**Register listener in testng.xml**:
\`\`\`xml
<listeners>
    <listener class-name="com.framework.listeners.ExtentReportListener"/>
</listeners>
\`\`\``,
  },
  {
    id: "sel15", domain: "Selenium & Testing", type: "technical", difficulty: "Medium",
    question: "How do you handle JavaScript-based interactions in Selenium? Explain JavascriptExecutor with common use cases.",
    hint: "JavascriptExecutor executes JavaScript in the browser. Use for: scroll, click hidden elements, set input values, get element text/attributes, highlight elements for debugging.",
    keyPoints: ["executeScript and executeAsyncScript", "Scroll to element / to coordinates", "Click via JS when WebDriver click fails", "Set value in JS for read-only fields", "Highlight element for debugging"],
    modelAnswer: `**JavascriptExecutor** — execute JavaScript directly in the browser. Useful when WebDriver's native methods fail (hidden elements, read-only fields, scroll needed).

\`\`\`java
JavascriptExecutor js = (JavascriptExecutor) driver;

// --- Scrolling ---
// Scroll to bottom of page
js.executeScript("window.scrollTo(0, document.body.scrollHeight);");

// Scroll to top
js.executeScript("window.scrollTo(0, 0);");

// Scroll to specific element (bring into view)
WebElement element = driver.findElement(By.id("submitBtn"));
js.executeScript("arguments[0].scrollIntoView(true);", element);
// With smooth behavior
js.executeScript("arguments[0].scrollIntoView({behavior:'smooth', block:'center'});", element);

// --- Clicking when .click() doesn't work ---
// Useful for: hidden elements, elements covered by overlay, animations in progress
js.executeScript("arguments[0].click();", element);

// --- Setting value in read-only / disabled fields ---
js.executeScript("arguments[0].value = arguments[1];", element, "new value");

// --- Getting element properties ---
String text = (String) js.executeScript("return arguments[0].innerText;", element);
String value = (String) js.executeScript("return arguments[0].value;", element);
Boolean isVisible = (Boolean) js.executeScript(
    "return window.getComputedStyle(arguments[0]).display !== 'none';", element);

// --- Highlighting element for debugging ---
js.executeScript("arguments[0].style.border='3px solid red';", element);

// --- Opening new tab ---
js.executeScript("window.open('https://google.com', '_blank');");
// Switch to new tab
List<String> tabs = new ArrayList<>(driver.getWindowHandles());
driver.switchTo().window(tabs.get(1));

// --- Async script (useful for AJAX wait) ---
js.executeAsyncScript(
    "var callback = arguments[arguments.length - 1];" +
    "setTimeout(callback, 2000);");  // wait 2 seconds asynchronously
\`\`\`

**When to use JavascriptExecutor vs Actions vs WebDriver native**:
- **WebDriver native** (findElement, click, sendKeys): Always prefer — most reliable, simulates real user.
- **Actions**: Complex mouse/keyboard interactions (hover, drag, right-click).
- **JavascriptExecutor**: Last resort — hidden elements, read-only fields, scroll, when native methods fail. Bypasses browser event model — may not trigger event listeners correctly.`,
  },
  {
    id: "sel8", domain: "Selenium & Testing", type: "technical", difficulty: "Medium",
    question: "What is the difference between Assert and Verify in Selenium? What are Soft Assertions and when do you use them?",
    hint: "Assert: test stops on failure (hard assert). Verify: continues after failure (soft). TestNG has SoftAssert class. Explain when to use each.",
    keyPoints: ["Hard Assert: stops test immediately", "Soft Assert: collects failures, reports all", "TestNG SoftAssert.assertAll()", "Assert for critical blockers, Soft for field validations", "Types of assertions (assertEquals, assertTrue, assertNull)"],
    modelAnswer: `**Hard Assertions (Assert)** — Test stops immediately on failure:
\`\`\`java
// TestNG Assert
Assert.assertEquals(actual, expected, "Login should succeed");
Assert.assertTrue(page.isDisplayed(), "Page should be visible");
Assert.assertNotNull(response, "Response should not be null");
Assert.assertEquals(list.size(), 5, "Should have 5 items");
\`\`\`
If \`assertEquals\` fails → throws \`AssertionError\` → test stops. Remaining assertions NOT executed.

**Use hard assert when**: The failure is a blocker — no point continuing if login failed, login page not loaded, or API returned null.

**Soft Assertions** — Continue test after failure, report all failures at end:
\`\`\`java
// TestNG SoftAssert
SoftAssert softAssert = new SoftAssert();

softAssert.assertEquals(nameField.getText(), "John", "Name mismatch");
softAssert.assertEquals(emailField.getText(), "john@test.com", "Email mismatch");
softAssert.assertTrue(saveBtn.isEnabled(), "Save button should be enabled");
softAssert.assertEquals(statusField.getText(), "Active", "Status mismatch");

softAssert.assertAll();  // MUST call this! Collects and throws all failures
\`\`\`
All 4 assertions run even if the first fails. \`assertAll()\` throws one combined failure with ALL assertion errors.

**Use soft assert when**: Validating multiple fields on a form, verifying all columns in a table row, checking all elements on a page — you want to see ALL failures in one test run.

**Assertion Types (TestNG)**:
- \`assertEquals(actual, expected)\` — equality
- \`assertTrue(condition)\` / \`assertFalse(condition)\`
- \`assertNull(obj)\` / \`assertNotNull(obj)\`
- \`assertSame(obj1, obj2)\` — same object reference (==)
- \`assertEquals(list1, list2)\` — collection equality
- \`assertThrows()\` — verify exception thrown

**vs Verify** (Selenium IDE legacy term): In old Selenium RC, \`verify\` was soft (continues on failure), \`assert\` was hard. In modern Selenium + TestNG, use Hard Assert vs SoftAssert explicitly.`,
  },
];

// ─── Role-based question selector ─────────────────────────────────────────────

const ALL_BANK_QUESTIONS: QuestionBankItem[] = [
  ...DSA_QUESTIONS,
  ...SYSTEM_DESIGN_QUESTIONS,
  ...CICD_DEVOPS_QUESTIONS,
  ...B2B_INTEGRATION_QUESTIONS,
  ...API_MANAGEMENT_QUESTIONS,
  ...DATABASE_QUESTIONS,
  ...CLOUD_QUESTIONS,
  ...QA_TESTING_QUESTIONS,
  ...JAVA_OOP_QUESTIONS,
  ...SELENIUM_QUESTIONS,
];

/** Deterministic seeded shuffle — same seed → same order, different seed → different order */
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const j = Math.abs(s) % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function getQuestionsForRole(
  role: string,
  skills: string[],
  _exp: number,
  seed: number = 0,
): QuestionBankItem[] {
  const r = role.toLowerCase();
  const s = skills.map((x) => x.toLowerCase()).join(" ");
  const context = `${r} ${s}`;

  const domainScores: Record<string, number> = {
    "DSA":                  0,
    "System Design":        0,
    "CI/CD & DevOps":       0,
    "B2B Integration":      0,
    "API Management":       0,
    "Databases":            0,
    "Cloud":                0,
    "QA & Testing":         0,
    "Java & OOP":           0,
    "Selenium & Testing":   0,
  };

  // Score domains by role/skill relevance
  if (/dsa|algorithm|data structure|leetcode|coding|competitive/i.test(context)) domainScores["DSA"] += 10;
  if (/architect|system design|principal|staff|senior/i.test(context)) domainScores["System Design"] += 10;
  if (/devops|sre|platform|cicd|ci\/cd|pipeline|jenkins|github action|argocd|terraform|kubernetes|docker/i.test(context)) domainScores["CI/CD & DevOps"] += 10;
  if (/b2b|integration|webmethod|mulesoft|boomi|tibco|sterling|edi|trading network|middleware|ipaas|bpm/i.test(context)) domainScores["B2B Integration"] += 10;
  if (/api management|api gateway|kong|apigee|apim|api manager/i.test(context)) domainScores["API Management"] += 10;
  if (/database|dba|sql|nosql|postgres|oracle|mongodb|cassandra|redis|snowflake/i.test(context)) domainScores["Databases"] += 10;
  if (/aws|azure|gcp|cloud|lambda|s3|ec2|eks|aks|iam/i.test(context)) domainScores["Cloud"] += 10;
  if (/qa|quality|test engineer|sdet|playwright|cypress|automation|postman|jmeter|appium/i.test(context)) domainScores["QA & Testing"] += 10;
  if (/java|spring|hibernate|maven|gradle|jvm|j2ee|microservice.*java|backend.*java/i.test(context)) domainScores["Java & OOP"] += 10;
  if (/selenium|webdriver|testng|junit|cucumber|bdd|page object|pom|automation.*test/i.test(context)) domainScores["Selenium & Testing"] += 10;

  // Always include DSA and System Design at a base level
  domainScores["DSA"] = Math.max(domainScores["DSA"], 3);
  domainScores["System Design"] = Math.max(domainScores["System Design"], 3);
  // Include Java & OOP at base level (universally relevant)
  domainScores["Java & OOP"] = Math.max(domainScores["Java & OOP"], 2);

  const sorted = Object.entries(domainScores)
    .filter(([, score]) => score > 0)
    .sort(([, a], [, b]) => b - a);

  const selected: QuestionBankItem[] = [];

  for (const [domain] of sorted) {
    const pool = ALL_BANK_QUESTIONS.filter((q) => q.domain === domain);
    // Rotate the pool by seed so each "refresh" gets a different slice
    const shuffled = seededShuffle(pool, seed + domain.charCodeAt(0));
    const take = domainScores[domain] >= 10 ? 4 : 2;
    selected.push(...shuffled.slice(0, take));
  }

  return selected;
}

/** All questions for a domain — used for "browse all" mode */
export function getAllQuestionsForDomain(domain: string): QuestionBankItem[] {
  return ALL_BANK_QUESTIONS.filter((q) => q.domain === domain);
}

/** All available domains */
export const ALL_DOMAINS = [
  "DSA", "System Design", "CI/CD & DevOps", "B2B Integration",
  "API Management", "Databases", "Cloud", "QA & Testing",
  "Java & OOP", "Selenium & Testing",
];
