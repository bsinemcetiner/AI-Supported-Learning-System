import { BlockMath, InlineMath } from 'react-katex';

type Props = {
  text: string;
};

export default function MathMessage({ text }: Props) {
  const parts = text.split(/(\$\$.*?\$\$|\$.*?\$)/gs);

  return (
    <div style={{ lineHeight: "1.6" }}>
      {parts.map((part, i) => {
        if (part.startsWith("$$")) {
          return (
            <div key={i} style={{ margin: "12px 0" }}>
              <BlockMath math={part.replace(/\$\$/g, "")} />
            </div>
          );
        }

        if (part.startsWith("$")) {
          return (
            <InlineMath key={i} math={part.replace(/\$/g, "")} />
          );
        }

        return <span key={i}>{part}</span>;
      })}
    </div>
  );
}