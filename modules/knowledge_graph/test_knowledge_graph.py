import unittest
import os
import sys

# Ensure project root is in python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.app.database import Base
from modules.knowledge_graph.models import GraphNode, GraphEdge
from modules.knowledge_graph.entity_extractor import EntityExtractor
from modules.knowledge_graph.relationship_builder import RelationshipBuilder
from modules.knowledge_graph.graph_manager import GraphManager
from modules.knowledge_graph.graph_query_engine import GraphQueryEngine

class TestKnowledgeGraph(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Setup in-memory SQLite for isolated database testing
        cls.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(cls.engine)
        cls.SessionLocal = sessionmaker(bind=cls.engine)

    def setUp(self):
        self.db = self.SessionLocal()
        self.extractor = EntityExtractor()
        self.builder = RelationshipBuilder()
        self.manager = GraphManager()
        self.query_engine = GraphQueryEngine()

    def tearDown(self):
        # Clean up database records
        self.db.query(GraphEdge).delete()
        self.db.query(GraphNode).delete()
        self.db.commit()
        self.db.close()

    def test_entity_extraction(self):
        print("\n--- 1. Testing Entity Extraction from Text ---")
        text = "John Smith works at Acme Corp. He submitted invoice INV-500 yesterday."
        entities = self.extractor.extract_from_text(text)
        
        entity_types = [e["entity_type"] for e in entities]
        entity_names = [e["name"] for e in entities]

        self.assertIn("person", entity_types)
        self.assertIn("company", entity_types)
        self.assertIn("invoice", entity_types)
        self.assertIn("John Smith", entity_names)
        self.assertIn("Acme Corp", entity_names)
        self.assertIn("INV-500", entity_names)
        print("✔ Entities extracted correctly from text.")

    def test_relationship_discovery(self):
        print("\n--- 2. Testing Relationship Builder ---")
        entities = [
            {"entity_type": "person", "name": "John Smith"},
            {"entity_type": "company", "name": "Acme Corp"},
            {"entity_type": "invoice", "name": "INV-500"}
        ]
        
        # Test basic text relationships
        relationships = self.builder.build_text_relationships(entities, "Contract.pdf")
        rel_types = [r["relationship_type"] for r in relationships]
        
        self.assertIn("works_for", rel_types)
        self.assertIn("submitted", rel_types)
        self.assertIn("belongs_to", rel_types)
        print("✔ Relationships formed correctly.")

    def test_graph_manager_persistence(self):
        print("\n--- 3. Testing Graph Storage Persistence ---")
        entities = [
            {"entity_type": "person", "name": "John Smith"},
            {"entity_type": "company", "name": "Acme Corp"}
        ]
        relationships = [
            {
                "source_type": "person", "source_name": "John Smith",
                "target_type": "company", "target_name": "Acme Corp",
                "relationship_type": "works_for"
            }
        ]

        nodes, edges = self.manager.add_entities_and_relationships(self.db, entities, relationships)
        
        self.assertEqual(len(nodes), 2)
        self.assertEqual(len(edges), 1)
        self.assertEqual(edges[0].relationship_type, "works_for")
        print("✔ Graph entities persisted correctly to tables.")

    def test_graph_traversal_and_impact(self):
        print("\n--- 4. Testing Traversals and Impact Analysis ---")
        # Seed nodes
        n_john = self.manager.get_or_create_node(self.db, "person", "John Smith")
        n_company = self.manager.get_or_create_node(self.db, "company", "Acme Corp")
        n_invoice = self.manager.get_or_create_node(self.db, "invoice", "INV-500")

        self.manager.add_relationship(self.db, n_john, n_company, "works_for")
        self.manager.add_relationship(self.db, n_john, n_invoice, "submitted")

        # Test BFS traversal from John
        traverse_result = self.query_engine.traverse_from_node(self.db, str(n_john.id), max_depth=1)
        self.assertEqual(len(traverse_result["nodes"]), 3)
        self.assertEqual(len(traverse_result["edges"]), 2)

        # Test Impact Analysis
        impact_result = self.query_engine.run_impact_analysis(self.db, "John Smith", "person")
        self.assertEqual(len(impact_result["impacted_nodes"]), 2) # Acme Corp, INV-500
        print("✔ BFS traversal & impact analysis resolved accurately.")

    def test_rag_context_expansion(self):
        print("\n--- 5. Testing Graph-Enhanced RAG Helper ---")
        n_john = self.manager.get_or_create_node(self.db, "person", "John Smith")
        n_company = self.manager.get_or_create_node(self.db, "company", "Acme Corp")
        self.manager.add_relationship(self.db, n_john, n_company, "works_for")

        context = self.query_engine.find_relationships_context(self.db, "Tell me about John Smith")
        self.assertIn("John Smith", context)
        self.assertIn("Acme Corp", context)
        self.assertIn("works_for", context)
        print("✔ RAG Context expansion constructed correctly.")

if __name__ == "__main__":
    unittest.main()
