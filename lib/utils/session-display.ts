export function getTemperatureQuantity(value: number): string {
  if (value < 0.45) return 'Focused'
  if (value < 1.05) return 'Balanced'
  return 'Expressive'
}

export function getMaxTokensQuantity(value: number): string {
  if (value <= 1024) return 'Brief'
  if (value <= 2048) return 'Standard'
  return 'Extended'
}

export function getTopPQuantity(value: number): string {
  if (value <= 0.45) return 'Tight'
  if (value <= 0.8) return 'Balanced'
  return 'Wide'
}
