# ARFA Generator

Documentation: https://dkazakov8.github.io/arfa-generator/  
LLM documentation: https://github.com/dkazakov8/arfa-generator/blob/master/llms.md  
npm: https://www.npmjs.com/package/@arfa-tools/generator

The infrastructure core of a development workflow for automating project architecture.

**ARFA Generator** automates repetitive work in frontend projects. It coordinates file generation, architectural checks,
and quality tools, with hooks for integrating bundlers, LLM agents, and other tools into the same pipeline.

Built-in plugins and checkers cover:

- Barrel files and component entry points
- Component and feature scaffolding
- Module aggregation and routing maps
- Validation schemas from TypeScript contracts
- Translation extraction and synchronization
- Import boundaries and environment variable consistency
- External tools for type checking, formatting, and testing

Custom plugins and checkers let you adapt the pipeline to your project. Run it once or watch for changes, with unified
reports for developers and LLM agents.

Created for **Automation Ready Frontend Architecture**, it also works with other architectural approaches.

## License

MIT
