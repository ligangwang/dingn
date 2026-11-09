"use client";
import { useEffect, useState } from "react";
import { avatarPresets } from "@/lib/models";

type AvatarUser = {
  displayName: string | null;
  email: string | null;
  photoURL?: string | null;
} | null;

export function initialsFor(name: string, user: AvatarUser) {
  return (name || user?.displayName || user?.email || "Me")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Shows the player's avatar: a chosen preset, otherwise the sign-in photo
 * (Google), otherwise their initials. `choice` is the saved profile value.
 */
export function Avatar({
  choice,
  name,
  user,
  size = 38,
  className = "",
}: {
  choice: string;
  name: string;
  user: AvatarUser;
  size?: number;
  className?: string;
}) {
  const photo = user?.photoURL || "";
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [photo]);
  const preset = avatarPresets.find((a) => a.id === choice);
  const style = { width: size, height: size, fontSize: size * 0.4 };
  if (preset)
    return (
      <span
        className={`avatar avatar-preset ${className}`}
        style={{ ...style, background: preset.color, fontSize: size * 0.58 }}
        aria-hidden="true"
      >
        {preset.emoji}
      </span>
    );
  if (choice !== "initials" && photo && !broken)
    return (
      <img
        className={`avatar avatar-photo ${className}`}
        src={photo}
        width={size}
        height={size}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
      />
    );
  return (
    <span
      className={`avatar avatar-initials ${className}`}
      style={style}
      aria-hidden="true"
    >
      {initialsFor(name, user)}
    </span>
  );
}
