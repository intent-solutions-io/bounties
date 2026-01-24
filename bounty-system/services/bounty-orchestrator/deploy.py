#!/usr/bin/env python3
"""Deploy bounty orchestrator to Vertex AI Agent Engine.

This script deploys the LangGraph bounty workflow to Vertex AI Agent Engine,
which provides managed hosting for LangGraph agents.
"""

import os

from google.cloud import aiplatform


def deploy():
    """Deploy the bounty orchestrator to Agent Engine."""
    project_id = os.environ.get("GOOGLE_CLOUD_PROJECT", "intentional-bounty")
    location = os.environ.get("GOOGLE_CLOUD_REGION", "us-central1")

    print(f"Deploying to project: {project_id}, location: {location}")

    # Initialize Vertex AI
    aiplatform.init(
        project=project_id,
        location=location,
    )

    # Note: vertexai.agent_engines is still in preview
    # For now, we'll deploy as a Cloud Run service
    # When Agent Engine GA's, use:
    #
    # from vertexai import agent_engines
    # remote_agent = agent_engines.create(
    #     config={
    #         "agent_framework": "langgraph",
    #         "source_packages": ["./bounty_agent"],
    #         "entrypoint_module": "bounty_agent.agent",
    #         "entrypoint_object": "graph",
    #         "requirements_file": "./requirements.txt",
    #         "display_name": "bounty-orchestrator",
    #         "description": "LangGraph bounty workflow - sends prompts to Bob's Brain",
    #         "env_vars": {
    #             "BOBS_BRAIN_A2A_URL": os.environ.get("BOBS_BRAIN_A2A_URL", ""),
    #         },
    #     }
    # )

    print("Agent Engine deployment configured.")
    print("")
    print("To deploy as Cloud Run service (current approach):")
    print(f"  gcloud run deploy bounty-orchestrator \\")
    print(f"    --source . \\")
    print(f"    --project {project_id} \\")
    print(f"    --region {location} \\")
    print(f"    --allow-unauthenticated")
    print("")
    print("When Agent Engine GA's, this script will use vertexai.agent_engines.create()")


if __name__ == "__main__":
    deploy()
