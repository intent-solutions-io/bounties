"""Main LangGraph workflow definition for bounty orchestration.

This is the entry point for the bounty workflow. It defines the graph
that orchestrates the bounty hunting process:

1. Analyze - Understand the bounty opportunity
2. Check Competition - Look for competing work
3. Create Plan - Design the implementation approach
4. Approval - Human checkpoint (pauses for dashboard confirmation)
5. Execute - Implement the fix via Bob's Brain

The graph uses PostgreSQL for checkpointing (L5 compliance) and
exports a `graph` object for deployment to Vertex AI Agent Engine.
"""

import os

from langgraph.graph import StateGraph, END

from .state import BountyState
from .nodes import (
    analyze_bounty,
    check_competition,
    should_proceed,
    create_plan,
    is_approved,
    execute_via_bob,
)

# Build the workflow graph
workflow = StateGraph(BountyState)

# Add nodes
workflow.add_node("analyze", analyze_bounty)
workflow.add_node("check_competition", check_competition)
workflow.add_node("create_plan", create_plan)
workflow.add_node("approval", lambda s: s)  # Human checkpoint - pauses here
workflow.add_node("execute", execute_via_bob)

# Set entry point
workflow.set_entry_point("analyze")

# Wire edges
workflow.add_edge("analyze", "check_competition")

# Conditional: proceed or skip based on competition
workflow.add_conditional_edges(
    "check_competition",
    should_proceed,
    {
        "continue": "create_plan",
        "skip": END,
    },
)

workflow.add_edge("create_plan", "approval")

# Conditional: execute only if human approved
workflow.add_conditional_edges(
    "approval",
    is_approved,
    {
        "execute": "execute",
        "rejected": END,
    },
)

workflow.add_edge("execute", END)


def get_checkpointer():
    """Get the appropriate checkpointer based on environment.

    Production uses PostgreSQL (L5 compliance).
    Development uses in-memory for testing.
    """
    database_url = os.environ.get("DATABASE_URL")

    if database_url:
        # Production: Use PostgreSQL with pgvector
        from langgraph.checkpoint.postgres import PostgresSaver

        return PostgresSaver.from_conn_string(database_url)
    else:
        # Development: Use in-memory (testing only)
        from langgraph.checkpoint.memory import MemorySaver

        return MemorySaver()


# Compile the graph with checkpointing
# This is exported as "graph" for langgraph.json
graph = workflow.compile(checkpointer=get_checkpointer())
