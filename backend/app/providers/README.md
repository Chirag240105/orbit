# providers
`ChatProvider` interface (`complete`, `stream`), the Nebius Token Factory provider (OpenAI-compatible, strips reasoning blocks, maps provider errors to generic codes), and the demo and unconfigured providers. Add a provider: subclass, then register it in `build_provider`.
