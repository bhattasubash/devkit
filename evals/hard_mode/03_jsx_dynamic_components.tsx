import type { KeyboardEvent } from 'react';

interface Props {
  hero: string;
  altText: string;
  onActivate: () => void;
}

function Heading({ level, children }: { level: 1 | 2; children: string }) {
  return level === 1 ? <h1>{children}</h1> : <h2>{children}</h2>;
}

function Image({ src, alt }: { src: string; alt: string }) {
  return <img src={src} alt={alt} width={800} height={450} />;
}

function Card({
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...rest}>{children}</div>;
}

export function InteractiveFeature({ hero, altText, onActivate }: Props) {
  const handleClick = () => onActivate();
  const handleKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onActivate();
    }
  };

  return (
    <section>
      <Heading level={1}>Keyboard Accessible Dynamic Component</Heading>
      <Image src={hero} alt={altText} />
      <Card
        role="button"
        tabIndex={0}
        onKeyDown={handleKey}
        onClick={handleClick}
        className="rounded-md p-4 transition-colors focus-visible:outline-2"
      >
        Open configuration summary
      </Card>
    </section>
  );
}
