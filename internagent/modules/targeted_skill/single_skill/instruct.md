我需要生成代码完成以下功能，全部使用英文，不要使用中文，注意保存完整的cache，以避免重复运行：



Paper2Skill 和Repo2Skill并不是独立的部分，需要联合获取相关有用的skill

Paper： (The "Why" & "What")：定义任务目标、输入输出格式、核心算法的逻辑步骤、以及性能评估标准。

Repo： (The "How")：提供具体的代码实现（如 Python 脚本）、工具包调用逻辑、以及环境依赖。



paper 为papers/sciadv.adv7576.pdf

repo为 repos/Legare-zebrafish-brain-networks



对应的q.jsonl包含30个问题，每一个信息为{"tag": "Figure1C", "question":"question/Koninck_2025_SciAdv/coarse_version/Figure1C.md"}



目标读取每一个问题生成一个高质量的skill，标准的skill如下：

将核心代码放入 scripts/ 目录，将完整参考信息和原始信息放入references/，形成标准的 Skill 。

SKILL.md：首先包括一开始的YAML 元数据片段，包括name和description（需要结合Paper和repo 信息设置有效的触发词（Triggers）），将 Paper和Repo中的逻辑步骤转化为结构化的Prompts，规范输出格式。需要包括scripts/ 和references/的结构。



整体步骤如下：

1. 过一遍论文，建立结构化论文信息
2. 过一遍repo和每一个代码和文档相关文件（py,ipynb,md），建立结构化目录信息
3. 读取q.jsonl的每一行，获得类似{"tag": "Figure1C", "question":"question/Koninck_2025_SciAdv/coarse_version/Figure1C.md"}的信息，并加载md文本，记录为question
4. 根据question，建立起和论文，repo代码的联系，并获取对应匹配的全部上下文。这些内容，包括结构化信息还有联系，都需要保存，放到对应的references里面
5. 完整生成高质量skill文件夹
6. 遍历完每一行q.jsonl



需要用logger日志还有from langchain_openai import ChatOpenAI，使用gemini-3.1-pro-preview



