# NVIDIA Nemotron Model Verification Log

Date of Verification: 2026-10-30
Provider: NVIDIA Hosted API (`https://integrate.api.nvidia.com/v1`)
Authentication: A locally configured NVIDIA key was used for live checks; credentials are not stored in this report.

## Live Verification Results (`scripts/smoke_nemotron.py`)

| Role | Configured Model ID | Latency (ms) | Live Result | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **MODEL_PLANNER** | `nvidia/nemotron-3.5-super-vl-120b-a12b` | **517 ms** | **PASS** | Primary model for chat, 3D scene generation, reasoning, and planning. `enable_thinking: false` supported. |
| **MODEL_FAST** | `nvidia/nemotron-3.5-lightning-30b-a3b` | **11,558 ms** | **PASS** | Fast classifier, intent detection, memory importance gating, emergency non-JSON planner. |
| **MODEL_TINY** | `nvidia/nemotron-3.5-bolt-e4b` | **238 ms** | **PASS** | Ultra-low latency classification and quick responses. |
| **MODEL_EMBED** | `nvidia/nemotron-3.5-embed-1b` | **418 ms** | **PASS** | Asymmetric embedding model; requires `input_type` ("query" vs "passage"). Returns **2048-dimensional** dense vectors. |
| **MODEL_FALLBACK** | `nvidia/nemotron-3-super-120b-a12b` | **54 ms** | **FAIL (404 Not Found)** | Early-access model was not provisioned on the tested account. Non-JSON tasks advance to `MODEL_FAST`; structured tasks report temporary unavailability. |

## Technical Implementation Observations

1. **Thinking Control (`chat_template_kwargs`)**:
   - Sending `extra_body` as a raw dictionary over raw HTTP results in `Validation: Unsupported parameter(s): extra_body (400 Bad Request)`.
   - Passing `chat_template_kwargs: {"enable_thinking": False}` directly at the top level of the JSON body is required and turns off reasoning instantly.
   - When thinking is disabled, generation latency on `nemotron-3.5-super-vl-120b-a12b` drops to ~500 ms with direct text generation.
2. **Streaming Delta Separation**:
   - Streaming SSE deltas from Nemotron models transmit `delta.reasoning_content` separately from `delta.content`.
   - This allows ORBIT to forward `reasoning_delta` exclusively to the transparent debug trace while streaming visible `token` deltas to the learner UI.
3. **Embeddings & Asymmetry**:
   - `nemotron-3.5-embed-1b` requires the `input_type` parameter (`"query"` or `"passage"`). Omitting it returns HTTP 400 (`'input_type' parameter is required for asymmetric models`).
   - Dimension is 2048. All ORBIT vector tables and distance calculations are synchronized to 2048 dimensions.

