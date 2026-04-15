from src.core.types import KnowledgeCard


KNOWLEDGE_CARDS: tuple[KnowledgeCard, ...] = (
    KnowledgeCard(
        aliases=("格雷码", "gray code", "graycode"),
        definition="格雷码是一种相邻编码只相差 1 位的二进制编码方式，常用于降低状态切换时的误差。",
        core_idea="它的关键价值不在于更短，而在于相邻状态变化时只翻转一位，这样在硬件、电路或编码切换里更稳定。",
        common_confusion="最容易混淆的是把格雷码当成普通二进制直接计算；它和普通二进制能互转，但表示规则和使用目的并不一样。",
        first_step="先记住格雷码最核心的一句话：相邻编码之间只有 1 位不同，再看一个 2 位或 3 位格雷码序列例子。",
        next_step="再练习把一个小范围的普通二进制数转成格雷码，顺便观察为什么相邻值只变化一位。",
        checkpoint="如果你能解释格雷码为什么比普通二进制更适合描述相邻状态切换，说明核心已经抓住了。",
        practice_basic="什么叫“相邻编码只相差 1 位”？请用这句话解释格雷码。",
        practice_understanding="为什么在状态切换或编码器场景中，格雷码往往比普通二进制更合适？",
        practice_application="请写出 2 位或 3 位格雷码序列，并说明它和普通二进制序列最大的区别。",
    ),
    KnowledgeCard(
        aliases=("二叉树", "binary tree"),
        definition="二叉树是一种树形数据结构，每个节点最多只有两个子节点，通常称为左子节点和右子节点。",
        core_idea="学习二叉树时，重点是理解层级关系和递归结构，因为很多遍历、查找和分治问题都建立在这两个特点上。",
        common_confusion="最容易混淆的是把二叉树和二叉搜索树当成同一个概念；二叉搜索树只是满足大小顺序约束的特殊二叉树。",
        first_step="先画出一棵简单的二叉树，弄清楚根节点、父节点、子节点和叶子节点分别是什么。",
        next_step="再练习前序、中序、后序遍历，观察同一棵树在不同遍历规则下的访问顺序。",
        checkpoint="如果你能看着一棵树独立写出三种遍历结果，说明你对二叉树结构已经有了比较扎实的理解。",
        practice_basic="请用一句话说明二叉树和普通线性结构最大的区别。",
        practice_understanding="为什么很多二叉树问题会自然地想到递归？",
        practice_application="请画一棵只有 3 层的简单二叉树，并写出它的前序遍历结果。",
    ),
    KnowledgeCard(
        aliases=("函数极限", "极限"),
        definition="函数极限描述的是自变量逐渐靠近某个值时，函数值整体趋近于什么结果。",
        core_idea="极限关注的是变化趋势，而不是某一个点上的瞬时取值，所以函数值和极限值在某些题目里可以不同。",
        common_confusion="最容易混淆的是把“函数在该点的值”和“函数在该点的极限”混为一谈，这两者并不总是相等。",
        first_step="先用图像或简单代入例子理解“趋近”是什么意思，不急着一开始就背很多计算技巧。",
        next_step="再练习最基础的极限题，比如直接代入能求出的情形，建立对趋势和结果的直觉。",
        checkpoint="如果你能解释为什么某点没有函数值时仍然可能讨论极限，说明你已经抓住了极限的核心。",
        practice_basic="请用自己的话解释什么叫函数极限。",
        practice_understanding="为什么函数值和极限值可能不同？",
        practice_application="请求出函数 x+2 在 x 趋近于 3 时的极限，并说明原因。",
    ),
    KnowledgeCard(
        aliases=("牛顿第二定律", "newton second law", "f=ma"),
        definition="牛顿第二定律描述的是物体所受合力、质量和加速度之间的关系，通常写作 F=ma。",
        core_idea="核心不是死记公式，而是理解：合力越大，加速度越大；质量越大，在相同外力下越难被加速。",
        common_confusion="最容易混淆的是把力和速度直接对应起来，但牛顿第二定律真正描述的是力和加速度之间的关系。",
        first_step="先弄清楚 F、m、a 分别表示什么，再用自己的话解释它们三者之间的关系。",
        next_step="再做几道已知两个量求第三个量的基础题，逐步建立对数量关系的直觉。",
        checkpoint="如果你能解释“为什么质量越大越难被加速”，说明你已经不只是背住公式，而是在开始理解定律。",
        practice_basic="请写出牛顿第二定律的公式，并说明每个符号代表什么。",
        practice_understanding="为什么说牛顿第二定律描述的是力和加速度的关系，而不是力和速度的关系？",
        practice_application="一个质量为 2 kg 的物体受到 10 N 合力时，加速度是多少？请说明计算过程。",
    ),
)


def match_knowledge_card(topic: str) -> KnowledgeCard | None:
    normalized_topic = topic.strip().lower()
    if not normalized_topic:
        return None

    for card in KNOWLEDGE_CARDS:
        for alias in card.aliases:
            if normalized_topic == alias.lower():
                return card

    return None
