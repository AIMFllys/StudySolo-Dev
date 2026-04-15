from src.core.knowledge import match_knowledge_card
from src.core.types import GENERIC_TOPIC_FALLBACK, TutorPlan, UnderstandingResult


class TutorPlanBuilder:
    def build(self, understanding: UnderstandingResult) -> TutorPlan:
        knowledge_card = match_knowledge_card(understanding.topic)
        if knowledge_card is not None:
            return TutorPlan(
                topic=understanding.topic,
                focus=understanding.focus,
                definition=knowledge_card.definition,
                core_idea=knowledge_card.core_idea,
                common_confusion=self.build_knowledge_card_common_confusion(
                    understanding,
                    knowledge_card.common_confusion,
                ),
                first_step=knowledge_card.first_step,
                next_step=knowledge_card.next_step,
                checkpoint=knowledge_card.checkpoint,
                practice_basic=knowledge_card.practice_basic,
                practice_understanding=self.build_knowledge_card_practice_understanding(
                    understanding,
                    knowledge_card.practice_understanding,
                ),
                practice_application=knowledge_card.practice_application,
            )

        return TutorPlan(
            topic=understanding.topic,
            focus=understanding.focus,
            definition=self.build_generic_definition(understanding),
            core_idea=self.build_generic_core_idea(understanding),
            common_confusion=self.build_generic_common_confusion(understanding),
            first_step=self.build_generic_first_step(understanding),
            next_step=self.build_generic_next_step(understanding),
            checkpoint=self.build_generic_checkpoint(understanding),
            practice_basic=self.build_generic_practice_basic(understanding),
            practice_understanding=self.build_generic_practice_understanding(understanding),
            practice_application=self.build_generic_practice_application(understanding),
        )

    def topic_phrase(self, understanding: UnderstandingResult) -> str:
        if understanding.topic == GENERIC_TOPIC_FALLBACK:
            return "当前这个学习主题"
        return understanding.topic

    def related_topics_phrase(self, understanding: UnderstandingResult) -> str:
        if not understanding.related_topics:
            return ""
        return "、".join(understanding.related_topics)

    def build_knowledge_card_common_confusion(
        self,
        understanding: UnderstandingResult,
        base_text: str,
    ) -> str:
        if not understanding.related_topics:
            return base_text
        return (
            f"{base_text} 这次你还可以特别留意它和 {self.related_topics_phrase(understanding)} "
            "分别在解决什么问题、概念边界在哪里。"
        )

    def build_knowledge_card_practice_understanding(
        self,
        understanding: UnderstandingResult,
        base_text: str,
    ) -> str:
        if not understanding.related_topics:
            return base_text
        return (
            f"{base_text} 另外，请补充说明它和 {self.related_topics_phrase(understanding)} "
            "最容易被混在一起的点分别是什么。"
        )

    def build_generic_definition(self, understanding: UnderstandingResult) -> str:
        topic_phrase = self.topic_phrase(understanding)
        if understanding.user_intent == "review":
            return f"{topic_phrase} 是一个值得回到核心框架重新梳理的知识点，复习时要先抓住基本定义、主要组成部分和常见考法。"
        if understanding.user_intent == "clarify_confusion":
            return f"{topic_phrase} 是你当前理解还不够稳的知识点，先把它最基础的定义、适用范围和典型例子讲清楚会更容易继续学下去。"
        if understanding.user_intent == "learn_path":
            return f"{topic_phrase} 可以先从最基础的定义和使用场景入手，再逐步过渡到题型、方法或更深入的应用。"
        return f"{topic_phrase} 是当前需要优先建立基础理解的知识点，可以先从它的定义、作用和一个直观例子入手。"

    def build_generic_core_idea(self, understanding: UnderstandingResult) -> str:
        topic_phrase = self.topic_phrase(understanding)
        if understanding.user_intent == "review":
            return f"复习 {topic_phrase} 时，关键不是把零散知识重新背一遍，而是把核心框架、关键关系和高频重点重新连成一条线。"
        if understanding.user_intent == "clarify_confusion":
            return f"学习 {topic_phrase} 时，当前最重要的不是记住更多细节，而是先找到你真正卡住的核心概念，再把它和相近内容区分开。"
        if understanding.user_intent == "learn_path":
            return f"学习 {topic_phrase} 时，先建立基本概念，再过渡到常见方法或典型题目，会比一开始直接做难题更有效。"
        return f"学习 {topic_phrase} 时，重点不是机械记忆结论，而是先抓住它解决什么问题、为什么重要、通常怎么使用。"

    def build_generic_common_confusion(self, understanding: UnderstandingResult) -> str:
        topic_phrase = self.topic_phrase(understanding)
        related_topics_phrase = self.related_topics_phrase(understanding)
        if understanding.difficulty_state == "confused" and related_topics_phrase:
            return (
                f"你现在最需要注意的是，不要把 {topic_phrase} 和 {related_topics_phrase} 混成一团；"
                f"先分清 {topic_phrase} 自己的核心概念、使用条件，再看它和 {related_topics_phrase} 到底是同类知识、相关概念，还是只是容易一起出现。"
            )
        if understanding.difficulty_state == "confused":
            return f"你现在最需要注意的是，不要只记住 {topic_phrase} 的表面说法，而要分清它的核心概念、使用条件和最容易混淆的相近内容。"
        if understanding.user_intent == "review":
            return f"复习 {topic_phrase} 时，常见问题是只回忆零散知识点，却没有把它们重新放回整体框架里。"
        return f"初学者常见的问题是只记表面说法，却没有分清 {topic_phrase} 的核心概念、使用条件和容易混淆的相近内容。"

    def build_generic_first_step(self, understanding: UnderstandingResult) -> str:
        topic_phrase = self.topic_phrase(understanding)
        if understanding.user_intent == "review":
            return f"先快速列出你对 {topic_phrase} 还记得的 3 个关键词，看看哪些部分已经稳了，哪些部分开始模糊了。"
        if understanding.user_intent == "clarify_confusion":
            return f"先用自己的话说出你以为 {topic_phrase} 是什么，再把你最不确定的一点单独圈出来。"
        if understanding.user_intent == "learn_path":
            return f"先把 {topic_phrase} 拆成定义、核心方法和典型例子三部分，不要一开始就把范围铺得太大。"
        return f"先用自己的话说出你理解的 {topic_phrase} 是什么，不用追求标准答案，先确认你目前的理解起点。"

    def build_generic_next_step(self, understanding: UnderstandingResult) -> str:
        topic_phrase = self.topic_phrase(understanding)
        if understanding.user_intent == "review":
            return f"再把 {topic_phrase} 的核心框架、公式、结构或高频问题整理成一页简短笔记，帮助自己重新建立整体感。"
        if understanding.user_intent == "clarify_confusion":
            return f"再找一个最简单的例子，把 {topic_phrase} 的关键区别、核心关系或使用条件代进去看一遍。"
        if understanding.user_intent == "learn_path":
            return f"再按照“先基础、后方法、再练习”的顺序，为 {topic_phrase} 安排一个小范围学习节奏。"
        return f"再整理 {topic_phrase} 的 2 到 3 个关键词、公式、结构或典型例子，形成一版自己的学习提纲。"

    def build_generic_checkpoint(self, understanding: UnderstandingResult) -> str:
        topic_phrase = self.topic_phrase(understanding)
        if understanding.user_intent == "review":
            return f"如果你能不看资料讲清 {topic_phrase} 的核心框架，并说出一个典型应用或题型，说明这次复习已经有抓手了。"
        if understanding.user_intent == "clarify_confusion":
            return f"如果你能解释 {topic_phrase} 为什么容易混淆，并且能说出它和相近内容的关键区别，说明理解开始变清楚了。"
        if understanding.user_intent == "learn_path":
            return f"如果你能说清楚学习 {topic_phrase} 时先学什么、后学什么，并独立完成一道基础题，说明学习路径已经立住了。"
        return f"如果你能不看资料解释 {topic_phrase} 的核心意思，并举出一个简单例子，说明基础已经开始稳住了。"

    def build_generic_practice_basic(self, understanding: UnderstandingResult) -> str:
        topic_phrase = self.topic_phrase(understanding)
        if understanding.user_intent == "review":
            return f"请用一句话回顾 {topic_phrase} 的基本定义或最核心结论。"
        return f"请用一句话概括 {topic_phrase} 的基本定义。"

    def build_generic_practice_understanding(self, understanding: UnderstandingResult) -> str:
        topic_phrase = self.topic_phrase(understanding)
        related_topics_phrase = self.related_topics_phrase(understanding)
        if understanding.user_intent == "clarify_confusion" and related_topics_phrase:
            return f"请说明 {topic_phrase} 和 {related_topics_phrase} 最容易被混淆的地方分别是什么，以及两者真正的关键区别在哪里。"
        if understanding.user_intent == "clarify_confusion":
            return f"请说明 {topic_phrase} 最容易和什么内容混淆，以及两者真正的关键区别在哪里。"
        if understanding.user_intent == "review":
            return f"请说出复习 {topic_phrase} 时你最担心遗忘的一点，并说明为什么它重要。"
        return f"请说明学习 {topic_phrase} 时最容易混淆的一点，以及为什么会混淆。"

    def build_generic_practice_application(self, understanding: UnderstandingResult) -> str:
        topic_phrase = self.topic_phrase(understanding)
        if understanding.user_intent == "learn_path":
            return f"请为 {topic_phrase} 设计一个 3 步入门学习顺序，并说明每一步的目标。"
        return f"请结合一个简单场景，尝试说明 {topic_phrase} 可以怎样使用，或怎样判断你是否真正理解了它。"
