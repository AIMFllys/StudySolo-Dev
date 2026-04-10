"""Final Phase 2 boot verification — all tasks."""
import sys
try:
    # 1. Main router loads
    from app.api.router import router
    print("Main router: %d routes" % len(router.routes))

    # 2. New LLM package
    from app.services.llm import call_llm, call_llm_direct, AIRouterError, LLMCallResult
    print("services/llm package OK")

    # 3. Backward compat shims
    from app.services.ai_router import call_llm as call_llm2, AIRouterError as E2
    print("ai_router shim OK")
    from app.services.llm_caller import LLMCallResult as R2, LLMStreamResult
    print("llm_caller shim OK")
    from app.services.llm_provider import get_client, AIRouterError as E3
    print("llm_provider shim OK")

    # 4. AI + Workflow packages
    from app.api.ai import router as ai_r
    from app.api.workflow import router as wf_r
    print("AI(%d) + Workflow(%d) routes" % (len(ai_r.routes), len(wf_r.routes)))

    # 5. Usage tracker
    from app.services.usage_tracker import track_usage
    print("usage_tracker OK")

    # 6. Services/ai_chat
    from app.services.ai_chat.helpers import extract_json_obj
    from app.services.ai_chat.model_caller import call_with_model
    print("ai_chat services OK")

    print("\nPhase 2 FULL VERIFICATION PASSED!")
except Exception as e:
    print("FAILED: %s" % e)
    import traceback
    traceback.print_exc()
    sys.exit(1)
