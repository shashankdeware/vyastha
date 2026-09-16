ONES = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen",
]
TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]


def under_thousand(n: int) -> str:
    parts = []
    if n >= 100:
        parts += [ONES[n // 100], "Hundred"]
        n %= 100
    if n >= 20:
        parts.append(TENS[n // 10])
        n %= 10
    if n:
        parts.append(ONES[n])
    return " ".join(parts)


def number_words(n: int) -> str:
    if n == 0:
        return "Zero"
    parts = []
    for divisor, label in [(10**7, "Crore"), (10**5, "Lakh"), (1000, "Thousand")]:
        q, n = divmod(n, divisor)
        if q:
            parts.append(under_thousand(q) + " " + label)
    if n:
        parts.append(under_thousand(n))
    return " ".join(parts)


def amount_in_words(amount) -> str:
    from decimal import Decimal, ROUND_HALF_UP
    x = Decimal(str(amount)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    rupees = int(x)
    paise = int((x - rupees) * 100)
    result = f"Rupees {number_words(rupees)}"
    if paise:
        result += f" and {number_words(paise)} Paise"
    return result + " Only"
