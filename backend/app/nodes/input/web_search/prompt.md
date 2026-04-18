# 联网搜索节点 (web_search)

## 节点性质
- 类别: 输入源 (INPUT_SOURCE)
- LLM 调用: 否（非 LLM 节点）
- 模型选择: 不可手动选择，内置双引擎

## 搜索引擎
本节点同时调用两个**专用搜索 API**（均非 chat.completions 代理）：

1. **Zhipu Web Search Pro** (`POST /api/paas/v4/web_search`)
   - `search_engine=search_pro`
   - 结构化返回 `search_result[]`（title/link/content/refer/media/publish_date）

2. **Qiniu 全网搜索（百度 Search API）** (`POST /v1/search/web`)
   - 结构化返回 `data.results[]`（title/url/content/date/source/authority_score）

## 权威评分
- 白名单加分：baike.baidu.com / cnki.net / gov.cn / wikipedia.org / arxiv.org / 官方文档…
- 硬过滤：baijiahao / sohu / toutiao / jianshu / blog.csdn.net 等自媒体

## 降级契约 (fallback contract)
当**两个引擎都失败**或都无结构化结果时：
- `NodeOutput.metadata.degraded = True`
- `NodeOutput.metadata.fallback_instruction` 附带给下游 LLM 的降级提示词
- `NodeOutput.metadata.original_query` 原始用户问题
- 下游 LLM 节点自动感知并切换到"用自身知识回答 + 明确标注未联网"模式

## 数据流
- 输入: 上游（trigger_input 等）传入的用户问题，节点 label 仅作辅助
- 输出: 合并、去重、按权威分排序的 Markdown 搜索结果
- 下游: content_extract、summary、flashcard 等生成节点
