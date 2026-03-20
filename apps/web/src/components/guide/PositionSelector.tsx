"use client";

import { useI18n } from "@/lib/i18n";

const POSITION_KEYS = ["UTG", "MP", "CO", "BTN", "SB", "BB"] as const;

interface PositionSelectorProps {
  selected: string;
  onSelect: (position: string) => void;
}

export default function PositionSelector({
  selected,
  onSelect,
}: PositionSelectorProps) {
  const { t } = useI18n();

  return (
    <div className="flex flex-wrap gap-2">
      {POSITION_KEYS.map((key) => (
        <button
          key={key}
          onClick={() => onSelect(key)}
          title={t(`pos.${key}`)}
          className={`px-4 py-2 text-xs font-medium tracking-wider uppercase transition-all border ${
            selected === key
              ? "bg-white text-black border-white"
              : "bg-transparent text-[#666] border-[#333] hover:border-[#555] hover:text-[#999]"
          }`}
        >
          {key}
        </button>
      ))}
    </div>
  );
}
