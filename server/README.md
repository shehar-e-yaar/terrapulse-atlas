# Optional live model

The default copilot needs no model or API key. It runs deterministic filters and map actions. `VITE_AGENT_ENDPOINT` optionally adds a separate model summary **after** the factual local answer. A model cannot execute code, supply coordinates, or override map actions.

Deploy `bedrock_handler.py` as a Python Lambda handler `bedrock_handler.handler`, with an execution role permitting `bedrock:InvokeModel` only for your chosen model. Set `BEDROCK_MODEL_ID` to an available Converse-compatible model or inference profile and `ALLOWED_ORIGIN` to the frontend origin. Put it behind API Gateway with authentication, request size limits, throttling and a billing budget; configure the frontend proxy to provide your application's authentication. Do not expose an unrestricted paid endpoint.

Contract: POST `{ "question": "...", "records": [Place] }`; response `{ "summary": "...", "provider": "Amazon Bedrock" }`. An OpenAI-compatible or Gemini backend can implement the same contract with server-side credentials. The supplied Lambda is a Bedrock implementation, not a deployed service. Provider secrets never belong in `VITE_` variables.

The UI renders summaries as text and labels them as model-generated. It retains its deterministic answer, citations and fallback if the endpoint fails. No model endpoint was deployed during this build.
