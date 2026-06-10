import os

files_to_fix = [
    "modules/ai_copilot/intent_parser.py",
    "modules/ai_copilot/response_generator.py",
    "modules/ai_research_engine/insight_synthesizer.py",
    "modules/ai_research_engine/models.py",
    "modules/ai_research_engine/research_planner.py",
    "modules/ai_research_engine/router.py",
    "modules/ai_research_engine/test_ai_research.py",
    "modules/auth_system/jwt_service.py",
    "modules/dashboard_aggregator/system_summary.py",
    "modules/enterprise_search/hybrid_search.py",
    "modules/enterprise_search/models.py",
    "modules/enterprise_search/router.py",
    "modules/enterprise_search/search_engine.py",
    "modules/enterprise_search/test_enterprise_search.py",
    "modules/knowledge_graph/graph_embeddings.py",
    "modules/knowledge_graph/models.py",
    "modules/knowledge_graph/router.py",
    "modules/knowledge_graph/test_knowledge_graph.py",
    "modules/notification_hub/template_engine.py"
]

root_dir = "/Users/shishirlamichhane/Documents/Projects/AI DOCUMENT INGESTION SYSTEM"

for rel_path in files_to_fix:
    abs_path = os.path.join(root_dir, rel_path)
    if os.path.exists(abs_path):
        with open(abs_path, "r", encoding="utf-8") as f:
            content = f.read()
        
        # Replace backend.app with app
        new_content = content.replace("backend.app", "app")
        
        if content != new_content:
            with open(abs_path, "w", encoding="utf-8") as f:
                f.write(new_content)
            print(f"Fixed imports in: {rel_path}")
        else:
            print(f"No changes needed in: {rel_path}")
    else:
        print(f"File not found: {rel_path}")
