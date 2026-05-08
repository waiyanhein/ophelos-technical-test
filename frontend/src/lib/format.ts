const gbp = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  maximumFractionDigits: 0,
})

export const formatCurrency = (amount: number) => gbp.format(amount)

export const formatSignedCurrency = (amount: number) =>
  amount >= 0 ? `+${gbp.format(amount)}` : `-${gbp.format(Math.abs(amount))}`
