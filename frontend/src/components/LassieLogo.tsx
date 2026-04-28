import lassieLogo from "../assets/lassie-logo.png";

type LassieLogoProps = {
  size?: number;
  radius?: number;
  glow?: boolean;
  darkMode?: boolean;
};

export function LassieLogo({
  size = 72,
  radius = 20,
  glow = true,
  darkMode = false,
}: LassieLogoProps) {
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      {glow && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(135deg, #fb923c, #ec4899)",
            borderRadius: radius,
            filter: "blur(14px)",
            opacity: 0.35,
          }}
        />
      )}

      <div
        style={{
          position: "relative",
          width: size,
          height: size,
          background: darkMode ? "#1e293b" : "#fff",
          borderRadius: radius,
          boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <img
          src={lassieLogo}
          alt="Lassie logo"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
            transform: "scale(1.35)",
          }}
        />
      </div>
    </div>
  );
}