// Indian Rupee + Indian numbering helpers
export function formatINR(amount, { decimals = 0 } = {}) {
  const n = Number(amount || 0);
  return "₹" + n.toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatINRShort(amount) {
  const n = Number(amount || 0);
  if (n >= 10000000) return "₹" + (n / 10000000).toFixed(2) + " Cr";
  if (n >= 100000) return "₹" + (n / 100000).toFixed(2) + " L";
  return formatINR(n);
}
