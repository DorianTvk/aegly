"use client";

import { useRef, useState } from "react";
import clsx from "clsx";
import { ImageIcon, Trash2, Upload } from "lucide-react";

/**
 * Pildi valimine: vähendab pildi brauseris (kärbib keskelt) ja paneb selle peidetud välja `name`
 * data-URL-ina. Väärtus "remove" eemaldab pildi, tühi väärtus jätab muutmata.
 */
export function ImageField({
  name,
  currentUrl,
  width,
  height,
  round = false,
  label,
  hint,
}: {
  name: string;
  currentUrl: string | null;
  width: number;
  height: number;
  round?: boolean;
  label: string;
  hint: string;
}) {
  const [value, setValue] = useState("");
  const [preview, setPreview] = useState<string | null>(currentUrl);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function pick(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Vali pildifail (JPG, PNG, WEBP või HEIC).");
    if (file.size > 15_000_000) return setError("Fail on liiga suur (max 15 MB).");
    try {
      const bmp = await createImageBitmap(file);
      // kärbi keskelt soovitud proportsiooni ja vähenda
      const ratio = width / height;
      let sw = bmp.width;
      let sh = bmp.height;
      if (sw / sh > ratio) sw = sh * ratio;
      else sh = sw / ratio;
      const scale = Math.min(1, width / sw);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(sw * scale);
      canvas.height = Math.round(sh * scale);
      const ctx = canvas.getContext("2d")!;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(bmp, (bmp.width - sw) / 2, (bmp.height - sh) / 2, sw, sh, 0, 0, canvas.width, canvas.height);
      let url = canvas.toDataURL("image/webp", 0.85);
      if (!url.startsWith("data:image/webp")) url = canvas.toDataURL("image/jpeg", 0.85); // vanem Safari
      setValue(url);
      setPreview(url);
    } catch {
      setError("Pilti ei õnnestunud avada. Proovi JPG või PNG faili.");
    }
  }

  return (
    <div className="flex items-center gap-4 rounded-[10px] border border-dashed border-line p-3">
      <input type="hidden" name={name} value={value} />
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      <span className={clsx("grid shrink-0 place-items-center overflow-hidden bg-line-soft text-subtle", round ? "size-16 rounded-full" : "h-14 w-[75px] rounded-lg")}>
        {preview ? <img src={preview} alt="" className="size-full object-cover" /> : <ImageIcon size={20} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className={clsx("text-xs", error ? "text-bad" : "text-muted")}>{error ?? hint}</p>
      </div>
      <div className="flex shrink-0 gap-1.5">
        <button type="button" onClick={() => input.current?.click()} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-white px-3 text-[13px] font-semibold hover:bg-line-soft">
          <Upload size={14} /> {preview ? "Muuda" : "Lisa pilt"}
        </button>
        {preview && (
          <button
            type="button"
            aria-label="Eemalda pilt"
            onClick={() => {
              setPreview(null);
              setValue(currentUrl ? "remove" : "");
              if (input.current) input.current.value = "";
            }}
            className="grid size-9 place-items-center rounded-lg border border-line bg-white text-muted hover:bg-line-soft hover:text-bad"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
