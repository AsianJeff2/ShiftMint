export function groupTipsByBusinessDay(tips: { timestamp: Date | number; amount: number }[], timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  const groups = new Map<string, { date: string; count: number; total: number }>();
  for (const tip of tips) {
    const parts = formatter.formatToParts(new Date(tip.timestamp));
    const part = (type: string) => parts.find(part => part.type === type)!.value;
    const date = `${part('year')}-${part('month')}-${part('day')}`;
    const group = groups.get(date) || { date, count: 0, total: 0 };
    group.count++; group.total += tip.amount; groups.set(date, group);
  }
  return [...groups.values()].map(group => ({ ...group, total: Math.round(group.total * 100) / 100 })).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);
}
