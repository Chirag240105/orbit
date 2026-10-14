"""AI-06: memory retrieval quality on a small labeled set. Results are recorded in docs/MEMORY_DESIGN.md.
Run with -s to print the table. The default method must not be worse than any alternative."""
from app.memory.service import DEFAULT_METHOD, SCORERS

MEMORIES = [
    "I deploy my side projects with Docker on a Hetzner VPS",            # 0
    "I prefer TypeScript with strict mode enabled",                       # 1
    "My main laptop runs Windows 11 with WSL Ubuntu",                     # 2
    "I use pnpm instead of npm for JavaScript projects",                  # 3
    "The ORBIT backend uses FastAPI and SQLite",                          # 4
    "I am preparing for backend developer interviews in December",       # 5
    "I write tests with pytest and keep coverage above 80 percent",      # 6
    "My team uses GitHub pull requests with one required review",        # 7
    "I like explanations with diagrams and real examples",               # 8
    "The hackathon demo must use NVIDIA Nemotron on Nebius",             # 9
    "I study Kubernetes on weekends",                                     # 10
    "My preferred code editor is VS Code with Vim keybindings",          # 11
    "I want short answers unless I ask for detail",                      # 12
    "Project deadline for ORBIT submission is the end of the month",     # 13
    "I use PostgreSQL at work and SQLite for personal projects",         # 14
]
QUERIES = [
    ("How should I deploy my new app?", {0}),
    ("Deploying a container to my server", {0}),
    ("Set up a new frontend project with a package manager", {3}),
    ("Configure TypeScript compiler options", {1}),
    ("Commands to run in my terminal on Windows", {2}),
    ("What database does ORBIT use?", {4}),
    ("Help me practice for interviews", {5}),
    ("How do I write tests for this function?", {6}),
    ("How should I review a pull request?", {7}),
    ("Explain load balancers", {8}),
    ("Which model must the demo use?", {9}),
    ("Teach me about Kubernetes pods", {10}),
    ("Configure my editor keybindings", {11}),
    ("Give me a detailed answer about caching", {12}),
    ("When is the submission deadline?", {13}),
    ("Compare PostgreSQL and SQLite", {14, 4}),
    ("Set up coverage reporting in CI", {6}),
    ("My laptop is slow when building Docker images", {2, 0}),
    ("Which databases do I use for personal projects?", {14}),
    ("Best way to structure FastAPI routes", {4}),
]


def evaluate(method: str, k: int = 3) -> tuple[float, float]:
    """(mean recall@k, mean reciprocal rank) over the labeled queries."""
    recall = mrr = 0.0
    for query, relevant in QUERIES:
        scores = SCORERS[method](query, MEMORIES)
        ranked = [i for s, i in sorted(((s, i) for i, s in enumerate(scores) if s > 0), key=lambda p: (-p[0], p[1]))]
        recall += len(relevant & set(ranked[:k])) / len(relevant)
        mrr += next((1 / (r + 1) for r, i in enumerate(ranked) if i in relevant), 0.0)
    return recall / len(QUERIES), mrr / len(QUERIES)


def test_default_method_is_not_worse_than_alternatives():
    results = {m: evaluate(m) for m in SCORERS}
    for m, (r, mrr) in results.items():
        print(f"{m:13s} recall@3={r:.3f} MRR={mrr:.3f}")
    best = max(r for r, _ in results.values())
    assert results[DEFAULT_METHOD][0] == best
