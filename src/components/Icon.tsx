import type { CSSProperties } from "react";

// Colored Iconify icon rendered as an <img> (multi-color emoji/flat sets).
// Usage: <Icon name="fluent-emoji-flat:alarm-clock" />
export function Icon({
  name,
  size = 20,
  className,
  title,
  style,
}: {
  name: string;
  size?: number;
  className?: string;
  title?: string;
  style?: CSSProperties;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://api.iconify.design/${name}.svg?height=${size}`}
      width={size}
      height={size}
      alt={title ?? ""}
      aria-hidden={title ? undefined : true}
      className={className}
      style={{ display: "inline-block", verticalAlign: "middle", ...style }}
    />
  );
}

// Monotone Iconify icon using a CSS mask so it inherits `currentColor`.
// Usage: <MonoIcon name="bi:bell-fill" className="text-brand" />
export function MonoIcon({
  name,
  size = 20,
  className,
  title,
  style,
}: {
  name: string;
  size?: number;
  className?: string;
  title?: string;
  style?: CSSProperties;
}) {
  const url = `https://api.iconify.design/${name}.svg`;
  return (
    <span
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={className}
      style={{
        display: "inline-block",
        width: size,
        height: size,
        backgroundColor: "currentColor",
        WebkitMaskImage: `url('${url}')`,
        maskImage: `url('${url}')`,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskSize: "100% 100%",
        maskSize: "100% 100%",
        verticalAlign: "middle",
        ...style,
      }}
    />
  );
}
