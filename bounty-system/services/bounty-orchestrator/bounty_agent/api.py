"""FastAPI endpoints for dashboard integration.

This module provides REST endpoints for the dashboard to:
- Start bounty workflows
- Check workflow status
- Approve execution
- List repos and bounties
- Search learnings
"""

import os
import uuid
from typing import Optional

from fastapi import FastAPI, BackgroundTasks, HTTPException
from pydantic import BaseModel

from .agent import graph
from .state import BountyState
from .knowledge import sync_repo_knowledge

# FastAPI app
app = FastAPI(
    title="Bounty Orchestrator API",
    description="LangGraph-based bounty workflow orchestration",
    version="1.0.0",
)


# Request/Response models
class StartWorkflowRequest(BaseModel):
    """Request to start a bounty workflow."""

    bounty_id: str
    issue_url: str
    repo: str


class StartWorkflowResponse(BaseModel):
    """Response from starting a workflow."""

    status: str
    bounty_id: str
    session_id: str


class WorkflowStatus(BaseModel):
    """Current workflow status."""

    bounty_id: str
    current_node: Optional[str]
    phase: str
    human_approved: bool
    state: dict


class ApproveResponse(BaseModel):
    """Response from approval."""

    status: str
    bounty_id: str


# Store instance (initialized lazily)
_store = None


def get_store():
    """Get or create the LangGraph Store instance."""
    global _store
    if _store is None:
        database_url = os.environ.get("DATABASE_URL")
        if database_url:
            from langgraph.store.postgres import PostgresStore

            _store = PostgresStore.from_conn_string(database_url)
        else:
            # For development, use an in-memory mock
            _store = {}
    return _store


# Endpoints
@app.post("/api/bounty/start", response_model=StartWorkflowResponse)
async def start_bounty_workflow(
    request: StartWorkflowRequest,
    background_tasks: BackgroundTasks,
):
    """Start bounty analysis and planning workflow.

    This kicks off the LangGraph workflow which will:
    1. Analyze the bounty opportunity
    2. Check for competition
    3. Create an implementation plan
    4. Pause at approval checkpoint

    The workflow runs in the background. Use /status to check progress.
    """
    session_id = f"bounty-{request.bounty_id}-{uuid.uuid4().hex[:8]}"

    # Generate repo_id from URL
    repo_id = (
        request.repo.replace("/", "_").replace(":", "_").replace("https___", "")
    )

    initial_state: BountyState = {
        "bounty_id": request.bounty_id,
        "issue_url": request.issue_url,
        "repo": request.repo,
        "repo_id": repo_id,
        "issue_details": {},
        "competition_analysis": {},
        "implementation_plan": {},
        "phase": "A",
        "human_approved": False,
        "execution_result": {},
        "session_id": session_id,
        "repo_profile": None,
    }

    # Run workflow in background
    config = {"configurable": {"thread_id": request.bounty_id}}
    background_tasks.add_task(graph.ainvoke, initial_state, config)

    return StartWorkflowResponse(
        status="analyzing",
        bounty_id=request.bounty_id,
        session_id=session_id,
    )


@app.get("/api/bounty/{bounty_id}/status", response_model=WorkflowStatus)
async def get_bounty_status(bounty_id: str):
    """Get current workflow state for a bounty.

    Returns the current node, phase, and full state.
    """
    config = {"configurable": {"thread_id": bounty_id}}

    try:
        state = graph.get_state(config)
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Bounty not found: {e}")

    current_node = state.next[0] if state.next else "complete"
    values = state.values or {}

    return WorkflowStatus(
        bounty_id=bounty_id,
        current_node=current_node,
        phase=values.get("phase", "unknown"),
        human_approved=values.get("human_approved", False),
        state=values,
    )


@app.post("/api/bounty/{bounty_id}/approve", response_model=ApproveResponse)
async def approve_execution(bounty_id: str, background_tasks: BackgroundTasks):
    """Human approves - resume workflow to execute.

    This sets human_approved=True and resumes the workflow,
    which will then proceed to the execute node.
    """
    config = {"configurable": {"thread_id": bounty_id}}

    try:
        # Update state to mark as approved
        graph.update_state(config, {"human_approved": True, "phase": "D"})

        # Resume workflow in background
        background_tasks.add_task(graph.ainvoke, None, config)

        return ApproveResponse(status="executing", bounty_id=bounty_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Approval failed: {e}")


@app.post("/api/bounty/{bounty_id}/reject", response_model=ApproveResponse)
async def reject_execution(bounty_id: str):
    """Human rejects - end workflow without executing.

    This marks the bounty as rejected and ends the workflow.
    """
    config = {"configurable": {"thread_id": bounty_id}}

    try:
        graph.update_state(
            config, {"human_approved": False, "phase": "F", "outcome": "rejected"}
        )
        return ApproveResponse(status="rejected", bounty_id=bounty_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Rejection failed: {e}")


@app.get("/api/repos")
async def list_repos():
    """List all tracked repos with summaries."""
    store = get_store()

    # If using mock store, return empty
    if isinstance(store, dict):
        return []

    try:
        repos = await store.alist(namespace=("repos",))
        return [
            {
                "id": r.key,
                "summary": r.value.get("quick_summary", []),
                "url": r.value.get("url", ""),
                "links": r.value.get("links", {}),
            }
            for r in repos
        ]
    except Exception:
        return []


@app.get("/api/repos/{repo_id}")
async def get_repo_detail(repo_id: str):
    """Get full repo profile for deep dive."""
    store = get_store()

    if isinstance(store, dict):
        raise HTTPException(status_code=404, detail="Store not configured")

    try:
        profile = await store.aget(("repos", repo_id), "profile")
        if not profile:
            raise HTTPException(status_code=404, detail="Repo not found")
        return profile
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/repos/sync")
async def sync_repo(repo_url: str, background_tasks: BackgroundTasks):
    """Sync knowledge for a repository.

    This fetches CONTRIBUTING.md, analyzes style, and stores the profile.
    """
    store = get_store()

    if isinstance(store, dict):
        raise HTTPException(status_code=503, detail="Store not configured")

    background_tasks.add_task(sync_repo_knowledge, repo_url, store)

    return {"status": "syncing", "repo_url": repo_url}


@app.get("/api/bounties")
async def list_bounties():
    """List all bounties with current phase."""
    store = get_store()

    if isinstance(store, dict):
        return []

    try:
        bounties = await store.alist(namespace=("bounties",))
        return [
            {
                "id": b.key,
                "issue_summary": b.value.get("issue_summary", ""),
                "phase": b.value.get("phase", ""),
                "repo_id": b.value.get("repo_id", ""),
                "outcome": b.value.get("outcome"),
            }
            for b in bounties
        ]
    except Exception:
        return []


@app.get("/api/learnings")
async def search_learnings(query: str = "", limit: int = 10):
    """Semantic search over past learnings."""
    store = get_store()

    if isinstance(store, dict):
        return []

    try:
        results = await store.asearch(
            namespace=("learnings",),
            query=query,
            limit=limit,
        )
        return results
    except Exception:
        return []


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "bounty-orchestrator"}
