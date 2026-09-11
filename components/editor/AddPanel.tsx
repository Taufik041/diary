"use client";

import { useRef, useState } from "react";
import type { PageElement, PhotoFrame } from "@/lib/diary/types";
import { FONTS } from "@/lib/diary/presets";
import { newClip, newTape, newText } from "@/lib/editor/elements";
import { Chip, Frames, Label, TapeSwatches } from "./controls";
import p from "./Panel.module.css";

export function AddPanel({
  onAdd,
  onAddPhoto,
  onClose,
}: {
  onAdd: (el: PageElement) => void;
  onAddPhoto: (frame: PhotoFrame, file: File) => void;
  onClose: () => void;
}) {
  const [frame, setFrame] = useState<PhotoFrame>("polaroid");
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <div className={p.grabber} />
      <div className={p.header}>
        <span className={p.title}>Add to the page</span>
        <button type="button" className={`${p.close} ${p.mobileOnly}`} onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      <Label>Photo</Label>
      <Frames value={frame} onChange={setFrame} />
      <Chip onClick={() => fileRef.current?.click()}>Choose a photo…</Chip>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onAddPhoto(frame, file);
        }}
      />

      <Label>Text</Label>
      <div className={p.row}>
        <Chip
          style={{ fontFamily: FONTS.caveat.family, fontStyle: "normal", fontSize: 22 }}
          onClick={() => onAdd(newText("plain"))}
        >
          Handwriting
        </Chip>
        <Chip onClick={() => onAdd(newText("card"))}>Note card</Chip>
      </div>

      <Label>Washi tape</Label>
      <TapeSwatches onPick={(v) => onAdd(newTape(v))} />

      <Label>Clip</Label>
      <Chip onClick={() => onAdd(newClip())}>Paperclip</Chip>
    </>
  );
}
