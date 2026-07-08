import os

def load_skill(skill_dir):
    """
    加载指定技能的所有文件内容（SKILL.md + scripts/*.py）

    Args:
        name: 技能名称

    Returns:
        context: 包含所有文件名和内容的字符串
    """

    if not os.path.exists(skill_dir):
        raise FileNotFoundError(f"Skill directory not found: {skill_dir}")

    context_parts = []

    # ──────────────────────────────────
    # 1. 读取 SKILL.md
    # ──────────────────────────────────
    skill_md_path = os.path.join(skill_dir, "SKILL.md")
    if os.path.exists(skill_md_path):
        with open(skill_md_path, "r", encoding="utf-8") as f:
            content = f.read()
        context_parts.append(f"=== File: SKILL.md ===\n{content}")
    else:
        print(f"[WARNING] SKILL.md not found in {skill_dir}")

    # ──────────────────────────────────
    # 2. 读取 scripts/ 目录下所有 .py 文件
    # ──────────────────────────────────
    scripts_dir = os.path.join(skill_dir, "scripts")
    if os.path.exists(scripts_dir):
        for filename in sorted(os.listdir(scripts_dir)):
            if filename.endswith(".py"):
                filepath = os.path.join(scripts_dir, filename)
                with open(filepath, "r", encoding="utf-8") as f:
                    content = f.read()
                context_parts.append(f"=== File: scripts/{filename} ===\n{content}")
    else:
        print(f"[WARNING] scripts/ directory not found in {skill_dir}")

    # ──────────────────────────────────
    # 3. 拼接所有内容
    # ──────────────────────────────────
    context = "\n\n".join(context_parts)

    return context

def load_skill_without_code(skill_dir):
    if not os.path.exists(skill_dir):
        raise FileNotFoundError(f"Skill directory not found: {skill_dir}")

    context_parts = []

    skill_md_path = os.path.join(skill_dir, "SKILL.md")
    if os.path.exists(skill_md_path):
        with open(skill_md_path, "r", encoding="utf-8") as f:
            content = f.read()
        context_parts.append(f"=== File: SKILL.md ===\n{content}")
    else:
        print(f"[WARNING] SKILL.md not found in {skill_dir}")

    context = "\n\n".join(context_parts)

    return context

def load_skill_and_ref_without_code(skill_dir):
    """Load SKILL.md + references/ content (no .py files)."""
    if not os.path.exists(skill_dir):
        raise FileNotFoundError(f"Skill directory not found: {skill_dir}")

    context_parts = []

    skill_md_path = os.path.join(skill_dir, "SKILL.md")
    if os.path.exists(skill_md_path):
        with open(skill_md_path, "r", encoding="utf-8") as f:
            content = f.read()
        context_parts.append(f"=== File: SKILL.md ===\n{content}")
    else:
        print(f"[WARNING] SKILL.md not found in {skill_dir}")

    refs_dir = os.path.join(skill_dir, "references")
    if os.path.exists(refs_dir):
        for filename in sorted(os.listdir(refs_dir)):
            if filename.endswith(".py"):
                continue
            filepath = os.path.join(refs_dir, filename)
            if not os.path.isfile(filepath):
                continue
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    content = f.read()
            except (UnicodeDecodeError, PermissionError):
                continue
            context_parts.append(f"=== File: references/{filename} ===\n{content}")
    else:
        print(f"[WARNING] references/ directory not found in {skill_dir}")

    context = "\n\n".join(context_parts)

    return context
