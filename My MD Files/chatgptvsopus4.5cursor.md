# Cursor Model Usage Framework – Opus vs ChatGPT

A practical, repeatable framework for deciding **when to use Opus vs ChatGPT inside Cursor** — optimized for **speed, cost control, and execution quality**.

---

## 1. The One Question That Matters

Before every run in Cursor, ask:

> **Am I deciding, or executing?**

This single question prevents **~80% of unnecessary credit spend**.

---

## 2. Decision Matrix (Memorize This)

### 🟢 Use **ChatGPT (GPT-5.2 / Codex)** when you are **EXECUTING**

Procedural, deterministic work where the steps are already known.

**Typical use cases**

* Implementing steps you already defined
* Adding shadcn components
* Wiring exports / imports
* Editing existing components
* Fixing TypeScript errors
* UI tweaks (spacing, variants, states)
* Following a spec or checklist
* Verifying functionality

**Recommended prompt style**

```
Implement exactly as specified.
Only touch the listed files.
No refactors.
Return a status checklist.
```

**Why this works**

* 5–10× fewer tokens than Opus
* Fast and predictable
* Lowest cost per run

**Defaults**

* Primary: `GPT-5.2`
* Ultra-cheap (single file): `GPT-5.1 Codex Mini`

---

### 🔴 Use **Opus** when you are **DECIDING**

Ambiguous, high-leverage thinking tasks where tradeoffs matter.

**Typical use cases**

* Designing a system from scratch
* Choosing architecture patterns
* Data modeling decisions
* State management strategy
* Performance bottlenecks with unclear causes
* Evaluating multiple approaches
* Resolving conflicting requirements

**Recommended prompt style**

```
Evaluate multiple approaches.
Explain tradeoffs.
Recommend one with rationale.
```

**Important**

* Use Opus **once** to decide
* Lock the decision
* Immediately switch back to ChatGPT for execution

---

## 3. The One-Way Door Rule (Critical)

> **Never iterate in Opus.**

Correct flow:

1. Use **Opus once** to make the decision
2. Write down the chosen approach
3. Switch to **ChatGPT** for all implementation

What burns credits:

* “Just one more tweak” in Opus
* UI or syntax changes in Opus
* Debugging small errors in Opus

---

## 4. Model Escalation Ladder

Always start at the bottom and move up **only if needed**.

1. **GPT-5.1 Codex Mini**

   * Single file changes
   * Clear, narrow instructions

2. **GPT-5.2**

   * Multi-file changes
   * UI + logic

3. **Opus**

   * Architecture or decision-making only

After Opus → **drop back down immediately**.

---

## 5. Context Control Rule

Opus becomes expensive when context is loose.

If you must use Opus, explicitly constrain it:

```
Limit context to these files only.
Do not scan the repository.
Focus on decision, not implementation.
```

---

## 6. Cost Signal Cheat Sheet

If you hear yourself think…

| Thought                     | Correct Model |
| --------------------------- | ------------- |
| “Follow these steps”        | ChatGPT       |
| “Just implement this”       | ChatGPT       |
| “Hook this up”              | ChatGPT       |
| “What’s the best approach?” | Opus          |
| “Should we choose A or B?”  | Opus          |
| “Design a system”           | Opus          |

---

## 7. Recommended Default Usage Pattern

For execution-heavy, UI-first workflows (shadcn, design systems, dashboards):

* **ChatGPT:** ~85–90% of usage
* **Opus:** ~10–15%, intentional and rare

Opus should feel **deliberate**, not habitual.

---

## 8. 10-Second Pre-Run Checklist

Before clicking **Run** in Cursor:

* Do I already know what I want? → **ChatGPT**
* Am I choosing between options? → **Opus**
* Am I writing code, not strategy? → **ChatGPT**
* Would a senior engineer just execute this? → **ChatGPT**

---

## Final Mental Model

> **Opus is a strategist. ChatGPT is your senior engineer.**

Use each for its natural role, and your speed, cost control, and consistency will compound over time.
