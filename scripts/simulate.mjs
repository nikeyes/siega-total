// Prints the economy simulation of scripts/economy.ts: one table for a player who never shops and one who always buys the cheapest upgrade.
import { createServer } from 'vite';

const LAST_LEVEL = Number(process.argv[2] ?? 50);

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { simulateCampaign } = await server.ssrLoadModule('/scripts/economy.ts');
  for (const [title, buys] of [['Sin comprar mejoras', false], ['Comprando la mejora más barata', true]]) {
    const reports = simulateCampaign(LAST_LEVEL, buys);
    console.log(`\n${title}`);
    console.table(
      reports.map((report) => ({
        nivel: report.level,
        intentos: report.attempts,
        ganado: report.won ? 'sí' : 'NO',
        tiempo: report.levelSeconds,
        sobra: report.secondsLeft,
        'monedas hierba': report.cutCoins,
        bonus: report.bonusCoins,
        saldo: report.balance,
        tamaño: report.finalSize,
        compras: report.upgradesBought.join(' '),
      })),
    );
  }
} finally {
  await server.close();
}
