# Contributing

Contributions are welcome. This file shows how to set up the project and how to send a change.

## Before you start

- To ask a question, use [Q&A in Discussions](https://github.com/open-trading-bot/open-trading-bot/discussions/categories/q-a). The discussions are in the repository of the bot.
- Before you start a large change, open an issue to discuss it.
- Do not report security vulnerabilities in public issues. Read [SECURITY.md](SECURITY.md).

## Set up the project

Requirements: Node.js 20 or later, npm.

```bash
git clone https://github.com/open-trading-bot/strategies.git
cd strategies
npm install
```

## Check your change

Run these commands from the repository root. CI runs the same commands on each pull request, on Node.js 22.

```bash
npm run typecheck
npm test
npm run build
```

## Rules for trading code

A mistake in trading code can cause a financial loss. Apply these rules to the strategies and the backtester.

- Add a test for each change in behavior.
- Use closed candles only. A strategy must ignore the candle that is still open.
- Do not change a default fee, slippage or strategy value without a reason in the pull request.
- Do not write that a strategy gives a profit. If you show a result, write the market, the period and the costs.

## Send a pull request

All changes to `main` go through a pull request. CI must pass before the merge.

1. Make a branch from `main`.
2. Make one change. Keep the pull request small.
3. Write the commit message as a command. Example: `Add a test for the RSI strategy`.
4. Update the README if the change affects the API or the behavior.
5. Open the pull request and complete the checklist.

Write documentation in short, simple sentences. Use one instruction in each sentence. The project follows the [ASD-STE100](https://www.asd-ste100.org) style.

## Code of conduct

Read the [code of conduct](CODE_OF_CONDUCT.md). It applies to all project spaces.

## License

You agree that your contribution uses the [MIT license](LICENSE) of this project.
