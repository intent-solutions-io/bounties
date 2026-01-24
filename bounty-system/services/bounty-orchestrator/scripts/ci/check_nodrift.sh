#!/bin/bash
# Intentional Bounty - Framework Drift Detection
# Enforces Hard Rules (L1-L6)
#
# L1: Use langgraph for agents (v1.0+)
# L2: Use langchain-google-vertexai for LLM
# L3: No direct API calls to LLM providers
# L4: CI-only deployments via GitHub Actions
# L5: Use langgraph-checkpoint-postgres in prod
# L6: Drift detection in CI

set -e
VIOLATIONS=0

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Navigate to the service root (two levels up from scripts/ci/)
SERVICE_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$SERVICE_DIR"

echo "Scanning for LangChain framework drift..."
echo "Working directory: $SERVICE_DIR"
echo ""

# L1: Must use langgraph for agents (not raw LLM calls)
echo "L1: Checking for raw LLM usage without LangGraph..."
if grep -rE "ChatVertexAI\(\)\.invoke\(|ChatGoogleGenerativeAI\(\)\.invoke\(" --include="*.py" bounty_agent/ 2>/dev/null | grep -v "test_"; then
    echo "VIOLATION L1: Raw LLM calls found. Use LangGraph nodes."
    VIOLATIONS=$((VIOLATIONS + 1))
else
    echo "L1: All LLM calls are in LangGraph nodes"
fi

# L3: No direct provider API calls
echo ""
echo "L3: Checking for direct provider API calls..."
if grep -rE "^import openai|^from openai|^import anthropic|^from anthropic|^from google\.generativeai" --include="*.py" bounty_agent/ 2>/dev/null; then
    echo "VIOLATION L3: Direct provider imports found. Use langchain abstractions."
    VIOLATIONS=$((VIOLATIONS + 1))
else
    echo "L3: Using LangChain abstractions only"
fi

# L5: No InMemorySaver in production code (except in get_checkpointer fallback)
echo ""
echo "L5: Checking for InMemorySaver in production..."
# Allow MemorySaver only in agent.py as fallback for development
INMEM_COUNT=$(grep -rE "InMemorySaver|from_conn_string\(\":memory:\"\)" --include="*.py" bounty_agent/ 2>/dev/null | grep -v "test_" | grep -v "agent.py" | wc -l)
if [ "$INMEM_COUNT" -gt 0 ]; then
    echo "VIOLATION L5: InMemorySaver found in production code"
    grep -rE "InMemorySaver|from_conn_string\(\":memory:\"\)" --include="*.py" bounty_agent/ 2>/dev/null | grep -v "test_" | grep -v "agent.py"
    VIOLATIONS=$((VIOLATIONS + 1))
else
    echo "L5: Using PostgresSaver for production"
fi

# Check for required dependencies in requirements.txt
echo ""
echo "Checking required dependencies..."
REQUIRED_DEPS=("langgraph" "langchain" "langchain-google-vertexai" "langgraph-checkpoint-postgres")
for dep in "${REQUIRED_DEPS[@]}"; do
    if ! grep -q "^$dep" requirements.txt 2>/dev/null; then
        echo "VIOLATION: Missing required dependency: $dep"
        VIOLATIONS=$((VIOLATIONS + 1))
    fi
done

# Summary
echo ""
echo "=========================================="
if [ $VIOLATIONS -gt 0 ]; then
    echo "Found $VIOLATIONS drift violation(s)"
    exit 1
fi
echo "No drift violations detected"
echo "=========================================="
