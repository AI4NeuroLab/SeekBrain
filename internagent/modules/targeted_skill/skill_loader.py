"""
skill_loader.py — 使用大模型读取 INDEX.md，判断并加载最相关的 Skill
"""
import json
import logging
import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional
import re
from pathlib import Path
from typing import List
try:
    from loguru import logger
except ImportError:
    logger = logging.getLogger(__name__)

from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

def _find_env_path() -> Path:
    for parent in Path(__file__).resolve().parents:
        candidate = parent / ".env"
        if candidate.exists():
            return candidate
    return Path(__file__).resolve().parents[4] / ".env"


ENV_PATH = _find_env_path()
load_dotenv(ENV_PATH)

def _mask_secret(value: Optional[str]) -> str:
    if not value:
        return "<missing>"
    if len(value) <= 10:
        return f"<set len={len(value)}>"
    return f"{value[:6]}...{value[-4:]} (len={len(value)})"

# ────────────────────────── LLM 构建 ──────────────────────────
def build_llm(model: str = "gemini-3.1-pro-preview", temperature: float = 0.0):
    load_dotenv(ENV_PATH, override=True)
    base_url = os.getenv("OPENAI_BASE_URL")
    api_key = os.getenv("OPENAI_API_KEY")
    http_proxy = os.getenv("HTTP_PROXY")
    if os.environ.get("_INTERNAGENT_OPENAI_ENV_PRINTED") != "1":
        os.environ["_INTERNAGENT_OPENAI_ENV_PRINTED"] = "1"
        print(
            "[OpenAI env] "
            f"source=SkillLoader "
            f"ENV_PATH={ENV_PATH} "
            f"OPENAI_API_KEY={_mask_secret(api_key)} "
            f"OPENAI_BASE_URL={base_url or '<missing>'}",
            flush=True,
        )
    if not api_key:
        raise RuntimeError(f"OPENAI_API_KEY is not set; checked {ENV_PATH}")
    if not base_url:
        raise RuntimeError(f"OPENAI_BASE_URL is not set; checked {ENV_PATH}")
    logger.info(f"Using LLM model={model}")
    logger.debug(f"Base URL={base_url}, Proxy={http_proxy}")
    return ChatOpenAI(
        model=model, temperature=temperature,
        base_url=base_url, api_key=api_key,
    )

# ────────────────────────── 数据结构 ──────────────────────────
@dataclass
class SkillInfo:
    """INDEX.md 中解析出的单条 Skill 元信息"""
    name: str
    description: str
    path: Path
    score: float = 0.0  # LLM 给出的相关性分数 (0~1)

@dataclass
class SkillContent:
    """一个 Skill 加载后的完整内容"""
    name: str
    score: float
    skill_md: str = ""
    resources: Dict[str, str] = field(default_factory=dict)

# ────────────────────────── Prompt 模板 ──────────────────────────
SKILL_MATCH_SYSTEM_PROMPT = """\
You are a Skill Router. Your task is to select the most relevant Skills from the Skill list below based on the user's question.
## Rules
1. Carefully read the name and description of each Skill, and assess its relevance to the user's question.
2. Assign a relevance score between 0 and 1 to each relevant Skill. Only keep those with a score ≥ {threshold}.
3. Return at most {top_k} Skills.
4. **Strictly follow the JSON format below. Do not output anything else.**
## Output Format
```json
[
  {{"name": "skill_folder_name", "relevance": 0.85}},
  {{"name": "another_skill", "relevance": 0.72}}
]
```
If no Skill is relevant, output an empty list:
```json
[]
```
"""

SKILL_MATCH_USER_PROMPT = """\
## User Question
{question}
## Skill List (from INDEX.md)
{index_content}
"""

