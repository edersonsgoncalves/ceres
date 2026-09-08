"use client";

interface SavingsIndicatorProps {
  lowestPrice: number;
  highestPrice: number;
}

export function SavingsIndicator({ lowestPrice, highestPrice }: SavingsIndicatorProps) {
  const savings = highestPrice - lowestPrice;
  const savingsPercentage = lowestPrice > 0 ? (savings / highestPrice) * 100 : 0;

  if (savings <= 0) return null;

  return (
    <div className="rounded-lg bg-green-50 dark:bg-green-950 p-4">
      <div className="flex items-center gap-2">
        <svg
          className="h-5 w-5 text-green-600 dark:text-green-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
        <span className="font-medium text-green-800 dark:text-green-200">
          Economia de R$ {savings.toFixed(2)} ({savingsPercentage.toFixed(1)}%)
        </span>
      </div>
      <p className="mt-1 text-sm text-green-600 dark:text-green-400">
        Escolhendo o estabelecimento mais barato!
      </p>
    </div>
  );
}
