import { useEffect, useState } from "react";
import siteConfig from "../../../site.config";

type Widget = { available: boolean; name?: string; online?: number; members?: number | null };

export default function DiscordStats() {
  const [widget, setWidget] = useState<Widget | null>(null);

  useEffect(() => {
    if (!siteConfig.discord.widgetEnabled) return;
    let cancelled = false;
    fetch("/api/discord/widget")
      .then((response) => (response.ok ? response.json() : { available: false }))
      .then((data: Widget) => {
        if (!cancelled) setWidget(data);
      })
      .catch(() => {
        if (!cancelled) setWidget({ available: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!widget?.available) return null;

  return (
    <div className="discord-stats" aria-label="Lyrica Discord activity">
      <span className="discord-stat">
        <span className="size-1.5 rounded-full bg-[#3ddc97]" aria-hidden="true" />
        {widget.online ?? 0} online
      </span>
      {typeof widget.members === "number" && (
        <span className="discord-stat">{widget.members} members in the server</span>
      )}
    </div>
  );
}
