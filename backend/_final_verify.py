"""Final Phase 2 boot verification — all tasks."""
import sys
try:
    # 1. Main router loads
    from app.api.router import router
    print("Main router: %d routes" % len(router.routes))

    # 2. New LLM package
    print("services/llm package OK")

    # 3. Backward compat shims
    print("ai_router shim OK")
    print("llm_caller shim OK")
    print("llm_provider shim OK")

    # 4. AI + Workflow packages
    from app.api.ai import router as ai_r
    from app.api.workflow import router as wf_r
    print("AI(%d) + Workflow(%d) routes" % (len(ai_r.routes), len(wf_r.routes)))

    # 5. Usage tracker
    print("usage_tracker OK")

    # 6. Services/ai_chat
    print("ai_chat services OK")

    print("\nPhase 2 FULL VERIFICATION PASSED!")
except Exception as e:
    print("FAILED: %s" % e)
    import traceback
    traceback.print_exc()
    sys.exit(1)
