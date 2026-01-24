"""Analyze bounty node - asks Bob to analyze the opportunity."""

from ..state import BountyState
from ..bobs_brain_client import bob
from ..prompts.analyze import ANALYZE_PROMPT


async def analyze_bounty(state: BountyState) -> BountyState:
    """Ask Bob to analyze the bounty opportunity.

    This node generates an analysis prompt with repo-specific knowledge
    and sends it to Bob's Brain for execution.
    """
    # Format the analysis prompt
    prompt = ANALYZE_PROMPT.format(
        issue_url=state["issue_url"],
        repo=state["repo"],
    )

    # If we have repo knowledge, add it to context
    context = {"bounty_id": state["bounty_id"]}
    if state.get("repo_profile"):
        context["repo_profile"] = state["repo_profile"]

    # Ask Bob to analyze
    result = await bob.ask_bob(
        prompt=prompt,
        context=context,
        session_id=state["session_id"],
    )

    # Update state with analysis results
    return {
        **state,
        "issue_details": result.get("response", {}),
        "phase": "B",  # Move to Issue Analysis phase
    }