# ────────────────────────── SkillLoader 主体 ──────────────────────────
class SkillLoader:
    """
    使用大模型判断应加载哪些 Skill，然后加载 SKILL.md + scripts/*.py。

    用法::

        loader = SkillLoader(
            skills_dir="./skills",
            top_k=2,
            relevance_threshold=0.5,
            model="gemini-3.1-pro-preview",
        )
        result = loader.load(
            question="如何做数据可视化？",
            resource_load_mode="all",
            resource_filter={"suffixes": [".md", ".py"], "max_files": 5},
        )
    """

    def __init__(
        self,
        skills_dir: str,
        top_k: int = 1,
        relevance_threshold: float = 0.5,
        model: str = "claude-opus-4-6",
        temperature: float = 1.0,
    ):
        self.skills_dir = Path(skills_dir)
        self.top_k = top_k
        self.relevance_threshold = relevance_threshold

        self._index_path = self.skills_dir / "INDEX.md"
        if not self._index_path.exists():
            raise FileNotFoundError(f"INDEX.md not found in {self.skills_dir}")

        # 读取原始 INDEX.md 内容（完整保留，交给 LLM 理解）
        self._index_raw: str = self._index_path.read_text(encoding="utf-8")

        # 同时解析出结构化信息，用于校验 LLM 返回的 name 是否合法
        self._skills_index: List[SkillInfo] = self._parse_index()
        self._valid_names = {s.name for s in self._skills_index}
        self.last_matched_skills: List[SkillInfo] = []

        # 构建 LLM
        self._llm = build_llm(model=model, temperature=temperature)
        print("\n" + "=" * 80)

        print("[SkillLoader DEBUG] 初始化 SkillLoader")

        print(f"[SkillLoader DEBUG] skills_dir = {self.skills_dir}")

        print(f"[SkillLoader DEBUG] index_path = {self._index_path}")

        print(f"[SkillLoader DEBUG] index_exists = {self._index_path.exists()}")

        print(f"[SkillLoader DEBUG] top_k = {self.top_k}")

        print(f"[SkillLoader DEBUG] relevance_threshold = {self.relevance_threshold}")

        print(f"[SkillLoader DEBUG] model = {model}")

        print(f"[SkillLoader DEBUG] temperature = {temperature}")

        print("[SkillLoader DEBUG] valid_names =", self._valid_names)

        print("=" * 80 + "\n")

    # ──────────────── 1. 解析 INDEX.md ────────────────
    def _parse_index(self) -> List[SkillInfo]:
        """
        解析 INDEX.md，支持 ### 格式，提取代码块中的 Skill 名或中括号中的 ID。
        """
        # 1. 调整正则：支持 ## 或 ###，并捕获内容
        # pattern 解释：
        # ^#{2,3}\s+        -> 匹配 2 到 3 个 # 开头的标题
        # (.+?)             -> 捕获组 1: 标题整行文字
        # \s*$              -> 行末
        # \n(.*?)(?=^#{2,3}\s|\Z) -> 匹配直到下一个标题或文件末尾的内容
        pattern = r"^#{2,3}\s+(.+?)\s*$\n(.*?)(?=^#{2,3}\s|\Z)"
        matches = re.findall(pattern, self._index_raw, re.MULTILINE | re.DOTALL)
        
        skills: List[SkillInfo] = []
        
        for full_title, desc in matches:
            full_title = full_title.strip()
            desc = desc.strip()
            
            # 2. 从标题中提取关键信息
            # 提取反引号内的内容: `zebrafish_...`
            skill_name_match = re.search(r"`(.+?)`", full_title)
            # 提取中括号内的内容: [Figure1C]
            ref_id_match = re.search(r"\[(.+?)\]", full_title)
            
            # 逻辑判断：优先使用反引号内的名字，如果没有则看是否是纯标题名
            name = None
            if skill_name_match:
                name = skill_name_match.group(1)
            elif ref_id_match:
                name = ref_id_match.group(1)
            else:
                name = full_title # 回退方案
                
            if not name:
                continue

            # 3. 验证路径（检查 skill_name 目录或 ref_id 目录）
            folder = self.skills_dir / name
            if folder.is_dir():
                skills.append(SkillInfo(name=name, description=desc, path=folder))
            else:
                # 如果按解析出的名字没找到，尝试检查整个标题命名的文件夹（兼容老版本）
                alt_folder = self.skills_dir / full_title
                if alt_folder.is_dir():
                    skills.append(SkillInfo(name=full_title, description=desc, path=alt_folder))
                else:
                    logger.debug(f"跳过条目: 文件夹 {name} 不存在")

        if not skills:
            logger.warning("INDEX.md 中未解析到有效 Skill 条目")
        return skills

    # ──────────────── 2. LLM 匹配 ────────────────
    def _match_skills(self, question: str) -> List[SkillInfo]:
        """调用大模型，从 INDEX.md 中挑选最相关的 Skill"""
        if not self._skills_index:
            return []

        system_msg = SKILL_MATCH_SYSTEM_PROMPT.format(
            threshold=self.relevance_threshold,
            top_k=self.top_k,
        )
        user_msg = SKILL_MATCH_USER_PROMPT.format(
            question=question,
            index_content=self._index_raw,
        )

        messages = [
            SystemMessage(content=system_msg),
            HumanMessage(content=user_msg),
        ]

        logger.info(f"[SkillLoader] 正在调用 LLM 匹配 Skill，问题: {question[:80]}...")
        response = self._llm.invoke(messages)
        raw_text = response.content.strip()
        logger.debug(f"[SkillLoader] LLM 原始返回:\n{raw_text}")

        # ---- 解析 JSON ----
        selected = self._parse_llm_response(raw_text)

        # ---- 校验 & 组装 SkillInfo ----
        name_to_skill = {s.name: s for s in self._skills_index}
        matched: List[SkillInfo] = []
        for item in selected:
            skill_name = item.get("name", "")
            relevance = float(item.get("relevance", 0.0))
            if skill_name not in self._valid_names:
                logger.warning(f"[SkillLoader] LLM 返回了不存在的 Skill: {skill_name}，跳过")
                continue
            if relevance < self.relevance_threshold:
                continue
            skill = name_to_skill[skill_name]
            skill.score = round(relevance, 4)
            matched.append(skill)

        # 按分数降序，取 top_k
        matched.sort(key=lambda s: s.score, reverse=True)
        matched = matched[: self.top_k]

        logger.info(
            f"[SkillLoader] 匹配结果: "
            f"{[(s.name, s.score) for s in matched] if matched else '无匹配'}"
        )
        return matched

    @staticmethod
    def _parse_llm_response(raw_text: str) -> List[Dict]:
        """
        从 LLM 返回中提取 JSON 列表，兼容 markdown 代码块包裹的情况。
        """
        # 尝试提取 ```json ... ``` 中的内容
        json_match = re.search(r"```(?:json)?\s*\n?(.*?)\n?\s*```", raw_text, re.DOTALL)
        json_str = json_match.group(1).strip() if json_match else raw_text

        # 再尝试找第一个 [ ... ] 块
        bracket_match = re.search(r"\[.*\]", json_str, re.DOTALL)
        if bracket_match:
            json_str = bracket_match.group(0)

        try:
            result = json.loads(json_str)
            if isinstance(result, list):
                return result
        except json.JSONDecodeError as e:
            logger.error(f"[SkillLoader] 解析 LLM JSON 失败: {e}\n原始文本: {raw_text}")
        return []

    # ──────────────── 3. 加载 Skill 资源 ────────────────
    def _load_skill(
        self,
        skill: SkillInfo,
        mode: str,
        resource_filter: Optional[Dict],
    ) -> SkillContent:
        """
        加载 Skill 的全部资源：
          1. SKILL.md           （始终加载）
          2. scripts/*.py 等    （mode="all" 时加载）
        """
        # ---------- SKILL.md ----------
        skill_md_path = skill.path / "SKILL.md"
        skill_md = ""
        if skill_md_path.exists():
            skill_md = skill_md_path.read_text(encoding="utf-8")

        sc = SkillContent(name=skill.name, score=skill.score, skill_md=skill_md)

        if mode == "skill_only":
            return sc

        # ---------- 资源过滤参数 ----------
        suffixes = set(
            resource_filter.get("suffixes", [".py"])
        ) if resource_filter else {".py"}
        max_files = (
            resource_filter.get("max_files", 10)
        ) if resource_filter else 10

        #### if loading only skill.md，注释掉
        # ---------- scripts/ 目录 ----------
        scripts_dir = skill.path / "scripts"
        if scripts_dir.is_dir():
            for f in sorted(scripts_dir.rglob("*")):
                if len(sc.resources) >= max_files:
                    break
                if f.is_file() and f.suffix in suffixes:
                    try:
                        rel = str(f.relative_to(skill.path))
                        sc.resources[rel] = f.read_text(encoding="utf-8")
                    except (UnicodeDecodeError, PermissionError):
                        continue

        # ---------- Skill 根目录下的 .md（除 SKILL.md 外）----------
        if ".md" in suffixes:
            for f in sorted(skill.path.iterdir()):
                if len(sc.resources) >= max_files:
                    break
                if f.is_file() and f.suffix == ".md" and f.name != "SKILL.md":
                    try:
                        sc.resources[f.name] = f.read_text(encoding="utf-8")
                    except (UnicodeDecodeError, PermissionError):
                        continue

        return sc
    ##########################3

    # ──────────────── 4. 格式化输出 ────────────────
    @staticmethod
    def _format(contents: List[SkillContent]) -> str:
        parts: List[str] = []
        for sc in contents:
            header = (
                f"{'=' * 60}\n"
                f"  SKILL : {sc.name}  (relevance: {sc.score:.4f})\n"
                f"{'=' * 60}"
            )
            body = []
            if sc.skill_md:
                body.append(f"[SKILL.md]\n{sc.skill_md}")
            for rel_path, content in sc.resources.items():
                body.append(f"[{rel_path}]\n{content}")
            parts.append(header + "\n\n" + "\n\n".join(body))
        return "\n\n".join(parts)

    # ──────────────── 5. 公开接口 ────────────────
    def load(
        self,
        question: str,
        resource_load_mode: str = "all",
        resource_filter: Optional[Dict] = None,
    ) -> str:
        """
        Args:
            question:           用户问题，LLM 据此判断加载哪些 Skill
            resource_load_mode: "all"        — 加载 SKILL.md + scripts 资源
                                "skill_only" — 仅加载 SKILL.md
            resource_filter:    {"suffixes": [".md", ".py"], "max_files": 5}
        Returns:
            格式化后的 Skill 内容字符串；无匹配时返回空字符串
        """
        matched = self._match_skills(question)
        self.last_matched_skills = matched
        if not matched:
            return ""
        loaded = [
            self._load_skill(skill, mode=resource_load_mode, resource_filter=resource_filter)
            for skill in matched
        ]
        return self._format(loaded)

    # ──────────────── 辅助 ────────────────
    def list_skills(self) -> List[str]:
        """返回所有已索引的 Skill 名称"""
        return [s.name for s in self._skills_index]


# ────────────────────────── 使用示例 ──────────────────────────
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

    loader = SkillLoader(
        skills_dir="library/skills/trajectory",
        top_k=2,
        relevance_threshold=0.3,
        model="gemini-3.1-pro-preview",
        temperature=1.0,
    )

    print("已索引的 Skills:", loader.list_skills())

    result = loader.load(
        question="如何对斑马鱼神经数据做可视化分析？",
        resource_load_mode="all",
        resource_filter={
            "suffixes": [".md", ".py"],
            "max_files": 5,
        },
    )
    # print(result if result else "未找到匹配的 Skill")
